'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const C=require('./scenario-catalog.js');
const P=require('./feedback-presentation.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const act=(c,action,value)=>E.review(c,action,value);
const make=(id='pdf',raw=C.get(id).feedback)=>E.createReviewedCase(raw,{scenarioId:id,journey:true,evidenceFirst:true});
const item=c=>({id:'WQ-501',clientId:'winquote',c,ux:{}});
const draft=c=>act(c,'draft-plan');
const share=c=>act(c,'confirm-scope',{...c.reviewFlow.scope,understanding:'The team has checked the report and applicable records.'});
const deliver=c=>act(act(act(share(draft(c)),'finish-spec'),'prepare-result'),'deliver');
function answeredPolicy(answer){
  let c=act(share(draft(make('refrigeration'))),'begin-detailed-questions');
  c=act(c,'send-questions');
  return act(c,'answer',{bundleId:c.reviewFlow.sentBundle.id,answers:{'equipment-return':answer}});
}

test('evidence-first intake begins with a problem and sourced records, not a preloaded plan or fabricated customer task',()=>{
  for(const scenario of C.list()){
    const c=make(scenario.id),before=clone(c);
    assert.deepEqual(c.reviewFlow.scope,{approach:'',checks:''});
    assert.equal(c.reviewFlow.planPrepared,false);assert.equal(E.derive(c).candidate,'');
    const team=P.describe(item(c),{actor:'Website team'}),customer=P.describe(item(c),{actor:'Requester'});
    assert.deepEqual(team.basis,[]);assert.equal(team.candidate,'');
    assert.equal(team.reasoning.problem.text,scenario.problem);
    assert.ok(team.reasoning.decisions.length);assert.deepEqual(team.reasoning.outstanding,[]);
    assert.deepEqual(customer.reasoning.outstanding,[]);
    assert.equal(team.reasoning.liveAI,false);assert.equal(team.reasoning.state,'evidence');
    const forty=P.preparation(item(c),'team-review-pending',{actor:'Website team'});
    assert.equal(forty.teamDraft,undefined);assert.equal(forty.draftPlan,undefined);
    assert.doesNotMatch(JSON.stringify(forty),/"approach"|"checks"/);
    assert.throws(()=>act(c,'confirm-scope',scenario.scope),/Prepare a current plan draft/);
    assert.deepEqual(c,before);
  }
});

test('draft-plan is explicit, evidence-bound and private, preserves edits, and cannot silently send or approve anything',()=>{
  let c=make();c.reviewFlow.context={page:'Make PDF',quoteId:'Q-17',state:{pdfGenerated:true}};
  const initial=clone(c);c=draft(c);
  assert.equal(c.reviewFlow.phase,'triage');assert.equal(c.owner,'Website team');
  assert.deepEqual(c.reviewFlow.scope,C.get('pdf').scope);assert.equal(c.reviewFlow.planPrepared,true);
  assert.equal(c.reviewFlow.planPreparation.basis.context.quoteId,'Q-17');
  assert.equal(c.reviewFlow.planPreparation.confirmed,false);assert.equal(c.reviewFlow.planPreparation.simulated,true);
  assert.equal(c.reviewFlow.sharedUnderstanding,null);assert.equal(c.reviewFlow.sentBundle,null);
  assert.deepEqual(c.versions,[]);assert.equal(c.accepted,null);assert.equal(c.authorization,null);
  const edited=act(c,'edit-scope',{approach:c.reviewFlow.scope.approach+'\nTeam-authored unresolved detail.'});
  assert.strictEqual(draft(edited),edited,'Repeated preparation of unchanged evidence is a no-op, not a reset to a fixture.');
  const changed=clone(edited);changed.reviewFlow.context.quoteId='Q-18';
  assert.throws(()=>share(changed),/Earlier drafts cannot confirm new materials/);
  const refreshed=draft(changed);
  assert.equal(refreshed.reviewFlow.scope.approach,edited.reviewFlow.scope.approach,'Re-review keeps the actual team draft.');
  assert.equal(refreshed.reviewFlow.planPreparation.basis.context.quoteId,'Q-18');
  assert.deepEqual(initial.reviewFlow.scope,{approach:'',checks:''});
});

test('changing source material, raw text, an attachment transcript or actual answer invalidates confirmation against an earlier preparation',()=>{
  const c=draft(make());
  for(const mutate of [
    x=>{x.text+=' More context.';},
    x=>{x.reviewFlow.source.history.push({date:'2026-11-06',decision:'Review this new material.'});},
    x=>{x.reviewFlow.context={page:'Make PDF',quoteId:'another-quote'};},
    x=>{x.reviewFlow.attachments=[{id:'voice',kind:'audio',transcript:'An edited transcript',transcriptRevision:2}];},
    x=>{x.reviewFlow.answers={'new-answer':'An actual different answer'};},
  ]){
    const changed=clone(c);mutate(changed);const before=clone(changed);
    assert.throws(()=>share(changed),/Earlier drafts cannot confirm new materials/);
    assert.deepEqual(changed,before);
  }
});

test('unknown, mixed and media-only evidence stays manual after drafting rather than inheriting a selected scenario outcome',()=>{
  for(const raw of ['Make the invoice export faster.',C.get('pdf').feedback+' Also email every customer.','See the attached recording.']){
    let c=make('pdf',raw);c.reviewFlow.attachments=[{id:'voice',kind:'audio',name:'Voice note'}];
    c=draft(c);
    assert.equal(c.reviewFlow.needsMaterialReview,true);assert.deepEqual(c.reviewFlow.scope,{approach:'',checks:''});
    assert.throws(()=>share(c),/must contain text/);
    const projected=P.describe(item(c),{actor:'Website team'});
    assert.equal(projected.reasoning.problem.raw,raw);
    assert.ok(projected.reasoning.decisions.every(row=>row.status==='reference-only'||row.superseded));
    assert.equal(projected.preparation.analyzedMedia,false);
    assert.ok(projected.reasoning.facts.some(row=>row.source.type==='attachment'));
    assert.deepEqual(projected.reasoning.implications,[]);
    assert.match(projected.reasoning.teamConsiderations.join(' '),/not established/);
  }
  const ownC=P.describe(item(draft(make('refrigeration','Please change the invoicing page.'))),{actor:'Website team'});
  assert.equal(ownC.reasoning.problem.source.type,'customer-input','A selected reference ticket must not relabel actual user input as a historical reconstruction.');
});

test('compact evidence prioritizes the reported state and exact checked behavior before page identifiers',()=>{
  let c=make('refrigeration');
  c.reviewFlow.context={page:'Refrigeration',quoteId:'Q-19',compartmentId:'compartment-1',selection:{label:'Refrigeration charges'},state:{noRefrigeration:true,savedNoRefrigeration:true,equipment:'Existing equipment',cost:2400}};
  const facts=P.describe(item(c),{actor:'Website team'}).reasoning.facts;
  assert.deepEqual(facts.slice(0,3).map(row=>row.id),['state-noRefrigeration','state-cost','state-equipment']);
  assert.match(facts[0].text,/saved flag: Yes/);
  c=deliver(make());
  c.versions[0].result.checks=c.versions[0].result.checks.split('\n').map(value=>({value}));
  c.versions[0].reviewFlow.questionRounds=[{id:'Q1',round:'initial',scopeCycle:1,answered:true,answerText:'Keep editing this quote',answers:{'next-step':'Keep editing this quote'}}];
  const implication=P.describe(item(c),{actor:'Requester'}).reasoning.implications[0];
  assert.equal(implication.checks.length,1);assert.doesNotMatch(implication.checks[0],/\[object Object\]|,/);
});

test('a new detailed answer invalidates preparation and changes visible implications without confirming the policy',()=>{
  const reselect=answeredPolicy('reselect'),restore=answeredPolicy('restore');
  for(const c of [reselect,restore]){
    assert.equal(c.reviewFlow.planPrepared,false);assert.equal(c.reviewFlow.planPreparation,null);
    assert.equal(c.reviewFlow.phase,'answer-review');assert.equal(c.reviewFlow.candidateDraft,null);
    assert.throws(()=>act(c,'confirm-scope',c.reviewFlow.suggestedScope),/Prepare a current plan draft/);
    const proposed=P.describe(item(c),{actor:'Website team'});
    assert.deepEqual(proposed.basis,[]);assert.equal(proposed.reasoning.implications.length,1);
    assert.equal(proposed.reasoning.implications[0].status,'proposed-pending-team-review');
  }
  const before=clone(restore);let c=draft(restore);
  assert.equal(c.reviewFlow.scope.approach,C.variant('refrigeration','restore').scope.approach);
  assert.equal(c.reviewFlow.planPreparation.conflict,restore.reviewFlow.suggestedScope.conflict);
  assert.equal(c.reviewFlow.phase,'answer-review');assert.equal(c.reviewFlow.scopeDecision,undefined);
  const prepared=P.preparation(item(c),'team-review-pending');
  assert.equal(prepared.teamDraft.approach,C.variant('refrigeration','restore').scope.approach,'Preparation projects the actual drafted policy, not the catalog default.');
  const r=P.describe(item(reselect),{actor:'Website team'}).reasoning.implications[0],s=P.describe(item(restore),{actor:'Website team'}).reasoning.implications[0];
  assert.notDeepEqual(r.behavior,s.behavior);assert.notDeepEqual(r.checks,s.checks);
  assert.deepEqual(restore,before);
  c=share(c);assert.equal(c.reviewFlow.scopeDecision.resolvedBy,'Website team');
});

test('only the exact sent question batch is public and merely closing an unsent detailed draft preserves the confirmed plan',()=>{
  let c=share(draft(make('refrigeration'))),confirmed=clone(c.reviewFlow.planPreparation);
  c=act(c,'begin-detailed-questions');
  assert.equal(P.describe(item(c),{actor:'Website team'}).reasoning.outstanding[0].id,'equipment-return');
  assert.deepEqual(P.describe(item(c),{actor:'Requester'}).reasoning.outstanding,[]);
  c=act(c,'close-questions');assert.deepEqual(c.reviewFlow.planPreparation,confirmed);
  assert.equal(c.reviewFlow.planPrepared,true);c=act(c,'begin-detailed-questions');c=act(c,'preview-questions');
  assert.deepEqual(P.describe(item(c),{actor:'Requester'}).reasoning.outstanding,[]);
  c=act(c,'send-questions');assert.equal(c.reviewFlow.planPrepared,false);
  const publicQuestions=P.describe(item(c),{actor:'Requester'}).reasoning.outstanding;
  assert.equal(publicQuestions[0].id,'equipment-return');assert.equal(publicQuestions[0].round,'detailed');
  assert.equal(publicQuestions[0].source.id,c.reviewFlow.sentBundle.id);
});

test('understanding corrections remain actual evidence and require a fresh team draft without overwriting the raw request',()=>{
  let c=share(draft(make('compartment'))),original=c.text;
  c=act(c,'finish-spec');c=act(c,'prepare-result');
  c=act(c,'correct-understanding',{text:'The second compartment needs a different business name.'});
  assert.equal(c.text,original);assert.equal(c.reviewFlow.planPrepared,false);
  assert.equal(c.reviewFlow.result,null);assert.equal(c.reviewFlow.phase,'triage');
  assert.throws(()=>share(c),/Prepare a current plan draft/);
  const evidence=P.describe(item(c),{actor:'Website team'}).reasoning;
  assert.ok(evidence.facts.some(row=>row.text==='The second compartment needs a different business name.'&&row.source.type==='requester-correction'));
  const next=draft(c);assert.equal(next.reviewFlow.planPreparation.basis.corrections[0].text,'The second compartment needs a different business name.');
});

test('submitted reasoning and plan preparation remain frozen to the exact version after later material and policy changes',()=>{
  let c=answeredPolicy('restore');c=draft(c);c=share(c);c=act(act(act(c,'finish-spec'),'prepare-result'),'deliver');
  const v1=clone(c.versions[0]),historic=P.describe(item(c),{actor:'Requester',rev:1}).reasoning;
  assert.equal(historic.implications[0].supported,true);assert.match(historic.implications[0].behavior.join(' '),/restore/);
  assert.equal(historic.sourceVersion,1);assert.equal(v1.reviewFlow.planPreparation.confirmed,true);
  c=act(c,'adjust',{rev:1,reason:'Use the recorded re-selection policy for this version.'});
  c=act(c,'edit-candidate',C.variant('refrigeration','reselect').scope);
  c.reviewFlow.context={page:'A new live page'};
  c.reviewFlow.attachments=[{id:'later-evidence',kind:'image',name:'Do not substitute into V1'}];
  c=act(act(c,'prepare-result'),'deliver');c=act(c,'accept',{rev:2});c=act(c,'authorize',{rev:2});c=act(c,'publish',{rev:2});
  for(const actor of ['Requester','Website team','Site owner']){
    const now=P.describe(item(c),{actor});assert.equal(now.reasoning.sourceVersion,2);
    assert.match(now.basis[0].source.label,/Submitted V2/);
    assert.match(now.reasoning.implications[0].behavior.join(' '),/select equipment again/);
    assert.match(now.reasoning.implications[0].note,/differs from the answer-derived suggestion/);
  }
  assert.deepEqual(c.versions[0],v1);
  assert.deepEqual(P.describe(item(c),{actor:'Requester',rev:1}).reasoning,historic);
});

test('unflagged legacy reviewed cases keep their original scope and confirmation contract',()=>{
  const c=E.createReviewedCase(C.get('pdf').feedback,{scenarioId:'pdf',journey:true});
  assert.equal(c.reviewFlow.evidenceFirst,undefined);assert.deepEqual(c.reviewFlow.scope,C.get('pdf').scope);
  assert.equal(share(c).reviewFlow.phase,'spec-review');
  assert.throws(()=>draft(c),/evidence-first workflow/);
});

test('evidence-first Create uses the actual concern to draft different candidates and checks while an unfamiliar answer stays with the team',()=>{
  const paths=E.hesitationAnswers.map(answer=>{
    let c=E.createReviewedCase(E.hesitationFeedback,{journey:true,evidenceFirst:true});
    assert.deepEqual(c.reviewFlow.scope,{approach:'',checks:''});
    c=act(c,'draft-questions');c=act(c,'send-questions');
    c=act(c,'answer',{bundleId:c.reviewFlow.sentBundle.id,answers:{clarification:answer}});
    assert.equal(c.reviewFlow.planPrepared,false);assert.equal(c.reviewFlow.candidateDraft,null);
    const p=P.describe(item(c),{actor:'Website team'});
    assert.equal(p.reasoning.implications[0].answer,answer);
    assert.equal(p.reasoning.implications[0].supported,true);
    c=draft(c);return c;
  });
  assert.notEqual(paths[0].reviewFlow.scope.approach,paths[1].reviewFlow.scope.approach);
  assert.notEqual(paths[0].reviewFlow.scope.checks,paths[1].reviewFlow.scope.checks);
  assert.match(paths[0].reviewFlow.scope.approach,/Nothing is sent/);
  assert.match(paths[1].reviewFlow.scope.approach,/template/);
  let unknown=E.createReviewedCase(E.hesitationFeedback,{journey:true,evidenceFirst:true});
  unknown=act(act(unknown,'draft-questions'),'send-questions');
  unknown=act(unknown,'answer',{answers:{clarification:'I need to export an invoice and change its tax rate.'}});
  unknown=draft(unknown);
  assert.deepEqual(unknown.reviewFlow.scope,{approach:'',checks:''});
  assert.equal(P.describe(item(unknown),{actor:'Website team'}).reasoning.implications[0].supported,false);
  assert.throws(()=>share(unknown),/must contain text/);
});
