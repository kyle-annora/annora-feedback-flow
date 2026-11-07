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
  ({data,item}=command(data,id,"Website team","draft-plan"));
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
  const changed = command(freeze(b.data),first.id,"Website team","draft-plan");
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

test("the team reopens a requested change as private Q2 and delivers V2 without rewriting V1 or inventing a requester correction", () => {
  let {data,item}=add(S.migrate(null),"refrigeration");const id=item.id;
  const run=(actor,action,value)=>({data,item}=command(data,id,actor,action,value));
  run("Website team","draft-questions");run("Website team","preview-questions");run("Website team","send-questions");
  run("Requester","answer",{bundleId:"Q1",answers:{"equipment-return":"Select equipment again"}});
  run("Website team","draft-plan");run("Website team","confirm-scope",item.c.reviewFlow.scope);
  run("Website team","finish-spec");run("Website team","prepare-result");run("Website team","deliver");
  const v1=clone(item.c.versions[0]),understandingHistory=clone(item.c.reviewFlow.understandingHistory);
  const reason="Restore the previous equipment if refrigeration is needed again.";
  run("Requester","adjust",{rev:1,reason,attachments:[{id:"restore-note",kind:"audio",name:"request.webm",mimeType:"audio/webm",size:12}]});
  const before=JSON.stringify(data),events=clone(item.ux.events),timing=clone(item.ux.timing),adjustments=clone(item.c.adjustments);
  for(const actor of ["Requester","Site owner"])assert.throws(()=>command(freeze(data),id,actor,"reopen-clarification"),/different role/);
  assert.equal(JSON.stringify(data),before);
  run("Website team","reopen-clarification");
  const f=item.c.reviewFlow;
  assert.equal(f.phase,"question-draft");assert.equal(item.c.owner,"Website team");assert.equal(f.journey.scopeCycle,2);
  assert.equal(f.sentBundle,null);assert.equal(f.questionPreview,null);assert.equal(f.result,null);assert.equal(f.candidateDraft,null);
  assert.equal(item.c.answer,"");assert.deepEqual(f.answers,{});assert.equal(f.questionRounds.length,1);
  assert.equal(f.questionRounds[0].answers["equipment-return"],"Select equipment again");
  assert.equal(f.understandingCorrections.length,0,"A team follow-up is not a second requester correction.");
  assert.deepEqual(f.understandingHistory,understandingHistory);assert.equal(f.sharedUnderstanding.needsRevision,true);
  assert.deepEqual(item.c.adjustments,adjustments);assert.equal(f.adjustmentEvidence.attachments[0].id,"restore-note");
  assert.deepEqual(f.reopenedFor,{rev:1,reason,actor:"Website team",scopeCycle:2});
  assert.equal(item.c.trail.at(-1).actor,"Website team");assert.match(item.c.trail.at(-1).text,/reopened questions.*V1/);
  assert.deepEqual(item.ux.events,events);assert.deepEqual(item.ux.timing,timing,"Opening a private question draft does not claim a new customer update.");
  run("Website team","preview-questions");assert.deepEqual(item.ux.events,events);
  run("Website team","send-questions");
  assert.equal(item.ux.events.length,events.length+1);assert.equal(item.ux.events.at(-1).bundleId,"Q2");
  assert.equal(item.ux.events.at(-1).ticketId,id);assert.equal(item.c.reviewFlow.sentBundle.reopenedFor.reason,reason);
  assert.throws(()=>command(data,id,"Requester","answer",{bundleId:"Q1",answers:{"equipment-return":"Select equipment again"}}),/current sent/);
  run("Requester","answer",{bundleId:"Q2",answers:{"equipment-return":"Restore the previous equipment selection"}});
  assert.match(item.c.reviewFlow.suggestedScope.conflict,/recorded/);
  run("Website team","draft-plan");run("Website team","confirm-scope",item.c.reviewFlow.scope);
  run("Website team","finish-spec");run("Website team","prepare-result");run("Website team","deliver");
  const v2=item.c.versions[1];assert.equal(v2.rev,2);
  assert.deepEqual(item.c.versions[0],v1);assert.equal(v1.reviewFlow.questionRounds.length,1);
  assert.deepEqual(v2.reviewFlow.questionRounds.map(q=>[q.id,q.scopeCycle,q.answers["equipment-return"]]),[["Q1",1,"Select equipment again"],["Q2",2,"Restore the previous equipment selection"]]);
  assert.match(v1.candidate,/removed equipment is not restored/);assert.match(v2.candidate,/restore that prior selection/);
  assert.ok(v2.checks.some(q=>q.label==="Clearing the flag and saving restores the prior equipment selection and its charges."));
  assert.equal(v2.adjustment,reason);assert.equal(v2.reviewFlow.understandingCorrections.length,0);
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

test("answering clears the consumed return prompt without losing the question history", () => {
  let {data,item}=add();const id=item.id;
  data=S.visit(data,id).data;
  for(const [action,value] of [["draft-questions"],["save-questions",[businessQuestion]],["send-questions"]])({data,item}=command(data,id,"Website team",action,value));
  const returned=S.visit(data,id),events=clone(returned.item.ux.events);
  assert.match(returned.item.ux.sinceLastVisit,/Answer the questions/);
  const answered=command(returned.data,id,"Requester","answer",{bundleId:item.c.reviewFlow.sentBundle.id,answers:{business:"a"}});
  assert.equal(answered.item.ux.sinceLastVisit,undefined);
  assert.equal(S.status(answered.item).owner,"Website team");
  assert.deepEqual(answered.item.ux.events.slice(0,events.length),events);
  assert.equal(answered.item.c.reviewFlow.answers.business,"A");
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
  ({data,item}=command(data,id,"Website team","draft-plan"));
  ({data,item}=command(data,id,"Website team","confirm-scope",C.get("pdf").scope,{simulated:true}));
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
  ({data,item}=command(data,id,"Website team","draft-plan"));
  ({data,item}=command(data,id,"Website team","confirm-scope",C.get("refrigeration").scope));
  ({data,item}=command(data,id,"Website team","begin-detailed-questions"));
  ({data,item}=command(data,id,"Website team","send-questions"));
  ({data,item}=command(data,id,"Requester","answer",{bundleId:item.c.reviewFlow.sentBundle.id,answers:{"equipment-return":"reselect"}},{simulated:true}));
  assert.equal(item.c.answer,"A");
  assert.equal(item.c.answerSimulated,false);
  assert.equal(item.c.reviewFlow.questionRounds[0].answerSimulated,false);
  assert.equal(item.c.reviewFlow.questionRounds[1].answerSimulated,true);
});

test('existing review tickets adopt evidence-first review without replacing manual drafts or frozen versions',()=>{
  const E=require('./engine.js');
  const original=E.createReviewedCase(C.get('pdf').feedback,{scenarioId:'pdf',sourceId:C.get('pdf').ticketId,journey:true});
  original.reviewFlow.scope={approach:'An existing team-authored draft.',checks:'Check the original manually selected behavior.'};
  const legacy={items:[{id:'WQ-280',clientId:'winquote',c:original,ux:{drafts:{fields:{approach:'Unsaved typed draft'}}}}],current:'WQ-280',serial:280};
  const input=clone(legacy),migrated=S.migrate(freeze(legacy)),item=S.get(migrated,'WQ-280');
  assert.deepEqual(legacy,input);assert.equal(item.c.reviewFlow.evidenceFirst,true);assert.equal(item.c.reviewFlow.planPrepared,false);
  assert.deepEqual(item.c.reviewFlow.scope,original.reviewFlow.scope);assert.deepEqual(item.ux.drafts.fields,{approach:'Unsaved typed draft'});
  const prepared=command(migrated,item.id,'Website team','draft-plan');
  assert.deepEqual(prepared.item.c.reviewFlow.scope,original.reviewFlow.scope);assert.deepEqual(prepared.item.c.versions,original.versions);
  assert.deepEqual(S.updates(prepared.data),[]);assert.deepEqual(S.migrate(prepared.data),prepared.data);
});

test('attention counts one current task per ticket independently of read events and visits',()=>{
  let {data,item}=review();const id=item.id;
  data=S.visit(data,id).data;
  const before=clone(data),attention=S.attention(freeze(data));
  assert.deepEqual(data,before,'Projecting the launcher must not consume visits, read state, or case history.');
  assert.equal(attention.actor,'Requester');
  assert.equal(attention.taskCount,1);
  assert.equal(attention.tasks[0].ticketId,id);
  assert.equal(attention.tasks[0].action,'review');
  assert.equal(attention.tasks[0].actionLabel,'Review V1');
  assert.equal(attention.tasks[0].rev,1);
  assert.equal(attention.tasks[0].sequence,item.sequence);
  assert.equal(attention.updates.length,2,'Shared plan and V1 delivery are separate events on the same ticket.');
  assert.equal(attention.unreadCount,2);
  assert.equal(attention.hasUnread,true);
  assert.equal(attention.updateGroups.length,1);
  assert.equal(attention.updateGroups[0].count,2);
  assert.equal(attention.updateGroups[0].cta,'Open current task');
  assert.equal(attention.unreadFyiCount,0,'Task-bearing tickets use the task badge rather than a second FYI indication.');
  assert.equal(attention.hasUnreadFyi,false);
  for(const event of attention.updates)data=S.markRead(data,event.id);
  const after=S.attention(data);
  assert.equal(after.unreadCount,0);
  assert.equal(after.hasUnread,false);
  assert.equal(after.taskCount,1,'Reading all messages cannot accept the candidate.');
  assert.deepEqual(S.get(data,id).c,item.c);
  assert.deepEqual(data.feedbackExperience.clients,before.feedbackExperience.clients);
});

test('attention keeps requester review, owner approval and team release as separate assignments',()=>{
  let {data,item}=review();const id=item.id;
  ({data,item}=command(data,id,'Requester','accept',{rev:1}));
  const requester=S.attention(data),owner=S.attention(data,{actor:'Site owner'});
  assert.equal(requester.taskCount,0);
  assert.equal(requester.updates.some(event=>event.action==='accept'),false);
  assert.ok(requester.updates.every(event=>event.recipient==='Requester'));
  assert.equal(requester.unreadFyiCount,requester.unreadCount);
  assert.equal(requester.hasUnreadFyi,true);
  assert.equal(requester.updateGroups[0].cta,'View feedback');
  assert.equal(owner.taskCount,1);
  assert.equal(owner.tasks[0].action,'approve-release');
  assert.equal(owner.tasks[0].rev,1);
  assert.equal(owner.updates.length,1);
  assert.equal(owner.updates[0].action,'accept');
  assert.equal(owner.updateGroups[0].cta,'Open current task');
  assert.equal(S.attention(data,{actor:'Website team'}).taskCount,0);
  assert.throws(()=>command(data,id,'Requester','authorize',{rev:1}),/different role/);
  ({data,item}=command(data,id,'Site owner','authorize',{rev:1}));
  assert.equal(S.attention(data,{actor:'Site owner'}).taskCount,0);
  assert.equal(S.attention(data).taskCount,0);
  assert.equal(S.attention(data,{actor:'Website team'}).tasks[0].action,'release');
  assert.equal(S.attention(data,{actor:'Website team'}).updates.length,0,'Tasks need not invent a new notification.');
  ({data,item}=command(data,id,'Website team','publish',{rev:1}));
  for(const actor of ['Requester','Site owner','Website team'])assert.equal(S.attention(data,{actor}).taskCount,0);
  assert.equal(S.attention(data).updates[0].action,'publish');
  assert.equal(item.c.receipt.rev,1);
});

test('attention follows a screened question to the exact bundle and changes ownership after the answer',()=>{
  let {data,item}=add();const id=item.id;
  assert.equal(S.attention(data,{actor:'Website team'}).tasks[0].action,'review-evidence');
  assert.equal(S.attention(data).taskCount,0);
  ({data,item}=command(data,id,'Website team','draft-questions'));
  assert.equal(S.attention(data,{actor:'Website team'}).tasks[0].action,'screen-questions');
  assert.equal(S.attention(data).taskCount,0);
  ({data,item}=command(data,id,'Website team','save-questions',[businessQuestion]));
  ({data,item}=command(data,id,'Website team','send-questions'));
  const waiting=S.attention(data),event=waiting.updates[0];
  assert.equal(waiting.taskCount,1);
  assert.equal(waiting.tasks[0].action,'answer');
  assert.equal(waiting.tasks[0].bundleId,item.c.reviewFlow.sentBundle.id);
  assert.equal(S.attention(data,{actor:'Website team'}).taskCount,0);
  data=S.markRead(data,event.id);
  assert.equal(S.attention(data).taskCount,1);
  ({data,item}=command(data,id,'Requester','answer',{bundleId:item.c.reviewFlow.sentBundle.id,answers:{business:'a'}}));
  assert.equal(S.attention(data).taskCount,0);
  const team=S.attention(data,{actor:'Website team'});
  assert.equal(team.taskCount,1);
  assert.equal(team.tasks[0].action,'update-plan');
  assert.equal(team.tasks[0].actionLabel,'Draft an updated plan');
  assert.equal(team.tasks[0].bundleId,null,'The answered bundle is history, not an outstanding answer action.');
  assert.equal(S.resolve(data,id,event.id).stale,true);
});

test('attention limits records to the current client and customer provenance while recipient filtering stays fail-closed',()=>{
  const own=review(),example=add(own.data,'compartment','attention-example',{example:true}),foreign=clone(own.item);
  foreign.clientId='other-client';foreign.id='other-ticket';
  foreign.ux.events=foreign.ux.events.map(event=>({...event,id:'other:'+event.id,ticketId:foreign.id}));
  const data=S.migrate({...example.data,items:[...example.data.items,foreign]});
  data.items[0].ux.events.push({id:'unknown-recipient',ticketId:own.item.id,action:'deliver',rev:1,title:'Unassigned legacy notice',at:'2026-01-01T00:00:00Z'});
  const before=clone(data),p=S.attention(freeze(data));
  assert.deepEqual(p.items.map(item=>item.id),[own.item.id]);
  assert.deepEqual(p.tasks.map(task=>task.ticketId),[own.item.id]);
  assert.ok(p.updates.every(event=>event.ticketId===own.item.id&&event.recipient==='Requester'));
  assert.equal(p.updates.some(event=>event.id==='unknown-recipient'),false);
  assert.equal(S.updates(data).some(event=>event.id==='unknown-recipient'),true,'Existing broad update API remains backward compatible.');
  for(const actor of ['Unknown','Reviewer',null,'toString']){
    const invalid=S.attention(data,{actor});
    assert.equal(invalid.taskCount,0);
    assert.deepEqual(invalid.updates,[]);
    assert.equal(invalid.hasUnread,false);
  }
  assert.deepEqual(data,before);
});

test('attention distinguishes actionable legacy records from local drafts and never changes saved versions',()=>{
  const E=require('./engine.js');
  const phases=['draft','clarify','processing','blocked','review','release','authorized','published','unknown'];
  const data=S.migrate({items:phases.map((stage,index)=>({id:'WQ-'+(400+index),clientId:'winquote',submissionOrigin:'customer',c:{...E.createCase(),stage},ux:{}})),serial:410,current:'WQ-400'});
  const before=clone(data);
  assert.deepEqual(S.attention(freeze(data)).tasks.map(task=>task.phase),['clarify','review']);
  assert.deepEqual(S.attention(data,{actor:'Site owner'}).tasks.map(task=>task.phase),['release']);
  assert.deepEqual(S.attention(data,{actor:'Website team'}).tasks.map(task=>task.phase),['processing','blocked','authorized']);
  assert.equal(S.attention(data).items.length,phases.length,'A draft can be resumed without entering the assigned-task badge.');
  assert.deepEqual(data,before);
});

test('attention distinguishes tasks on one ticket from unread FYI on another without consuming either',()=>{
  const active=sentQuestion(),other=add(active.data,'compartment','attention-fyi');
  let data=other.data;const first=active.item.id,second=other.item.id;
  data=S.setExpectation(data,second,{at:'2031-01-01T12:00:00Z',reason:'The team will check the records.'}).data;
  const result=S.attention(data);
  assert.equal(result.taskCount,1);
  assert.equal(result.tasks[0].ticketId,first);
  assert.equal(result.updates.length,2);
  assert.equal(result.unreadCount,2);
  assert.equal(result.unreadFyiCount,1);
  assert.equal(result.hasUnreadFyi,true);
  assert.equal(result.updateGroups.find(group=>group.ticketId===first).cta,'Open current task');
  assert.equal(result.updateGroups.find(group=>group.ticketId===second).cta,'View feedback');
  const read=S.markRead(data,result.updates.find(event=>event.ticketId===second).id);
  assert.equal(S.attention(read).taskCount,1);
  assert.equal(S.attention(read).hasUnread,true);
  assert.equal(S.attention(read).hasUnreadFyi,false);
  assert.equal(read.feedbackExperience.clients,undefined);
});
