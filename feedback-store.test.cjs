"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const S = require("./feedback-store.js");
const C = require("./scenario-catalog.js");
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze);Object.freeze(value); } return value; };
const payload = (scenario="pdf",captureId="capture-test") => ({text:C.get(scenario).feedback,captureId,context:{page:C.get(scenario).target,quote:"DEMO-102"},attachments:[],occurredAt:"Just now"});
const add = (data=S.migrate(null),scenario="pdf",captureId="capture-test",options={}) => S.add(data,C.get(scenario),payload(scenario,captureId),options);
const command = (data,id,actor,action,value,extra={}) => S.commit(data,id,{expectedSequence:S.get(data,id)?.sequence ?? 0,actor,action,value,...extra});
function review(scenario="pdf") {
  let {data,item} = add(S.migrate(null),scenario);
  const id = item.id;
  ({data,item}=command(data,id,"Website team","confirm-scope",item.c.reviewFlow.scope));
  ({data,item}=command(data,id,"Website team","finish-spec"));
  ({data,item}=command(data,id,"Website team","prepare-result"));
  return command(data,id,"Website team","deliver");
}
const businessQuestion = {id:"business",text:"Which outcome do you need?",type:"single",options:["A","B","Other"],optionIds:["a","b","other"],required:true,disposition:"ask",reason:"Resolve an actual missing business decision."};
function sentQuestion() {
  let {data,item} = add();const id=item.id;
  ({data,item}=command(data,id,"Website team","draft-questions"));
  ({data,item}=command(data,id,"Website team","save-questions",[businessQuestion]));
  return command(data,id,"Website team","send-questions");
}

test("canonical commits mutate only the specified ticket, increment a sequence independently of the business version and reject stale/role actions", () => {
  const a = add(), b = add(a.data,"compartment","capture-b"), untouched = clone(b.item);
  const before = JSON.stringify(b.data), first = S.get(b.data,a.item.id);
  const changed = command(freeze(b.data),first.id,"Website team","confirm-scope",first.c.reviewFlow.scope);
  assert.equal(JSON.stringify(b.data),before);
  assert.equal(changed.data.current,first.id);
  assert.equal(changed.item.id,first.id);
  assert.equal(changed.item.sequence,first.sequence+1);
  assert.equal(changed.item.c.rev,first.c.rev);
  assert.deepEqual(S.get(changed.data,b.item.id),untouched);
  assert.throws(()=>S.commit(changed.data,first.id,{expectedSequence:first.sequence,actor:"Website team",action:"finish-spec"}),/changed.*latest version/);
  assert.throws(()=>command(changed.data,first.id,"Requester","finish-spec"),/different role/);
  assert.throws(()=>command(changed.data,first.id,"Site owner","finish-spec"),/different role/);
  assert.throws(()=>command(changed.data,"missing","Website team","finish-spec"),/not available/);
});

test("capture retry is idempotent and returns that exact ticket even when a different ticket is current", () => {
  const first = add(), second = add(first.data,"compartment","capture-second"), before=JSON.stringify(second.data);
  const retried = add(freeze(second.data));
  assert.equal(JSON.stringify(second.data),before);
  assert.equal(retried.duplicate,true);
  assert.equal(retried.data.items.length,2);
  assert.equal(retried.item.id,first.item.id);
  assert.deepEqual(retried.item.c,first.item.c);
  assert.equal(retried.data.current,first.item.id,"A submission receipt and the visible current ticket must refer to the same request.");
});

test("draft and unsent preview actions produce no customer notification; only the frozen screened batch becomes an answer task", () => {
  let {data,item} = add();const id=item.id;
  ({data,item}=command(data,id,"Website team","draft-questions"));
  assert.deepEqual(S.updates(data),[]);
  const privateQ={...businessQuestion,id:"technical",text:"A private implementation check",disposition:"team"};
  ({data,item}=command(data,id,"Website team","save-questions",[businessQuestion,privateQ]));
  ({data,item}=command(data,id,"Website team","preview-questions"));
  assert.deepEqual(S.updates(data),[]);
  const sent=command(data,id,"Website team","send-questions"),updates=S.updates(sent.data);
  assert.equal(updates.length,1);
  assert.equal(updates[0].ticketId,id);
  assert.equal(updates[0].bundleId,sent.item.c.reviewFlow.sentBundle.id);
  assert.equal(updates[0].recipient,"Requester");
  assert.deepEqual(sent.item.c.reviewFlow.sentBundle.questions.map(q=>q.id),["business"]);
  assert.equal(S.status(sent.item).owner,"Requester");
});

test("reading a notification does not answer, accept or authorize; answering returns to the same canonical ticket and invalidates the old question action", () => {
  const sent=sentQuestion(),id=sent.item.id,event=S.updates(sent.data)[0],before=clone(sent.item.c);
  const read=S.markRead(freeze(sent.data),event.id);
  assert.deepEqual(S.get(read,id).c,before);
  assert.equal(S.updates(read)[0].read,true);
  assert.equal(S.resolve(read,id,event.id).stale,false);
  const answered=command(read,id,"Requester","answer",{bundleId:event.bundleId,answers:{business:"a"}});
  assert.equal(answered.item.id,id);
  assert.equal(answered.item.c.reviewFlow.answers.business,"A");
  assert.equal(answered.item.c.reviewFlow.phase,"answer-review");
  assert.equal(answered.item.c.accepted,null);
  assert.equal(answered.item.c.authorization,null);
  const returned=S.resolve(answered.data,id,event.id);
  assert.equal(returned.stale,true);
  assert.match(returned.message,/answered or replaced/);
  assert.equal(returned.item.id,id);
  assert.throws(()=>command(answered.data,id,"Requester","answer",{bundleId:event.bundleId,answers:{business:"b"}}),/unavailable/);
});

test("old review links cannot revive V1 decisions after a genuine V2 draft/delivery and role guards keep authorization separate", () => {
  let {data,item}=review("compartment");const id=item.id,v1=clone(item.c.versions[0]),event=S.updates(data).find(e=>e.action==="deliver");
  ({data,item}=command(data,id,"Requester","adjust",{rev:1,reason:"Repeat the compartment number on every section header."}));
  ({data,item}=command(data,id,"Website team","edit-candidate",C.variant("compartment","section-labels").scope));
  ({data,item}=command(data,id,"Website team","prepare-result"));
  ({data,item}=command(data,id,"Website team","deliver"));
  assert.equal(S.resolve(data,id,event.id).stale,true);
  assert.match(S.resolve(data,id,event.id).message,/current V2/);
  assert.deepEqual(item.c.versions[0],v1);
  assert.throws(()=>command(data,id,"Requester","accept",{rev:1}),/exact current/);
  assert.throws(()=>command(data,id,"Website team","accept",{rev:2}),/different role/);
  ({data,item}=command(data,id,"Requester","accept",{rev:2}));
  assert.equal(item.c.authorization,null);
  assert.equal(S.status(item).owner,"Site owner");
  assert.throws(()=>command(data,id,"Requester","authorize",{rev:2}),/different role/);
  assert.throws(()=>command(data,id,"Website team","publish",{rev:2}),/accepted and authorized/);
  ({data,item}=command(data,id,"Site owner","authorize",{rev:2}));
  assert.equal(S.status(item).owner,"Website team");
  ({data,item}=command(data,id,"Website team","publish",{rev:2}));
  assert.equal(item.c.receipt.rev,2);
  assert.equal(S.status(item).owner,"Complete");
  assert.deepEqual(item.c.versions[0],v1);
});

test("customer lists and Updates use the same client/provenance scope while legacy records and unknown metadata are preserved", () => {
  const own=review(),example=add(own.data,"compartment","example",{example:true}),foreign=clone(own.item);
  foreign.id="foreign-only";foreign.clientId="other-client";foreign.ux.events=foreign.ux.events.map(e=>({...e,id:"other:"+e.id,ticketId:foreign.id}));
  const oldUnknown={id:"WQ-099",c:clone(own.item.c),someOldMetadata:{preserve:true}};
  const data=S.migrate({...example.data,items:[...example.data.items,foreign,oldUnknown]});
  assert.deepEqual(S.customerItems(data).map(i=>i.id),[own.item.id]);
  assert.ok(S.updates(data).every(e=>e.ticketId===own.item.id));
  assert.equal(S.get(data,foreign.id),undefined);
  const old=data.items.find(i=>i.id===oldUnknown.id);
  assert.equal(old.legacyUnassigned,true);assert.equal(old.demoOnly,true);
  assert.deepEqual(old.c,oldUnknown.c);assert.deepEqual(old.someOldMetadata,{preserve:true});
  assert.equal(old.sequence,0);
  const missing=S.resolve(data,"not-here","fake-event");
  assert.equal(missing.missing,true);
});

test("client matching is applied to the returned record itself, not merely another record with the same id", () => {
  const own=add(),foreign={...clone(own.item),clientId:"other-client",c:{...clone(own.item.c),text:"Foreign case must not be returned"}};
  const data=S.migrate({...own.data,items:[foreign,own.item]});
  assert.equal(S.get(data,own.item.id).clientId,"winquote");
  assert.equal(S.resolve(data,own.item.id).item.c.text,own.item.c.text);
});

test("migration allocates a genuinely new ticket id even when the saved serial is missing or stale", () => {
  const seed=add(),existing={...clone(seed.item),id:"WQ-021"};
  const old={items:[existing],serial:20,current:existing.id};
  const created=add(old,"compartment","next-capture");
  assert.notEqual(created.item.id,existing.id);
  assert.equal(new Set(created.data.items.map(i=>i.id)).size,2);
  assert.equal(S.get(created.data,existing.id).c.text,existing.c.text);
  assert.equal(S.get(created.data,created.item.id).c.reviewFlow.scenarioId,"compartment");
});

test("simulated time is persisted independently, never advances the business case, and overdue promises retain their original timestamp", () => {
  const added=add(),before=clone(added.item),nextAt=before.ux.timing.nextUpdateAt;
  const clock=S.advance(freeze(added.data),3),restored=S.migrate(JSON.parse(JSON.stringify(clock)));
  assert.deepEqual(S.get(clock,before.id).c,before.c);
  assert.equal(S.get(clock,before.id).sequence,before.sequence);
  assert.equal(S.get(clock,before.id).ux.timing.nextUpdateAt,nextAt);
  assert.equal(restored.feedbackExperience.clockOffset,3*3600000);
  assert.equal(S.status(S.get(restored,before.id),S.now(restored)).overdue,true);
  assert.equal(S.status(S.get(restored,before.id),S.now(restored)).nextUpdate,nextAt);
  assert.deepEqual(S.updates(restored),[]);
});

test("saving a private team draft does not silently postpone an overdue promised update or erase its explanation",()=>{
  const added=add(),id=added.item.id;
  added.item.ux.timing.delayReason="The team is checking the supplied state before sending a result.";
  const promised=added.item.ux.timing.nextUpdateAt,reason=added.item.ux.timing.delayReason;
  const advanced=S.advance(added.data,3);
  const edited=command(advanced,id,"Website team","edit-scope",{approach:added.item.c.reviewFlow.scope.approach});
  assert.equal(edited.item.ux.timing.nextUpdateAt,promised,"An ordinary draft save is not an explicit rescheduling decision.");
  assert.equal(edited.item.ux.timing.delayReason,reason);
  assert.equal(S.status(edited.item,S.now(edited.data)).overdue,true);
  assert.deepEqual(S.updates(edited.data),[]);
});

test("Watch decisions retain their simulated provenance in answers, frozen versions, acceptance and authorization",()=>{
  let {data,item}=sentQuestion();const id=item.id;
  ({data,item}=command(data,id,"Requester","answer",{bundleId:item.c.reviewFlow.sentBundle.id,answers:{business:"a"}},{simulated:true}));
  assert.equal(item.c.answerSimulated,true);
  assert.equal(item.c.reviewFlow.questionRounds[0].answerSimulated,true);
  assert.equal(item.c.trail.at(-1).simulated,true);
  ({data,item}=command(data,id,"Website team","confirm-scope",item.c.reviewFlow.scope,{simulated:true}));
  ({data,item}=command(data,id,"Website team","finish-spec",undefined,{simulated:true}));
  ({data,item}=command(data,id,"Website team","prepare-result",undefined,{simulated:true}));
  ({data,item}=command(data,id,"Website team","deliver",undefined,{simulated:true}));
  assert.equal(item.c.versions[0].answerSimulated,true);
  assert.equal(item.c.versions[0].reviewFlow.questionRounds[0].answerSimulated,true);
  ({data,item}=command(data,id,"Requester","accept",{rev:1},{simulated:true}));
  assert.equal(item.c.accepted.simulated,true);
  ({data,item}=command(data,id,"Site owner","authorize",{rev:1},{simulated:true}));
  assert.equal(item.c.authorization.simulated,true);
});

test("a scripted detailed answer does not relabel an earlier personally supplied answer as simulated",()=>{
  let {data,item}=add(S.migrate(null),"refrigeration");const id=item.id;
  ({data,item}=command(data,id,"Website team","draft-questions"));
  ({data,item}=command(data,id,"Website team","save-questions",[businessQuestion]));
  ({data,item}=command(data,id,"Website team","send-questions"));
  ({data,item}=command(data,id,"Requester","answer",{bundleId:item.c.reviewFlow.sentBundle.id,answers:{business:"a"}}));
  ({data,item}=command(data,id,"Website team","confirm-scope",item.c.reviewFlow.scope));
  ({data,item}=command(data,id,"Website team","begin-detailed-questions"));
  ({data,item}=command(data,id,"Website team","send-questions"));
  ({data,item}=command(data,id,"Requester","answer",{bundleId:item.c.reviewFlow.sentBundle.id,answers:{"equipment-return":"reselect"}},{simulated:true}));
  assert.equal(item.c.answer,"A");
  assert.equal(item.c.answerSimulated,false);
  assert.equal(item.c.reviewFlow.questionRounds[0].answerSimulated,false);
  assert.equal(item.c.reviewFlow.questionRounds[1].answerSimulated,true);
});
