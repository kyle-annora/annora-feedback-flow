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
  const unrelated=act(make('refrigeration','Please change the invoicing page.'),'draft-questions');
  assert.equal(unrelated.reviewFlow.questionDraft.some(q=>q.id==='equipment-return'),false,'An unrelated input cannot inherit the selected reference case’s question preset.');
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

function initialPolicy(answer){
  let c=act(make('refrigeration'),'draft-questions');
  c=act(c,'preview-questions');c=act(c,'send-questions');
  return act(c,'answer',{bundleId:c.reviewFlow.sentBundle.id,answers:{'equipment-return':answer}});
}

test('the explicit first-review Ask action offers a private equipment-return preset before any plan is shared',()=>{
  const initial=make('refrigeration'),before=clone(initial);
  assert.equal(initial.reviewFlow.questionDraft.some(q=>q.disposition==='ask'),false);
  let c=act(initial,'draft-questions');
  assert.deepEqual(initial,before);assert.deepEqual(c.reviewFlow.scope,{approach:'',checks:''});
  const preset=c.reviewFlow.questionDraft.find(q=>q.id==='equipment-return');
  assert.equal(preset.type,'single');assert.equal(preset.disposition,'ask');
  assert.deepEqual(preset.optionIds,['reselect','restore','unsure']);
  assert.equal(c.reviewFlow.sharedUnderstanding,null);assert.equal(c.reviewFlow.confirmedScope,null);
  assert.equal(c.reviewFlow.planPrepared,false);assert.equal(c.reviewFlow.sentBundle,null);
  assert.deepEqual(P.describe(item(c),{actor:'Requester'}).reasoning.outstanding,[]);
  c=act(c,'preview-questions');assert.equal(c.reviewFlow.sentBundle,null);
  assert.deepEqual(c.reviewFlow.questionPreview.questions.map(q=>q.id),['equipment-return']);
  assert.deepEqual(P.describe(item(c),{actor:'Requester'}).questionRounds,[]);
  assert.equal(c.trail.some(event=>event.action==='confirm-scope'),false);
  c=act(c,'send-questions');
  assert.equal(c.reviewFlow.sentBundle.id,'Q1');assert.equal(c.reviewFlow.sentBundle.round,'initial');
  assert.equal(c.reviewFlow.sharedUnderstanding,null);assert.equal(c.reviewFlow.confirmedScope,null);
  assert.equal(c.trail.some(event=>event.action==='confirm-scope'),false);
  assert.deepEqual(c.reviewFlow.sentBundle.questions.map(q=>q.id),['equipment-return']);
  assert.throws(()=>act(c,'answer',{bundleId:'Q2',answers:{'equipment-return':'restore'}}),/current sent question bundle/);
  const zero=deliver(make('refrigeration'));
  assert.equal(zero.versions[0].reviewFlow.questionRounds.length,0);
  assert.equal(zero.versions[0].reviewFlow.sentBundle,null);
});

test('initial A and B answers produce distinct policy drafts, checks and conflict while remaining explicit team decisions',()=>{
  const branches=[initialPolicy('reselect'),initialPolicy('restore')];
  for(const [index,c] of branches.entries()){
    assert.equal(c.reviewFlow.phase,'answer-review');assert.equal(c.reviewFlow.planPrepared,false);
    assert.equal(c.reviewFlow.sharedUnderstanding,null);assert.equal(c.reviewFlow.candidateDraft,null);
    assert.equal(c.reviewFlow.scopeDecision,undefined);
    assert.equal(c.reviewFlow.suggestedScope.variantId,index?'restore':'reselect');
    assert.equal(c.reviewFlow.questionRounds[0].round,'initial');
    assert.equal(c.reviewFlow.detailedAnswerText,'');
    assert.equal(c.answer,index?'Restore the previous equipment selection':'Select equipment again');
    assert.throws(()=>act(c,'confirm-scope',c.reviewFlow.suggestedScope),/Prepare a current plan draft/);
    const implication=P.describe(item(c),{actor:'Website team'}).reasoning.implications[0];
    assert.equal(implication.supported,true);assert.equal(implication.source.id,'Q1');
    assert.match(implication.source.label,/Initial answer/);
    assert.equal(implication.status,'proposed-pending-team-review');
    const prepared=draft(c);assert.equal(prepared.reviewFlow.scope.approach,c.reviewFlow.suggestedScope.approach);
    assert.equal(prepared.reviewFlow.sharedUnderstanding,null);
    const confirmed=share(prepared);
    if(index)assert.equal(confirmed.reviewFlow.scopeDecision.resolvedBy,'Website team');
  }
  assert.notEqual(branches[0].reviewFlow.suggestedScope.approach,branches[1].reviewFlow.suggestedScope.approach);
  assert.notEqual(branches[0].reviewFlow.suggestedScope.checks,branches[1].reviewFlow.suggestedScope.checks);
  assert.equal(branches[0].reviewFlow.suggestedScope.conflict,null);
  assert.match(branches[1].reviewFlow.suggestedScope.conflict,/differs from the recorded/);
});

test('Back and reopen preserve edited or removed initial presets, and manual additional questions remain available',()=>{
  let c=act(make('refrigeration'),'draft-questions');
  c=act(c,'save-questions',c.reviewFlow.questionDraft.map(q=>q.id==='equipment-return'?{...q,reason:'The current quote needs an explicit business preference.'}:q));
  const saved=clone(c.reviewFlow.questionDraft);
  c=act(c,'close-questions');assert.equal(c.reviewFlow.phase,'triage');
  c=act(c,'draft-questions');assert.deepEqual(c.reviewFlow.questionDraft,saved);
  c=act(c,'save-questions',c.reviewFlow.questionDraft.filter(q=>q.id!=='equipment-return'));
  c=act(act(c,'close-questions'),'draft-questions');
  assert.equal(c.reviewFlow.questionDraft.some(q=>q.id==='equipment-return'),false,'Reopening must not resurrect a deliberately deleted preset.');
  const manual={id:'quote-owner',text:'Who should review this quote?',type:'text',options:[],required:true,disposition:'ask',reason:'Only the customer can identify the reviewer.'};
  c=act(c,'save-questions',[...c.reviewFlow.questionDraft,manual]);
  c=act(c,'send-questions');assert.deepEqual(c.reviewFlow.sentBundle.questions.map(q=>q.id),['quote-owner']);
  c=act(c,'answer',{answers:{'quote-owner':'The purchasing manager.'}});
  assert.equal(c.reviewFlow.suggestedScope.decisionRequired,true);
  assert.equal(c.reviewFlow.suggestedScope.variantId,undefined);
  assert.deepEqual(c.reviewFlow.scope,{approach:'',checks:''});
});

test('editing the preset answer contract cannot reinterpret an unrelated initial answer as a known policy',()=>{
  let c=act(make('refrigeration'),'draft-questions');
  c=act(c,'save-questions',c.reviewFlow.questionDraft.map(q=>q.id==='equipment-return'?{...q,type:'text',options:[],optionIds:[]}:q));
  c=act(c,'send-questions');c=act(c,'answer',{answers:{'equipment-return':'Select equipment again'}});
  assert.equal(c.reviewFlow.suggestedScope.variantId,undefined);
  assert.equal(c.reviewFlow.suggestedScope.decisionRequired,true);
  assert.match(c.reviewFlow.suggestedScope.reason,/edited sent question/);
  assert.equal(P.describe(item(c),{actor:'Website team'}).reasoning.implications[0].supported,false);
});

test('changing the meaning of the question with the same options stays manual, while reason-only and normalized-copy edits retain the authored mapping',()=>{
  for(const questionText of ['Which of these should we NOT do if refrigeration is needed again?','Which equipment policy does the customer reject?']){
    let c=act(make('refrigeration'),'draft-questions');
    c=act(c,'save-questions',c.reviewFlow.questionDraft.map(q=>q.id==='equipment-return'?{...q,text:questionText}:q));
    c=act(c,'send-questions');c=act(c,'answer',{answers:{'equipment-return':'restore'}});
    assert.equal(c.reviewFlow.suggestedScope.variantId,undefined);
    assert.equal(c.reviewFlow.suggestedScope.decisionRequired,true);
    assert.equal(P.describe(item(c),{actor:'Website team'}).reasoning.implications[0].supported,false);
  }
  let c=act(make('refrigeration'),'draft-questions');
  c=act(c,'save-questions',c.reviewFlow.questionDraft.map(q=>q.id==='equipment-return'?{...q,text:'  '+q.text.toUpperCase().replace(/ /g,'  ')+'  ',reason:'We need your preference for this current quote before changing the recorded policy.'}:q));
  c=act(c,'send-questions');c=act(c,'answer',{answers:{'equipment-return':'restore'}});
  assert.equal(c.reviewFlow.suggestedScope.variantId,'restore');
  assert.match(c.reviewFlow.suggestedScope.conflict,/differs from the recorded/);
  assert.equal(P.describe(item(c),{actor:'Website team'}).reasoning.implications[0].supported,true);
});

test('the same answered initial preset becomes records in the detailed round rather than an automatic repeated customer task',()=>{
  let c=share(draft(initialPolicy('restore'))),answer=clone(c.reviewFlow.questionRounds[0]);
  c=act(c,'begin-detailed-questions');
  const preset=c.reviewFlow.questionDraft.find(q=>q.id==='equipment-return');
  assert.equal(preset.disposition,'records');assert.match(preset.reason,/Already answered in Q1: Restore/);
  assert.throws(()=>act(c,'preview-questions'),/at least one customer question/);
  assert.throws(()=>act(c,'send-questions'),/at least one customer question/);
  c=act(c,'close-questions');assert.equal(c.reviewFlow.phase,'spec-review');
  assert.deepEqual(c.reviewFlow.questionRounds[0],answer);
  c=act(c,'correct-understanding',{text:'This is a different business requirement; please revisit the equipment-return choice.'});
  c=act(c,'draft-questions');
  assert.equal(c.reviewFlow.questionDraft.find(q=>q.id==='equipment-return').disposition,'ask','A genuinely revised scope cycle may reopen the decision.');
});

test('first-sent detailed Q1 and persisted old Q2 keep their true identities without renumbering history',()=>{
  let c=act(share(draft(make('refrigeration'))),'begin-detailed-questions');
  c=act(c,'send-questions');assert.equal(c.reviewFlow.sentBundle.id,'Q1');assert.equal(c.reviewFlow.sentBundle.round,'detailed');
  // Represent a previously saved record whose old implementation allocated Q2.
  c.reviewFlow.sentBundle.id='Q2';c.reviewFlow.questionRounds[0].id='Q2';
  c=act(c,'answer',{bundleId:'Q2',answers:{'equipment-return':'restore'}});
  c=share(draft(c));const priorRound=clone(c.reviewFlow.questionRounds[0]);
  c=act(c,'correct-understanding',{text:'Please review whether this policy applies to the revised quote.'});
  c=act(act(c,'draft-questions'),'send-questions');
  assert.equal(c.reviewFlow.sentBundle.id,'Q3');
  assert.deepEqual(c.reviewFlow.questionRounds[0],priorRound);
  assert.equal(c.reviewFlow.questionRounds[1].round,'initial');
});

test('a version submitted from first-review clarification freezes its initial answer and exact derived acceptance basis',()=>{
  let c=initialPolicy('restore');c=share(draft(c));
  c=act(act(act(c,'finish-spec'),'prepare-result'),'deliver');
  const v1=clone(c.versions[0]),basis=P.describe(item(c),{actor:'Requester',rev:1}).reasoning;
  assert.equal(v1.reviewFlow.sharedUnderstanding.sourceAnswers.initial,'Restore the previous equipment selection');
  assert.equal(v1.reviewFlow.sharedUnderstanding.sourceAnswers.detailed,'');
  assert.equal(v1.reviewFlow.questionRounds[0].id,'Q1');assert.equal(v1.reviewFlow.questionRounds[0].round,'initial');
  assert.ok(v1.checks.every(row=>row.sourceLabel==='Requester’s answer'));
  assert.match(basis.implications[0].source.label,/Q1 · Initial answer/);
  assert.match(basis.implications[0].behavior[0],/restore/);assert.match(basis.implications[0].checks[0],/restores/);
  c=act(c,'adjust',{rev:1,reason:'Use the delete-and-reselect policy instead for V2.'});
  c=act(c,'edit-candidate',C.variant('refrigeration','reselect').scope);
  c=act(act(c,'prepare-result'),'deliver');
  assert.deepEqual(c.versions[0],v1);
  assert.deepEqual(P.describe(item(c),{actor:'Requester',rev:1}).reasoning,basis);
  const current=P.describe(item(c),{actor:'Requester'}).reasoning;
  assert.equal(current.sourceVersion,2);assert.match(current.implications[0].behavior[0],/select equipment again/);
  assert.match(current.implications[0].note,/differs from the answer-derived suggestion/);
});
