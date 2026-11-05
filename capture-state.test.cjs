"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");
const C = require("./capture-state.js");
const clone = value => JSON.parse(JSON.stringify(value));
const act = (c,action,value) => E.review(c,action,value);
const submitted = () => C.createCase(E,{text:E.pdfFeedback,when:"earlier-today",includePreview:true});
const item = c => ({id:"WQ-201",c,captureSubmission:true});
const shared = c => act(c,"confirm-scope",{...c.reviewFlow.scope,understanding:"Keep the same quote open while the saved PDF opens separately."});

test("in-context submission retains the actual text and clearly simulated page, quote and reported-time context", () => {
  const draft = {text:"  My quote page moved after I generated the PDF.  ",when:"yesterday",includePreview:true};
  const before = clone(draft), c = C.createCase(E,draft);
  assert.deepEqual(draft,before);
  assert.equal(c.text,"My quote page moved after I generated the PDF.");
  assert.equal(c.stage,"processing");
  assert.equal(c.owner,"Website team");
  assert.equal(c.reviewFlow.phase,"triage");
  assert.equal(c.reviewFlow.journey.enabled,true);
  assert.deepEqual(c.reviewFlow.context,{origin:"business-page-demo",page:"Make PDF",quote:"MW-1042",occurredAt:"Yesterday",previewIncluded:true,simulated:true});
  assert.equal(c.reviewFlow.sentBundle,null);
  assert.equal(C.createCase(E,{text:"Something unclear",when:"made-up-time"}).reviewFlow.context.occurredAt,"");
  assert.throws(()=>C.createCase(E,{text:" "}),/Describe/);
  assert.throws(()=>C.createCase(E,{text:"x".repeat(2001)}),/2,000/);
});

test("private drafts and previews create no customer update, while sending a frozen initial bundle creates one exact answer task", () => {
  let c = submitted();
  assert.deepEqual(C.updates([item(c)]),[]);
  c = act(c,"draft-questions");
  const qs = clone(c.reviewFlow.questionDraft); qs[1].text = "PRIVATE RECORD CHECK"; qs[2].reason = "PRIVATE TECHNICAL NOTE";
  c = act(c,"save-questions",qs); c = act(c,"preview-questions");
  assert.deepEqual(C.updates([item(c)]),[]);
  c = act(c,"send-questions");
  const stateBefore = JSON.stringify(c), updates = C.updates([item(c)]);
  assert.equal(updates.length,1);
  assert.equal(updates[0].key,"WQ-201:Q1");
  assert.equal(updates[0].owner,"You · Requester");
  assert.match(updates[0].label,/initial/i);
  assert.equal(updates[0].read,false);
  assert.doesNotMatch(JSON.stringify(updates),/PRIVATE RECORD|PRIVATE TECHNICAL/);
  assert.equal(JSON.stringify(c),stateBefore);
  const seen = {[updates[0].key]:true};
  assert.equal(C.updates([item(c)],seen)[0].read,true);
  assert.deepEqual(seen,{"WQ-201:Q1":true},"Deriving updates must not consume or rewrite read state.");
});

test("the shared understanding remains an asynchronous readable update while the team prepares the unsent candidate", () => {
  let c = shared(submitted());
  const update = C.updates([item(c)])[0];
  assert.equal(update.key,"WQ-201:U1");
  assert.equal(update.label,"Read understanding");
  assert.equal(update.owner,"Website team","Reading the shared summary does not create a mandatory customer approval gate.");
  const privateDetails = act(c,"begin-detailed-questions");
  const privateUpdate = C.updates([item(privateDetails)])[0];
  assert.equal(privateUpdate.key,update.key,"Drafting a later question batch does not remove the already shared summary.");
  assert.doesNotMatch(JSON.stringify(privateUpdate),/workflow-placement|Where would you expect/);
  for (const action of ["finish-spec","begin-check","prepare-result"]) {
    c = act(c,action);
    const pending = C.updates([item(c)],{[update.key]:true})[0];
    assert.equal(pending.key,update.key);
    assert.equal(pending.read,true);
    assert.equal(pending.label,"Read understanding");
  }
  c = act(c,"correct-understanding",{text:"I want to keep editing this quote afterward."});
  assert.deepEqual(C.updates([item(c)]),[],"A superseded understanding is not presented as a newly agreed plan.");
  c = shared(c);
  assert.equal(C.updates([item(c)],{[update.key]:true})[0].key,"WQ-201:U2");
  assert.equal(C.updates([item(c)],{[update.key]:true})[0].read,false);
});

test("detailed question and submitted-version updates retain distinct identities through browser persistence", () => {
  let c = shared(submitted());
  c = act(act(c,"begin-detailed-questions"),"send-questions");
  const detailed = C.updates([item(c)])[0];
  assert.equal(detailed.key,"WQ-201:Q2");
  assert.match(detailed.label,/detailed/i);
  c = act(c,"answer","At the page footer");
  c = act(c,"confirm-scope",{...c.reviewFlow.suggestedScope,understanding:"Place the optional Workflow action at the footer."});
  c = act(act(act(c,"finish-spec"),"prepare-result"),"deliver");
  const review = C.updates([item(c)])[0];
  assert.equal(review.key,"WQ-201:V1");
  assert.equal(review.owner,"You · Requester");
  assert.equal(review.label,"Review V1");
  const restored = JSON.parse(JSON.stringify({items:[item(c)],seen:{[detailed.key]:true}}));
  assert.deepEqual(C.updates(restored.items,restored.seen),C.updates([item(c)],restored.seen));
  for (const action of ["accept","authorize","publish"]) c = act(c,action,{rev:1});
  const receipt = C.updates([item(c)])[0];
  assert.equal(receipt.key,"WQ-201:receipt-V1");
  assert.equal(receipt.owner,"Complete");
  assert.equal(receipt.label,"View receipt");
});

test("walkthrough copies and ordinary workspace records cannot produce customer capture notifications", () => {
  const c = shared(submitted());
  const notifications = C.updates([
    item(c),
    {id:"WQ-202",c:clone(c)},
    {id:"WQ-203",c:clone(c),captureSubmission:false},
    {id:"WQ-204",c:E.createCase(E.initialFeedback)},
  ]);
  assert.deepEqual(notifications.map(update=>update.id),["WQ-201"]);
});
