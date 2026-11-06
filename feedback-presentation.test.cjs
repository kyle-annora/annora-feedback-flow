'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js'),S=require('./feedback-store.js'),P=require('./feedback-presentation.js'),C=require('./scenario-catalog.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const customer=(c,id='WQ-101')=>({id,c,clientId:'winquote',captureSubmission:true,submissionOrigin:'customer'});
const run=(data,id,actor,action,value,extra={})=>S.commit(data,id,{expectedSequence:S.get(data,id).sequence,actor,action,value,...extra});
function plain(){let c=E.transition(E.createCase('Change the homepage button label to "Start a quote".'),'submit');return E.transition(c,'deliver');}
function added(scenario='compartment'){const s=C.get(scenario);return S.add(S.migrate(null),s,{text:s.feedback,context:{page:s.target,quote:'DEMO-102'},captureId:'capture-'+scenario,attachments:[]});}
function submitted(){let {data,item}=added();const id=item.id;({data,item}=run(data,id,'Website team','draft-plan'));for(const [action,value] of [['confirm-scope',item.c.reviewFlow.scope],['finish-spec'],['prepare-result'],['deliver']])({data,item}=run(data,id,'Website team',action,value));return {data,item};}

test('metadata migration preserves legacy CaseEngine records, raw answers, versions and approvals byte for byte without assigning a scenario',()=>{
  let c=plain();c=E.transition(c,'accept');c=E.transition(c,'authorize');
  const old={items:[customer(c)],serial:0,current:'WQ-101',unknownMetadata:{keep:true}},before=JSON.stringify(old);
  const migrated=S.migrate(freeze(old)),item=S.get(migrated,'WQ-101');
  assert.equal(JSON.stringify(old),before);assert.deepEqual(item.c,c);assert.equal(item.c.reviewFlow,undefined);
  assert.equal(P.describe(item).legacy,true);assert.equal(P.describe(item).candidate,c.versions[0].candidate);
  assert.ok(item.ux.events.some(e=>e.action==='deliver'));
  assert.equal(S.status(item).owner,'Website team');assert.deepEqual(migrated.unknownMetadata,{keep:true});
  const reviewed=E.createReviewedCase(E.pdfFeedback,{journey:true});
  const noScenario=S.migrate({items:[customer(reviewed,'WQ-102')]}).items[0];
  const retained=clone(noScenario.c);delete retained.reviewFlow.evidenceFirst;delete retained.reviewFlow.planPrepared;
  assert.deepEqual(retained,reviewed,'The new workspace may add its opt-in gate metadata without rewriting original evidence, draft values or versions.');assert.equal(P.describe(noScenario).legacy,true);assert.equal(noScenario.c.reviewFlow.scenarioId,undefined);
});

test('a historical projection binds its original evidence, answer and candidate even after the live draft changes',()=>{
  let {data,item}=submitted();const id=item.id;
  const initial=[{id:'image-v1',kind:'image',name:'Original capture'}];
  // Construct the submitted fixture with evidence present before checking.
  let c=E.createReviewedCase(C.get('compartment').feedback,{scenarioId:'compartment',journey:true});
  c.reviewFlow.context={quote:'QUOTE-V1',page:'Edit quote'};c.reviewFlow.attachments=initial;
  c=E.review(c,'confirm-scope',{...c.reviewFlow.scope,understanding:'Original V1 understanding.'});
  for(const action of ['finish-spec','prepare-result','deliver'])c=E.review(c,action);
  const saved=clone(c.versions[0]);c=E.review(c,'adjust',{rev:1,reason:'Repeat labels on every section.'});
  c.reviewFlow.context={quote:'QUOTE-V2',page:'Another page'};c.reviewFlow.attachments=[{id:'new-image',kind:'image',name:'Later material'}];
  c.reviewFlow.sharedUnderstanding.text='Newer live understanding that must not enter V1';
  const record=customer(c),before=JSON.stringify(record),view=P.describe(freeze(record),{rev:1,actor:'Requester'});
  assert.equal(JSON.stringify(record),before);assert.equal(view.historical,true);
  assert.equal(view.request.context.quote,'QUOTE-V1');assert.deepEqual(view.request.attachments,initial);
  assert.equal(view.understanding.text,'Original V1 understanding.');assert.equal(view.candidate,saved.candidate);
  assert.ok(!JSON.stringify(view.basis).includes('Newer live'));assert.equal(view.viewedRev,1);assert.equal(view.currentRev,2);
});

test('an older snapshot without context, attachments or understanding never borrows live metadata',()=>{
  const c=plain(),snapshot=clone(c.versions[0]);
  c.reviewFlow={phase:'candidate',target:'Current target',context:{quote:'PRIVATE-LIVE'},attachments:[{id:'live-only',kind:'image'}],sharedUnderstanding:{text:'Newer scope'},source:{history:[]}};
  c.rev=2;
  const view=P.describe(customer(c),{rev:1});
  assert.equal(view.request.context,null);assert.deepEqual(view.request.attachments,[]);assert.equal(view.understanding,null);
  assert.equal(view.target,null);assert.equal(view.request.text,snapshot.source);assert.equal(view.request.unavailable,true);
  assert.ok(!JSON.stringify(view).includes('PRIVATE-LIVE'));
  assert.equal(P.describe(customer(c),{rev:99}).missing,true);
});

test('versions are latest first and retain submitted/accepted/authorized/released status and real event timestamps',()=>{
  let c=plain();c=E.transition(c,'accept');c=E.transition(c,'authorize');c=E.transition(c,'publish');
  const view=P.describe(customer(c));
  assert.deepEqual(view.versions[0].statuses,['submitted','accepted','authorized','released']);
  assert.equal(view.versions[0].status,'Released in simulation');assert.equal(view.versions[0].at,c.trail.find(t=>t.action==='deliver').at);
  let updated=plain();updated=E.transition(updated,'adjust','Change the button label to "Build my quote".');updated=E.transition(updated,'deliver');
  const history=P.describe(customer(updated));assert.deepEqual(history.versions.map(v=>v.rev),[2,1]);
  assert.ok(history.activity.every(t=>t.at&&t.actor));
  const pdf=E.createReviewedCase(E.pdfFeedback);
  const decisions=P.describe(customer(pdf),{actor:'Website team'}).recordedDecisions;
  assert.equal(decisions[0].superseded,true);assert.equal(decisions[0].status,'superseded');
});

test('customer presentation never includes unsent questions, private suggestions, or private draft activity',()=>{
  const c=E.createReviewedCase(C.get('compartment').feedback,{scenarioId:'compartment',journey:true});
  c.reviewFlow.questionDraft=[{id:'private',text:'PRIVATE-QUESTION',disposition:'team'}];
  c.reviewFlow.suggestedScope={approach:'PRIVATE-PROPOSAL',checks:'PRIVATE-CHECK'};
  c.trail.push({action:'save-questions',actor:'Website team',text:'PRIVATE-ACTIVITY',rev:1,at:'2026-11-06T00:00:00Z'});
  assert.ok(!JSON.stringify(P.describe(customer(c),{actor:'Website team'}).basis).includes('PRIVATE-PROPOSAL'),'A stale suggestion is not an active basis in team triage.');
  c.reviewFlow.phase='answer-review';
  const customerView=P.describe(customer(c),{actor:'Requester'}),team=P.describe(customer(c),{actor:'Website team'});
  assert.ok(!JSON.stringify(customerView).includes('PRIVATE-'));assert.ok(JSON.stringify(team.basis).includes('PRIVATE-PROPOSAL'));
  assert.ok(team.activity.some(t=>t.text==='PRIVATE-ACTIVITY'));
  c.reviewFlow.candidateDraft={approach:'PRIVATE-CANDIDATE',checks:'PRIVATE-CHECK'};
  assert.ok(!JSON.stringify(P.describe(customer(c))).includes('PRIVATE-'));
});

test('the current submitted V2 basis is identical for team and customer after answer confirmation, revision, acceptance, authorization and release',()=>{
  let c=E.createReviewedCase(E.pdfFeedback,{journey:true});
  c=E.review(c,'draft-questions');c=E.review(c,'send-questions');c=E.review(c,'answer','Keep editing this quote');
  const suggestion=clone(c.reviewFlow.suggestedScope);
  assert.equal(P.describe(customer(c),{actor:'Website team'}).basis[0].status,'pending-team-review');
  c=E.review(c,'confirm-scope',{...suggestion,understanding:'Keep editing the same quote while its PDF opens separately.'});
  assert.ok(P.describe(customer(c),{actor:'Website team'}).basis.every(row=>row.status!=='pending-team-review'));
  for(const action of ['finish-spec','prepare-result','deliver'])c=E.review(c,action);
  const v1=clone(c.versions[0]);
  c=E.review(c,'adjust',{rev:1,reason:'Place the explicit Workflow action at the page footer.'});
  const revised={
    approach:'Open the saved customer’s PDF in a new browser tab.\nKeep the same quote on Make PDF.\nShow a separate Go to Workflow action at the page footer.',
    checks:'The saved customer’s PDF opens in a new tab.\nThe original tab stays on Make PDF with the same quote.\nGo to Workflow is visible at the page footer and navigates only when selected.'
  };
  c=E.review(c,'edit-candidate',revised);
  const draft=P.describe(customer(c),{actor:'Website team'}),waiting=P.describe(customer(c),{actor:'Requester'});
  assert.equal(draft.basis.map(row=>row.text).join('\n'),revised.approach);
  assert.ok(draft.basis.every(row=>row.status==='team-draft'&&row.source.label==='Team draft V2'));
  assert.ok(!JSON.stringify(waiting.basis).includes('page footer'),'Requester cannot see the unsent V2 draft.');
  assert.equal(waiting.candidate,'');
  c=E.review(c,'prepare-result');c=E.review(c,'deliver');
  for(const action of [null,'accept','authorize','publish']){
    if(action)c=E.review(c,action,{rev:2});
    const before=JSON.stringify(c),team=P.describe(customer(freeze(c)),{actor:'Website team'}),requester=P.describe(customer(c),{actor:'Requester'}),owner=P.describe(customer(c),{actor:'Site owner'});
    assert.equal(JSON.stringify(c),before);
    assert.deepEqual(team.basis,requester.basis);assert.deepEqual(owner.basis,requester.basis);
    assert.equal(team.basis.map(row=>row.text).join('\n'),revised.approach);
    assert.ok(team.basis.every(row=>row.status==='submitted-snapshot'&&row.source.label==='Submitted V2'&&row.source.rev===2));
    assert.ok(!JSON.stringify(team.basis).includes('awaiting team confirmation'));
    assert.equal(team.candidate,c.versions[1].candidate);assert.deepEqual(team.checks,c.versions[1].checks);
  }
  const tampered=clone(c);tampered.reviewFlow.candidateDraft.approach='UNSENT LIVE DRAFT';tampered.reviewFlow.suggestedScope.approach='STALE ANSWER SUGGESTION';
  assert.equal(P.describe(customer(tampered),{actor:'Website team'}).basis.map(row=>row.text).join('\n'),revised.approach);
  assert.equal(P.describe(customer(tampered)).candidate,revised.approach);
  const history=P.describe(customer(c),{rev:1,actor:'Website team'});
  assert.equal(history.basis.map(row=>row.text).join('\n'),v1.candidate);
  assert.ok(history.basis.every(row=>row.source.label==='Submitted V1'&&row.source.rev===1));
  assert.deepEqual(c.versions[0],v1);
});

function submittedPolicy(policy,{withoutPolicyCheck=false}={}){
  let c=E.createReviewedCase(C.get('refrigeration').feedback,{scenarioId:'refrigeration',journey:true,evidenceFirst:true});
  c=E.review(c,'draft-questions');c=E.review(c,'send-questions');
  c=E.review(c,'answer',{answers:{'equipment-return':policy}});c=E.review(c,'draft-plan');
  c=E.review(c,'confirm-scope',c.reviewFlow.scope);c=E.review(c,'finish-spec');
  if(withoutPolicyCheck)c=E.review(c,'edit-candidate',{checks:c.reviewFlow.candidateDraft.checks.split('\n').filter((_,index)=>index!==3).join('\n')});
  c=E.review(c,'prepare-result');return E.review(c,'deliver');
}

test('team follow-up labels the revised scope and keeps each submitted answer-to-check relation frozen',()=>{
  let c=submittedPolicy('Select equipment again');
  const v1=clone(c.versions[0]),original=P.describe(customer(c),{rev:1});
  c=E.review(c,'adjust',{rev:1,reason:'Restore our previous selection when refrigeration is needed again.'});
  c=E.review(c,'reopen-clarification');c=E.review(c,'send-questions');
  c=E.review(c,'answer',{answers:{'equipment-return':'Restore the previous equipment selection'}});
  const answerReview=P.describe(customer(c),{actor:'Website team'});
  assert.equal(answerReview.reasoning.implications[0].source.label,'Q2 · Scope revision 2');
  c=E.review(c,'draft-plan');c=E.review(c,'confirm-scope',c.reviewFlow.scope);c=E.review(c,'finish-spec');
  c=E.review(c,'prepare-result');c=E.review(c,'deliver');
  const before=JSON.stringify(c),current=P.describe(customer(c)),history=P.describe(customer(c),{rev:1});
  assert.equal(current.reasoning.implications[0].source.label,'Q2 · Scope revision 2');
  assert.equal(current.reasoning.implications[0].answer,'Restore the previous equipment selection');
  assert.match(current.reasoning.implications[0].checks[0],/restores the prior equipment selection and its charges/);
  assert.equal(current.questionRounds.length,2);
  assert.equal(history.questionRounds.length,1);
  assert.equal(history.reasoning.implications[0].source.label,'Q1 · Initial answer');
  for(const key of ['basis','answers','questionRounds','candidate','checks','reasoning'])assert.deepEqual(history[key],original[key]);
  assert.deepEqual(c.versions[0],v1);assert.equal(JSON.stringify(c),before);
});

test('an older saved candidate outside the current catalog keeps its own content and cannot acquire a current policy through answer mapping',()=>{
  let c=submittedPolicy('restore');
  // A saved, older-format delivery may predate or differ from the finite catalog
  // shipped today. Its persisted candidate remains the historical authority.
  const oldCandidate='Earlier saved approach: the team investigates the refrigeration state before changing equipment.';
  const oldCheck='Earlier saved check: reproduce the saved flag and charge mismatch for the team.';
  const v=c.versions[0];v.candidate=oldCandidate;v.text=oldCandidate;v.checks=[{id:'old-check',value:oldCheck,label:oldCheck}];
  v.result.approach=oldCandidate;v.result.steps=[oldCandidate];v.result.checks=oldCheck;
  v.reviewFlow.candidateDraft={approach:oldCandidate,checks:oldCheck};
  v.view.candidate=oldCandidate;v.view.checks=clone(v.checks);
  c.reviewFlow=clone(v.reviewFlow);c.reviewFlow.phase='review';
  const saved=clone(c.versions[0]),before=JSON.stringify(c);
  for(const actor of ['Requester','Website team','Site owner'])for(const options of [{actor},{actor,rev:1}]){
    const p=P.describe(customer(freeze(c)),options),relation=p.reasoning.implications[0];
    assert.equal(p.candidate,oldCandidate);assert.deepEqual(p.checks,saved.checks);
    assert.equal(p.basis[0].text,oldCandidate);assert.equal(relation.answer,'Restore the previous equipment selection');
    assert.deepEqual(relation.behavior,[oldCandidate]);assert.deepEqual(relation.checks,[oldCheck]);
    assert.equal(relation.supported,false);assert.equal(relation.status,'submitted-unmapped');
    assert.match(relation.note,/cannot be inferred automatically/);
    assert.equal(relation.conflict,null);
    assert.ok(!relation.behavior.join(' ').includes('restore that prior selection'));
    assert.equal(p.preview.interactive,false);
  }
  assert.equal(JSON.stringify(c),before);
  const earlier=P.describe(customer(c),{rev:1,actor:'Requester'});
  c=E.review(c,'adjust',{rev:1,reason:'Use the supported re-selection proposal for the next version.'});
  c=E.review(c,'edit-candidate',C.variant('refrigeration','reselect').scope);
  c.answer='Select equipment again';c.reviewFlow.context={quote:'NEWER-LIVE-QUOTE'};
  c.reviewFlow.questionRounds[0].answers['equipment-return']='Select equipment again';
  c.reviewFlow.questionRounds[0].answerText='Select equipment again';
  c=E.review(c,'prepare-result');c=E.review(c,'deliver');
  const history=P.describe(customer(c),{rev:1,actor:'Requester'});
  for(const key of ['request','answers','questionRounds','basis','candidate','checks','reasoning'])assert.deepEqual(history[key],earlier[key],key+' must remain version-bound.');
  assert.deepEqual(c.versions[0],saved);
  assert.equal(P.describe(customer(c)).reasoning.sourceVersion,2);
});

test('exact submitted authored policies retain their saved answer relation and never invent an omitted acceptance check',()=>{
  for(const policy of ['reselect','restore']){
    const c=submittedPolicy(policy),p=P.describe(customer(c),{rev:1}),relation=p.reasoning.implications[0],variant=C.variant('refrigeration',policy);
    assert.equal(relation.supported,true);assert.equal(relation.status,'submitted');
    assert.deepEqual(relation.behavior,[variant.scope.approach.split('\n')[2]]);
    assert.deepEqual(relation.checks,[variant.scope.checks.split('\n')[3]]);
    assert.equal(p.candidate,c.versions[0].candidate);
  }
  const c=submittedPolicy('restore',{withoutPolicyCheck:true}),relation=P.describe(customer(c),{rev:1}).reasoning.implications[0];
  assert.equal(relation.supported,true);assert.deepEqual(relation.checks,[]);
  assert.ok(!c.versions[0].result.checks.includes('saving restores'));
});

test('question-round projection includes only sent batches, pending and answered, with real trail times but no frozen private scope',()=>{
  let c=E.createReviewedCase(E.hesitationFeedback,{journey:true});c=E.review(c,'draft-questions');
  assert.deepEqual(P.describe(customer(c)).questionRounds,[]);
  c.reviewFlow.scope.approach='PRIVATE-UNCONFIRMED-SCOPE';
  c=E.review(c,'send-questions');const sent=clone(c.reviewFlow.sentBundle),pending=P.describe(customer(c));
  assert.equal(pending.questionRounds[0].answered,false);assert.equal(pending.questionRounds[0].id,sent.id);
  assert.equal(pending.questionRounds[0].at,c.trail.at(-1).at);assert.ok(!JSON.stringify(pending.questionRounds).includes('PRIVATE-UNCONFIRMED'));
  c=E.review(c,'answer',E.hesitationAnswers[0]);const answered=P.describe(customer(c));
  assert.equal(answered.questionRounds[0].answered,true);assert.equal(answered.answers[0].at,c.trail.at(-1).at);
  assert.equal(answered.answers[0].answer,E.hesitationAnswers[0]);assert.ok(!JSON.stringify(P.activity(customer(c))).includes('Saved the private'));
});

test('preliminary simulation names the actual supplied material and quote while refusing to imply media analysis or team approval',()=>{
  const item=customer(E.createReviewedCase('See the attached recording.',{scenarioId:'pdf',journey:true}));
  item.c.reviewFlow.context={quote:'DEMO-555',selection:{label:'Generate PDF result'},page:'Make PDF'};
  item.c.reviewFlow.attachments=[{id:'voice',kind:'audio'},{id:'image',kind:'image'}];
  const before=JSON.stringify(item),prep=P.preparation(freeze(item),'draft-ready');
  assert.equal(JSON.stringify(item),before);assert.equal(prep.simulated,true);assert.equal(prep.analyzedMedia,false);assert.equal(prep.pendingTeamReview,true);
  assert.ok(prep.facts.some(f=>f.text==='DEMO-555'));assert.ok(prep.facts.some(f=>f.text==='Generate PDF result'));
  assert.ok(prep.facts.some(f=>f.text.includes('voice note')));assert.ok(prep.facts.some(f=>f.label==='Attachment-only feedback'));
  assert.ok(prep.limitations.some(t=>t.includes('not automatically transcribed')));assert.deepEqual(prep.questions,[]);
});

test('two-second context brief and forty-second team draft have different useful outputs without sharing private plans or inferring media',()=>{
  const item=added('pdf').item;
  const early=P.preparation(item,'draft-ready'),concealed=P.preparation(item,'team-review-pending');
  assert.equal(early.title,'Context brief ready');assert.equal(early.teamDraft,undefined);
  assert.equal(concealed.teamDraft,undefined,'Elapsed time alone must not materialize a full plan before the evidence-first team action.');
  item.c=E.review(item.c,'draft-plan');const later=P.preparation(item,'team-review-pending');
  assert.equal(later.teamDraft.kind,'plan');assert.equal(later.teamDraft.approach,C.get('pdf').scope.approach);
  assert.ok(later.teamDraft.checks.length>=3);assert.equal(later.teamDraft.shared,false);
  item.ux.preparation=later;
  const customerView=P.describe(item,{actor:'Requester'}),teamView=P.describe(item,{actor:'Website team'});
  assert.equal(customerView.preparation.teamDraft,undefined);assert.equal(customerView.preparation.draftPlan,undefined);
  assert.ok(teamView.preparation.teamDraft.checks.length);
  const own=customer(E.createReviewedCase(E.hesitationFeedback));
  assert.equal(P.preparation(own,'team-review-pending').teamDraft.kind,'missing-context');
  assert.match(P.preparation(own,'team-review-pending').teamDraft.questions[0],/hesitate/);
  const mediaOnly=customer(E.createReviewedCase('See the attached image.',{scenarioId:'pdf',journey:true}));
  mediaOnly.c.reviewFlow.attachments=[{id:'original',kind:'image'}];
  const held=P.preparation(mediaOnly,'team-review-pending');assert.equal(held.teamDraft.kind,'material-review');assert.equal(held.teamDraft.approach,null);assert.deepEqual(held.teamDraft.questions,[]);
});

test('Why explains the actual business case, concern, phase and version instead of only a generic playback step',()=>{
  const cases=C.list().map(s=>P.why(customer(E.createReviewedCase(s.feedback,{scenarioId:s.id,journey:true}))));
  assert.equal(new Set(cases.map(x=>x.text)).size,3);
  const concern=E.hesitationAnswers.map(answer=>{let c=E.transition(E.createCase(E.hesitationFeedback),'submit');c=E.transition(c,'answer',answer);return P.why(customer(c)).text;});
  assert.notEqual(concern[0],concern[1]);assert.match(concern[0],/sends a quote/);assert.match(concern[1],/template/);
  const historical=P.describe(customer(plain()),{rev:1}).why;assert.match(historical.text,/Read-only V1/);
});

test('plain legacy commands keep the same record and exact snapshots, reject wrong roles/stale versions/no-ops and preserve separate authorization',()=>{
  let data=S.migrate({items:[customer(plain())],current:'WQ-101'}),id='WQ-101';
  const snapshot=clone(S.get(data,id).c.versions[0]);
  assert.throws(()=>run(data,id,'Website team','accept',{rev:1}),/different role/);
  assert.throws(()=>run(data,id,'Requester','accept',{rev:0}),/exact current/);
  let r=run(data,id,'Requester','accept',{rev:1});data=r.data;assert.equal(r.item.c.authorization,null);
  assert.throws(()=>run(data,id,'Website team','publish',{rev:1}),/accepted and authorized/);
  r=run(data,id,'Site owner','authorize',{rev:1});data=r.data;
  const authorizedTrail=clone(r.item.c.trail);
  r=run(data,id,'Website team','publish-failed',{rev:1,reason:'Simulated target unavailable.'});data=r.data;
  assert.deepEqual(r.item.c.trail.slice(0,-1),authorizedTrail,'Recording a failed attempt appends history without rewriting the authorization timestamp.');
  assert.equal(S.status(r.item).phase,'release-failed');assert.throws(()=>run(data,id,'Website team','publish',{rev:1}),/explicit retry/);
  r=run(data,id,'Website team','retry-publish',{rev:1});data=r.data;r=run(data,id,'Website team','publish',{rev:1});
  assert.equal(r.item.id,id);assert.equal(r.item.c.receipt.rev,1);assert.deepEqual(r.item.c.versions[0],snapshot);
  assert.throws(()=>run(r.data,id,'Website team','publish',{rev:1}),/unavailable/);
  assert.equal(r.item.c.reviewFlow,undefined);
});

test('new deliveries on a plain legacy ticket freeze local context and adjustment material without changing its previous snapshot',()=>{
  let data=S.migrate({items:[customer(plain())],current:'WQ-101'}),id='WQ-101',old=clone(S.get(data,id).c.versions[0]);
  S.get(data,id).ux.context={quote:'LEGACY-QUOTE'};S.get(data,id).ux.attachments=[{id:'original',kind:'image'}];
  let r=run(data,id,'Requester','adjust',{rev:1,reason:'Change the button label to "Build my quote".',attachments:[{id:'revision',kind:'image'}],context:{quote:'REVISION-QUOTE'}});data=r.data;
  r=run(data,id,'Website team','deliver');
  assert.deepEqual(r.item.c.versions[0],old);assert.equal(r.item.c.reviewFlow,undefined);
  const historical=P.describe(r.item,{rev:2});assert.equal(historical.request.context.quote,'LEGACY-QUOTE');assert.equal(historical.adjustmentEvidence.context.quote,'REVISION-QUOTE');
  assert.equal(historical.adjustmentEvidence.attachments[0].id,'revision');
  r.item.ux.context.quote='NEWER-LIVE';assert.equal(P.describe(r.item,{rev:2}).request.context.quote,'LEGACY-QUOTE');
});

test('visit cursors are per ticket, count only public updates, and reading/opening does not accept a result',()=>{
  let {data,item}=added(),id=item.id;
  let v=S.visit(data,id);data=v.data;assert.equal(v.summary,null);
  const beforeCase=clone(item.c);
  ({data,item}=run(data,id,'Website team','edit-scope',{approach:item.c.reviewFlow.scope.approach}));
  v=S.visit(data,id);data=v.data;assert.equal(v.summary,null);assert.equal(S.updates(data).length,0);
  ({data,item}=run(data,id,'Website team','draft-plan'));
  for(const [action,value] of [['confirm-scope',item.c.reviewFlow.scope],['finish-spec'],['prepare-result'],['deliver']])({data,item}=run(data,id,'Website team',action,value));
  const before=clone(item.c),readBefore=clone(data.feedbackExperience.read);
  v=S.visit(freeze(data),id);assert.match(v.summary.text,/V1 is ready/);assert.equal(v.summary.newVersionIds[0],'V1');
  assert.deepEqual(v.item.c,before);assert.deepEqual(v.data.feedbackExperience.read,readBefore);assert.equal(v.item.c.accepted,null);
  assert.equal(S.visit(v.data,id).summary,null);
  const other=added('pdf');other.item.id='WQ-999';other.data.items=[other.item];
  const combined=S.migrate({...v.data,items:[...v.data.items,other.item]});
  assert.equal(S.visit(combined,'WQ-999').summary,null,'One ticket visit never consumes another ticket cursor.');
});

test('ticket digests are new-first and combine public events without exposing other clients or private edits',()=>{
  let {data,item}=submitted(),first=item.id;
  data=S.advance(data,1);const other=C.get('pdf');let r=S.add(data,other,{text:other.feedback,captureId:'other',context:{},attachments:[]});data=r.data;
  ({data,item}=run(data,r.item.id,'Website team','draft-plan'));
  ({data,item}=run(data,item.id,'Website team','confirm-scope',item.c.reviewFlow.scope));
  const foreign=clone(item);foreign.clientId='other';foreign.id='FOREIGN';foreign.ux.events=[{id:'PRIVATE-FOREIGN',ticketId:'FOREIGN',at:'2099-01-01',title:'SECRET'}];data.items.push(foreign);
  const groups=S.digest(freeze(data));assert.equal(groups.length,2);assert.equal(groups[0].ticketId,item.id);
  assert.equal(groups[1].ticketId,first);assert.ok(groups[1].count>=2);assert.equal(groups[1].events[0].action,'deliver');
  assert.ok(!JSON.stringify(groups).includes('SECRET'));assert.ok(!JSON.stringify(groups).includes('edit-scope'));
  const read=S.markRead(data,groups[1].events[0].id);assert.ok(S.digest(read).find(d=>d.ticketId===first).unreadCount<groups[1].unreadCount);
  assert.deepEqual(S.markRead(data,'PRIVATE-FOREIGN').feedbackExperience.read,data.feedbackExperience.read);
  assert.throws(()=>S.visit(data,'FOREIGN'),/not available/);
});

test('delay notification and explicit rescheduling are idempotent, preserve the old promise, and never modify the case',()=>{
  const original=added(),id=original.item.id,c=clone(original.item.c),oldAt=original.item.ux.timing.nextUpdateAt;
  let data=S.advance(original.data,3),result=S.recordDelay(data,id,{reason:'The team is still checking the saved equipment.'});
  assert.equal(result.item.ux.timing.nextUpdateAt,oldAt);assert.deepEqual(result.item.c,c);assert.equal(result.event.action,'delay');
  const repeated=S.recordDelay(result.data,id,{reason:'The team is still checking the saved equipment.'});assert.equal(repeated.duplicate,true);assert.equal(S.updates(repeated.data).length,1);
  const newAt=new Date(Date.parse(S.now(result.data))+3600000).toISOString();result=S.setExpectation(result.data,id,{at:newAt,reason:'A revised update after the team check.'});
  assert.equal(result.item.ux.timing.expectationHistory[0].at,oldAt);assert.equal(result.event.action,'update-expectation');assert.equal(result.item.ux.timing.nextUpdateAt,newAt);
  assert.equal(S.setExpectation(result.data,id,{at:newAt,reason:'A revised update after the team check.'}).duplicate,true);
  assert.deepEqual(result.item.c,c);assert.throws(()=>S.recordDelay(result.data,id),/overdue checkpoint/);
});

test('walkthrough and preparation persistence merge presentation metadata while leaving canonical case and sequence untouched',()=>{
  let {data,item}=added(),id=item.id,before=clone(item.c),sequence=item.sequence;
  let r=S.saveWalk(data,id,{mode:'watch',role:'Website team',cursor:3,open:true,scenes:[{readOnly:true,title:'Historical scene',snapshot:{text:'DO NOT WRITE THIS INTO CASE'}}]});
  r=S.saveWalk(r.data,id,{open:false});assert.equal(r.walk.cursor,3);assert.equal(r.walk.mode,'watch');assert.equal(r.walk.role,'Website team');
  assert.deepEqual(r.item.c,before);assert.equal(r.item.sequence,sequence);
  assert.throws(()=>S.saveWalk(r.data,id,{c:{text:'Replace actual'}}),/separately/);
  assert.throws(()=>S.saveWalk(r.data,id,{role:'Complete'}),/supported demo perspective/);
  const prepared=S.preparation(r.data,id,'draft-ready');assert.ok(prepared.preparation.facts.length>1);assert.equal(prepared.preparation.simulated,true);
  assert.deepEqual(prepared.item.c,before);assert.equal(prepared.item.sequence,sequence);
  const restored=S.migrate(JSON.parse(JSON.stringify(prepared.data)));assert.equal(S.get(restored,id).ux.walk.cursor,3);assert.equal(S.get(restored,id).ux.preparation.stage,'draft-ready');
});
