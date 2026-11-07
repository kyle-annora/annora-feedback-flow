"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const E=require("./engine.js");
const S=require("./scenario-catalog.js");
const P=require("./feedback-presentation.js");
const clone=value=>JSON.parse(JSON.stringify(value));
const act=(c,action,value)=>E.review(c,action,value);
const question=c=>c.reviewFlow.questionDraft.find(q=>q.id==="equipment-return");
const wording="After trying V1, what should happen when you uncheck No Refrigeration Required and save?";
const initial=()=>act(E.createReviewedCase(S.get("refrigeration").feedback,{scenarioId:"refrigeration",journey:true,evidenceFirst:true}),"draft-questions");
const edit=(c,patch)=>act(c,"save-questions",c.reviewFlow.questionDraft.map(q=>q.id==="equipment-return"?{...q,...patch}:q));
const confirm=c=>act(c,"confirm-question-meaning",{questionId:"equipment-return",questionText:question(c).text});
const answer=(c,value,note)=>act(act(act(c,"preview-questions"),"send-questions"),"answer",{answers:{"equipment-return":value},...(note?{notes:{"equipment-return":note}}:{})});
function deliver(c){
  c=act(c,"draft-plan");
  c=act(c,"confirm-scope",c.reviewFlow.scope);
  return act(act(act(c,"finish-spec"),"prepare-result"),"deliver");
}
const item=c=>({id:"WQ-021",c,ux:{}});

test("a reworded question maps both policy choices only after an explicit team meaning confirmation",()=>{
  const draft=edit(initial(),{text:wording});
  const meaning=S.questionMeaning("refrigeration",question(draft));
  assert.equal(meaning.eligible,true);
  assert.equal(meaning.original,false);
  assert.equal(meaning.confirmed,false);
  assert.equal(answer(draft,"restore").reviewFlow.suggestedScope.decisionRequired,true);
  const reviewed=confirm(draft);
  assert.equal(S.questionMeaning("refrigeration",question(reviewed)).confirmed,true);
  assert.equal(reviewed.reviewFlow.phase,"question-draft");
  assert.equal(reviewed.reviewFlow.sentBundle,null,"Confirming meaning does not send or create a customer task.");
  assert.equal(reviewed.reviewFlow.questionPreview,null,"The customer preview follows this separate confirmation.");
  assert.equal(question(draft).simulationMeaning,undefined,"The action must not mutate its input draft.");
  for(const policy of ["reselect","restore"]){
    const answered=answer(reviewed,policy);
    assert.equal(answered.reviewFlow.suggestedScope.variantId,policy);
    assert.equal(answered.reviewFlow.suggestedScope.decisionRequired,false);
    assert.equal(answered.reviewFlow.sentBundle.questions[0].text,wording);
    assert.equal(answered.reviewFlow.sentBundle.questions[0].simulationMeaning.confirmedBy,"Website team");
    const implication=P.describe(item(answered),{actor:"Website team"}).reasoning.implications[0];
    assert.equal(implication.supported,true);
    assert.match(implication.behavior.join(" "),policy==="restore"?/restore that prior selection/:/select equipment again; removed equipment is not restored/);
    assert.match(implication.checks.join(" "),policy==="restore"?/restores the prior equipment selection/:/requires selecting equipment again/);
    if(policy==="restore")assert.match(implication.conflict,/differs from the recorded/);
  }
});

test("meaning confirmation is bound to exact wording and stable choices, and arbitrary metadata cannot create approval",()=>{
  const reviewed=confirm(edit(initial(),{text:wording}));
  const proof=clone(question(reviewed).simulationMeaning);
  assert.equal(S.questionMeaning("refrigeration",question(edit(reviewed,{reason:"A clearer explanation of the same equipment choice."}))).confirmed,true);
  for(const patch of [
    {text:"Which equipment policy should we NOT use?"},
    {type:"text",options:[],optionIds:[]},
    {options:["Never restore any equipment","Restore the previous equipment selection","I'm not sure"]},
    {optionIds:["restore","reselect","unsure"]},
  ]){
    const changed=edit(reviewed,patch);
    assert.equal(question(changed).simulationMeaning,undefined);
    assert.equal(S.matchesQuestion("refrigeration",question(changed)),false);
  }
  const forged=edit(edit(initial(),{text:wording}),{simulationMeaning:proof});
  assert.equal(question(forged).simulationMeaning,undefined,"Saving a caller-supplied proof cannot replace the team confirmation action.");
  assert.equal(S.matchesQuestion("refrigeration",question(forged)),false);
  const wrongOptions=edit(reviewed,{options:["A","B","C"]});
  assert.throws(()=>confirm(wrongOptions),/supported single-choice options/);
  const changedType=edit(reviewed,{type:"text",options:[],optionIds:[]});
  assert.throws(()=>confirm(changedType),/supported single-choice options/);
  assert.throws(()=>act(reviewed,"confirm-question-meaning",{questionId:"equipment-return",questionText:"Earlier wording"}),/current saved question wording/);
  assert.throws(()=>act(reviewed,"confirm-question-meaning",{questionId:"refrigeration-state"}),/supported single-choice options/);
  const sent=act(act(reviewed,"preview-questions"),"send-questions");
  assert.throws(()=>confirm(sent),/unavailable at this step/);
  assert.equal(S.matchesQuestion("refrigeration",{...question(reviewed),options:["Changed",...question(reviewed).options.slice(1)]}),false,"A stale optionSnapshots array cannot override edited labels.");
});

test("uncertainty, additional requirements and notes still require a team decision after meaning confirmation",()=>{
  const reviewed=confirm(edit(initial(),{text:wording}));
  for(const [value,note] of [["unsure",null],["restore","Restore it, but never include its price in the total."]]){
    const c=answer(reviewed,value,note);
    assert.equal(c.reviewFlow.suggestedScope.decisionRequired,true);
    assert.equal(c.reviewFlow.suggestedScope.variantId,undefined);
    assert.equal(P.describe(item(c),{actor:"Website team"}).reasoning.implications[0].supported,false);
  }
  assert.throws(()=>answer(reviewed,"an unknown answer"),/sent answer option/);
  const additional={id:"extra",text:"What else needs to change?",type:"text",options:[],required:true,disposition:"ask",reason:"Additional scope."};
  let c=act(reviewed,"save-questions",[...reviewed.reviewFlow.questionDraft,additional]);
  c=act(c,"send-questions");
  c=act(c,"answer",{answers:{"equipment-return":"restore",extra:"Email this quote automatically."}});
  assert.equal(c.reviewFlow.suggestedScope.decisionRequired,true);
  assert.equal(c.reviewFlow.suggestedScope.variantId,undefined);
});

test("edited Q2 and its confirmed answer-to-policy binding freeze in V2 without changing V1",()=>{
  let c=deliver(answer(initial(),"reselect"));
  const v1=clone(c.versions[0]);
  c=act(c,"adjust",{rev:1,reason:"When refrigeration is needed again, please restore the previous equipment selection."});
  c=act(c,"reopen-clarification");
  c=confirm(edit(c,{text:wording}));
  c=answer(c,"restore");
  assert.equal(c.reviewFlow.sentBundle.id,"Q2");
  assert.equal(c.reviewFlow.sentBundle.scopeCycle,2);
  assert.deepEqual(c.versions[0],v1);
  c=deliver(c);
  assert.equal(c.rev,2);
  assert.deepEqual(c.versions[0],v1,"The exact frozen V1 object survives drafting, clarification and V2 delivery.");
  const v2=c.versions[1], q2=v2.reviewFlow.questionRounds.find(r=>r.id==="Q2");
  assert.equal(q2.questions[0].text,wording);
  assert.equal(q2.questions[0].simulationMeaning.questionText,wording);
  assert.equal(q2.answers["equipment-return"],"Restore the previous equipment selection");
  assert.match(v2.candidate,/restore that prior selection/);
  assert.equal(E.reviewPreview(v2).configuration.policy,"restore");
  assert.equal(E.reviewPreview(v1).configuration.policy,"reselect");
  const historical=P.describe(item(c),{actor:"Requester",rev:1});
  const live=P.describe(item(c),{actor:"Requester"});
  assert.match(historical.reasoning.implications[0].answer,/Select equipment again/);
  assert.match(historical.reasoning.implications[0].checks.join(" "),/requires selecting equipment again/);
  assert.match(live.reasoning.implications[0].answer,/Restore the previous equipment selection/);
  assert.match(live.reasoning.implications[0].checks.join(" "),/restores the prior equipment selection/);
  assert.equal(c.accepted,null);
  assert.equal(c.authorization,null);
});
