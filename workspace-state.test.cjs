"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const E = require("./engine.js");
const Capture = require("./capture-state.js");
const W = require("./workspace-state.js");
const clone = value => JSON.parse(JSON.stringify(value));
function freeze(value) {
  if (value && typeof value==="object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const item = (id,metadata={}) => ({id,c:E.createReviewedCase(E.pdfFeedback),...metadata});

test("migration copies only workspace metadata and preserves legacy cases, current selection, history and unknown fields", () => {
  const original = {current:"WQ-051",serial:71,customSetting:"keep",items:[
    item("WQ-051",{reviewUI:{role:"Requester",drafts:{answer:"My draft"},history:[]}}),
    item("WQ-015"),item("WQ-016"),item("WQ-017"),item("WQ-018"),
    item("WQ-060"),item("WQ-061",{demoOnly:false,submissionOrigin:"customer"}),
  ]};
  original.items[0].c.reviewFlow.context={occurredAt:""};
  const before = clone(original), migrated = W.migrate(freeze(original),{exampleIds:["WQ-060","WQ-061"]});
  assert.deepEqual(original,before);
  assert.notEqual(migrated,original);
  assert.equal(migrated.current,"WQ-051");
  assert.equal(migrated.serial,71);
  assert.equal(migrated.customSetting,"keep");
  assert.equal(migrated.items.length,original.items.length,"Migration does not delete or rewrite old examples");
  migrated.items.forEach((record,i)=>{
    assert.notEqual(record,original.items[i]);
    assert.equal(record.c,original.items[i].c,"The existing CaseEngine record is not regenerated");
    assert.equal(record.clientId,"winquote");
  });
  assert.deepEqual(migrated.items.map(record=>record.demoOnly),[false,true,true,true,true,true,false]);
  assert.deepEqual(migrated.items[0].reviewUI,original.items[0].reviewUI);
  assert.deepEqual(W.migrate(migrated,{exampleIds:["WQ-051"]}),migrated,
    "Customer provenance stays authoritative on subsequent loads");
});

test("actual captures and curated customer records remain visible even when a seed or saved walkthrough id is known", () => {
  const source = {items:[
    item("WQ-015",{captureSubmission:true}),
    item("WQ-071",{captureSubmission:true,curatedDemo:true}),
    item("WQ-072",{curatedDemo:true}),
    item("WQ-073",{captureSubmission:true,demoOnly:true}),
    item("WQ-074",{demoOnly:false,submissionOrigin:"customer"}),
  ]};
  const migrated = W.migrate(source,{exampleIds:["WQ-015","WQ-071","WQ-073","WQ-074"]});
  assert.deepEqual(migrated.items.map(record=>record.demoOnly),[false,false,false,true,false]);
  assert.deepEqual(W.items(migrated).map(record=>record.id),["WQ-015","WQ-071","WQ-072","WQ-074"]);
  assert.equal(migrated.items[1].curatedDemo,true,"Curated describes the presentation, not a non-customer ticket");
  assert.equal(migrated.items[3].demoOnly,true,"Explicit metadata wins over inferred capture classification");
});

test("client scope is explicit and authoritative, with legacy WinQuote fallback and no inference from ticket prefixes or context", () => {
  const source = {items:[
    item("WQ-081",{captureSubmission:true}),
    item("WQ-082",{clientId:"other-client",demoOnly:false}),
    item("OTHER-083",{clientId:"winquote",submissionOrigin:"customer"}),
    item("WQ-084",{clientId:""}),
    item("WQ-085",{clientId:null}),
  ]};
  source.items[1].c.reviewFlow.context={clientId:"winquote"};
  const before = clone(source), migrated = W.migrate(freeze(source));
  assert.deepEqual(source,before);
  assert.deepEqual(W.items(migrated).map(record=>record.id),["WQ-081","OTHER-083"]);
  assert.deepEqual(W.items(migrated.items,"other-client").map(record=>record.id),["WQ-082"]);
  assert.equal(migrated.items[3].clientId,"");
  assert.equal(migrated.items[4].clientId,null);
  assert.equal(migrated.items[1].demoOnly,false,"This client’s migration does not reclassify explicit metadata belonging to another client");
  assert.deepEqual(W.items(migrated,"missing-client"),[]);
  assert.deepEqual(W.items(null),[]);
});

test("unproven old examples are retained as unassigned even if an earlier migration inferred demoOnly false", () => {
  const workspace = {current:"WQ-131",serial:140,items:[
    item("WQ-131"),
    item("WQ-132",{demoOnly:false}),
    {id:"WQ-133",c:E.createCase("A legacy manual request"),demoOnly:false},
    item("WQ-134",{submissionOrigin:"customer",demoOnly:false}),
    item("WQ-135",{submissionOrigin:"example",captureSubmission:true}),
    item("WQ-136"),
  ]};
  workspace.items[5].c.reviewFlow.context={occurredAt:"Yesterday"};
  const before = clone(workspace), migrated = W.migrate(freeze(workspace));
  assert.deepEqual(workspace,before);
  assert.equal(migrated.items.length,6);
  assert.equal(migrated.current,"WQ-131","Migration preserves selection for the host to resolve without deleting any case");
  assert.deepEqual(W.items(migrated).map(record=>record.id),["WQ-134","WQ-136"]);
  assert.deepEqual(migrated.items.filter(record=>record.legacyUnassigned).map(record=>record.id),["WQ-131","WQ-132","WQ-133"]);
  assert.equal(migrated.items[4].demoOnly,true,"An explicitly started example is not promoted by inherited context");
  migrated.items.forEach((record,i)=>assert.deepEqual(record.c,workspace.items[i].c));
  assert.deepEqual(W.migrate(migrated),migrated);
  const recovered = W.migrate({...migrated,items:migrated.items.map(record=>record.id==="WQ-131"?{...record,submissionOrigin:"customer"}:record)});
  assert.equal(recovered.items[0].demoOnly,false);
  assert.equal(recovered.items[0].legacyUnassigned,false);
});

test("customer update counts can be scoped to this client without losing curated submissions or exposing examples and other clients", () => {
  let c = Capture.createCase(E,{text:E.pdfFeedback,when:"just-now",includePreview:true});
  c = E.review(E.review(c,"draft-questions"),"send-questions");
  const workspace = W.migrate({items:[
    {id:"WQ-091",c,captureSubmission:true,curatedDemo:true},
    {id:"WQ-092",c,captureSubmission:true,clientId:"other-client"},
    {id:"WQ-093",c,captureSubmission:true,demoOnly:true},
    {id:"WQ-094",c,demoOnly:true},
  ]});
  const before = JSON.stringify(workspace);
  const updates = Capture.updates(W.items(workspace),{"WQ-091:Q1":true});
  assert.equal(updates.length,1);
  assert.equal(updates[0].id,"WQ-091");
  assert.equal(updates[0].owner,"You · Requester");
  assert.equal(updates[0].read,true);
  assert.deepEqual(Capture.updates(W.items(workspace,"other-client")).map(update=>update.id),["WQ-092"]);
  assert.equal(JSON.stringify(workspace),before);
});

test("a saved walkthrough resumes only an existing same-client ticket and an optional exact ticket constraint", () => {
  const records = [item("WQ-101"),item("WQ-102",{clientId:"other-client"}),item("WQ-103",{demoOnly:true})];
  assert.equal(W.canResume("WQ-101","winquote",records),true);
  assert.equal(W.canResume("WQ-101","winquote",{items:records},"WQ-101"),true);
  assert.equal(W.canResume("WQ-101","winquote",records,"WQ-103"),false);
  assert.equal(W.canResume("WQ-102","winquote",records),false);
  assert.equal(W.canResume("WQ-102","other-client",records),true);
  assert.equal(W.canResume("WQ-103","winquote",records),true,
    "Legacy example routes remain resumable from the launcher even though customer lists exclude them");
  assert.equal(W.canResume("missing","winquote",records),false);
  assert.equal(W.canResume(null,"winquote",records),false);
  assert.equal(W.canResume("WQ-101","winquote",[]),false);
});

test("a curated dock cannot claim a different, missing, ordinary or other-client current ticket", () => {
  const record = item("WQ-111",{clientId:"winquote",curatedDemo:true,captureSubmission:true});
  const state = {id:record.id,c:clone(record.c)};
  const before = clone({state,record});
  freeze(state); freeze(record);
  assert.equal(W.canResumeShowcase(state,record,"WQ-111"),true);
  assert.equal(W.canResumeShowcase(state,record,"WQ-112"),false,
    "An old cached demo is not the continuation of the newly selected ticket");
  assert.equal(W.canResumeShowcase(state,null,"WQ-111"),false,
    "A cached case must not resurrect a missing workspace record");
  assert.equal(W.canResumeShowcase(state,{...record,curatedDemo:false},"WQ-111"),false,
    "A reused id on ordinary feedback is not enough to bind the curated session");
  assert.equal(W.canResumeShowcase(state,{...record,clientId:"other-client"},"WQ-111"),false);
  assert.equal(W.canResumeShowcase({...state,clientId:"other-client"},record,"WQ-111"),false);
  assert.equal(W.canResumeShowcase({...state,id:"WQ-110"},record,"WQ-111"),false);
  assert.equal(W.canResumeShowcase({id:"WQ-111",c:null},record,"WQ-111"),false);
  assert.deepEqual({state,record},before);
});

test("the metadata helper exposes the same browser and Node API without DOM or storage dependencies", () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(require.resolve("./workspace-state.js"),"utf8"),context);
  assert.deepEqual(Object.keys(context.WorkspaceState).sort(),Object.keys(W).sort());
  const migrated = context.WorkspaceState.migrate({items:[{id:"WQ-120",captureSubmission:true},{id:"WQ-121",clientId:"other-client"}]});
  assert.deepEqual(Array.from(context.WorkspaceState.items(migrated),record=>record.id),["WQ-120"]);
  assert.equal(context.WorkspaceState.canResume("WQ-121","winquote",migrated.items),false);
});
