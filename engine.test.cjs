"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");
const create = E.createCase, act = E.transition, view = E.derive;
const tour = raw => {
  const states = [create(raw)];
  for (let i = 0; i < 20; i++) {
    const next = E.step(states.at(-1));
    if (next === states.at(-1)) return states;
    states.push(next);
  }
  throw Error("Tour did not terminate");
};

test("small edits change the real measurement, preserve untouched copy, and can prevent handoff", () => {
  const original = create();
  const limited = E.editSource(original,original.text.replace("18","10"));
  const tooShort = E.editSource(limited,limited.text.replace("10","3"));
  assert.deepEqual([original,limited,tooShort].map(c=>view(c).wordCount),[15,9,9]);
  for (const c of [original,limited,tooShort]) {
    assert.match(view(c).candidate,/Add customer details next\.$/);
    assert.equal(view(c).checks.find(it=>it.id === "entry-priority" && it.direction === "first").status,"manual");
  }
  const rejected = act(tooShort,"submit");
  assert.equal(rejected.stage,"blocked");
  assert.equal(act(rejected,"deliver"),rejected);
  assert.match(view(rejected).reason,/6 over the limit/);
  assert.equal(view(rejected).checks.find(it=>it.status==="fail").source,"Use no more than 3 words");
  const corrected = E.editSource(rejected,limited.text);
  assert.equal(corrected.stage,"processing");
  assert.equal(act(corrected,"deliver").stage,"review");
  const removed = E.editSource(original,original.text.replace("Keep the reminder","Remove the reminder"));
  assert.doesNotMatch(view(removed).candidate,/customer details/);
  assert.equal(view(removed).checks.find(it=>it.id === "customer-details" && it.keepDetails === false).status,"pass");
});

test("questions change with source; an irrelevant old answer does not carry forward", () => {
  const button = create("New hires find the homepage button wording unclear.");
  const asked = act(button,"submit");
  assert.equal(asked.stage,"clarify");
  assert.deepEqual(view(asked).question.options,[]);
  assert.equal(act(asked,"deliver"),asked);
  const answered = act(asked,"answer","Request a quote");
  assert.equal(view(answered).candidate,"Request a quote");
  const stillRelevant = E.editSource(answered,button.text+" Use no more than 5 words.");
  assert.equal(stillRelevant.answer,"Request a quote");
  const changed = E.editSource(stillRelevant,"New hires are unsure whether to use a template or start from scratch.");
  assert.equal(changed.answer,"");
  assert.equal(changed.stage,"clarify");
  assert.match(view(changed).question.text,/side by side/i);
  const parallel = act(changed,"answer","Show both paths side by side");
  assert.match(view(parallel).candidate,/either path|Template: standard/);
  const explicit = E.editSource(parallel,'Rename the homepage "Create" button to "Start a quote".');
  assert.equal(view(explicit).question,null);
  assert.equal(view(explicit).candidate,"Start a quote");
});

test("delivery freezes source and checks; review, revision, release authorization and receipt stay separate", () => {
  const frames = tour();
  const expected = ["draft","processing","review","processing","review","release","authorized","published"];
  assert.deepEqual(frames.map(c=>c.stage),expected);
  const [,,review,revision,v2,accepted,authorized,published] = frames;
  assert.equal(review.versions[0].candidate,view(review).candidate);
  assert.equal(revision.rev,2);
  assert.deepEqual(v2.versions[0],review.versions[0]);
  assert.notEqual(v2.versions[0].candidate,v2.versions[1].candidate);
  assert.equal(accepted.authorization,null);
  assert.equal(authorized.receipt,null);
  assert.deepEqual(published.receipt,{rev:2,target:"WinQuote homepage",simulated:true});
  assert.equal(act(review,"authorize"),review);
  assert.equal(act(accepted,"publish"),accepted);
  assert.ok(published.trail.every(event=>event.simulated));
  assert.deepEqual(published.trail.filter(x=>["deliver","accept","authorize"].includes(x.action)).map(x=>x.actor),
    ["Website team","Website team","Reviewer","Site owner"]);
  const fork = E.editSource(accepted,"Translate the homepage into French.");
  assert.equal(fork.stage,"draft");
  assert.equal(fork.versions.length,0);
  assert.equal(accepted.versions.length,2);
  assert.deepEqual(accepted.versions[0],review.versions[0]);
});

test("custom feedback runs stop with the team for out-of-scope and mixed changes", () => {
  const mixed = tour('Change the homepage button label to "Add quote", and also move the button to the top right.').at(-1);
  assert.equal(view(mixed).candidate,"Add quote");
  assert.equal(view(mixed).manual,true);
  for (const raw of ["Add a database backup.","Apply a ten percent discount to quotes.","Move the homepage button to the top right.", mixed.text]) {
    const end = tour(raw).at(-1);
    assert.equal(end.stage,"blocked");
    assert.equal(end.receipt,null);
    assert.equal(end.versions.length,0);
  }
  const delegated = act(act(create("New customers find the button wording unclear."),"submit"),"answer","Ask the team");
  assert.equal(delegated.stage,"blocked");
  assert.equal(delegated.answerSimulated,false);
});

test("a simulated answer is explicit and distinct from a manually supplied answer", () => {
  const frames = tour("The quote button wording on the homepage is unclear.");
  const answer = frames.find(c=>c.answer);
  assert.equal(answer.answerSimulated,true);
  assert.match(answer.answer,/Start a quote/);
  assert.equal(answer.trail.at(-1).actor,"Requester");
  assert.equal(answer.trail.at(-1).simulated,true);
  const manual = act(frames[1],"answer","Get price");
  assert.equal(manual.trail.at(-1).simulated,false);
  assert.equal(view(manual).candidate,"Get price");
});

test("team edits remeasure the actual candidate, including structural and original content requirements", () => {
  const raw = E.initialFeedback.replace("18","8");
  const blocked = act(create(raw),"submit");
  assert.equal(blocked.stage,"blocked");
  assert.equal(view(blocked).wordCount,9);
  for (const invalid of ["", "  ", "Customer details next.", "Standard template. Custom scratch."]) {
    const short = E.editCandidate(blocked, invalid);
    assert.equal(short.stage,"blocked");
    assert.equal(act(short,"deliver"),short);
    assert.ok(view(short).checks.some(row=>row.status==="fail"));
  }
  const copy = "Standard: template. Custom: scratch. Customer details next.";
  const valid = E.editCandidate(blocked, copy);
  assert.equal(valid.stage,"processing");
  assert.equal(view(valid).wordCount,7);
  assert.ok(view(valid).checks.every(row=>row.status!=="fail"));
  const delivered = act(valid,"deliver");
  assert.equal(delivered.versions[0].candidate,copy);
  assert.equal(E.editCandidate(delivered,""),delivered);
  assert.equal(E.editCandidate(E.editCandidate(blocked,""),null).stage,"blocked");
  assert.equal(view(E.editCandidate(valid)).wordCount,9);
  assert.equal(view(blocked).wordCount,9);
});

test("manual copy cannot silently satisfy unknown scope, mixed requests or an explicit different button label", () => {
  for (const raw of ["Move the homepage button to the top right.",'Change the button label to "New quote", and also add a PDF export.']) {
    const c = E.editCandidate(act(create(raw),"submit"),"New quote");
    assert.equal(c.stage,"blocked");
    assert.equal(view(c).manual,true);
    assert.equal(act(c,"deliver"),c);
  }
  const exact = act(create('Change the homepage button label to "New quote".'),"submit");
  const wrong = E.editCandidate(exact,"Send quote");
  assert.equal(wrong.stage,"blocked");
  assert.equal(view(wrong).checks[0].status,"fail");
  assert.equal(E.editCandidate(wrong,null).stage,"processing");
});

test("a corrected V2 requirement stays on the same case, keeping V1, the raw source and the audit trail", () => {
  const v1 = act(act(create(),"submit"),"deliver");
  const original = JSON.stringify(v1.versions[0]);
  const impossible = "Shorten the copy to no more than 3 words. Keep the reminder to add customer details next.";
  const blocked = act(v1,"adjust",impossible);
  assert.equal(blocked.stage,"blocked");
  const amended = "Shorten the copy to no more than 10 words. Keep the reminder to add customer details next.";
  const recovered = E.reviseAdjustment(blocked,amended);
  assert.equal(recovered.stage,"processing");
  assert.equal(recovered.rev,2);
  assert.equal(recovered.text,E.initialFeedback);
  assert.equal(JSON.stringify(recovered.versions[0]),original);
  assert.equal(recovered.trail.at(-1).actor,"Reviewer");
  assert.equal(recovered.trail.at(-1).action,"reviseAdjustment");
  assert.equal(recovered.trail.at(-1).simulated,false);
  assert.equal(recovered.adjustment,amended);
  assert.ok(recovered.trail.some(entry=>entry.text.includes(impossible)));
  assert.equal(blocked.adjustment,impossible);
  const measured = view(recovered).checks.find(row=>row.id === "word-limit" && row.limit === 10);
  assert.equal(measured.status,"pass");
  assert.equal(measured.sourceLabel,"V1 revision request");
  const v2 = act(recovered,"deliver");
  assert.equal(v2.versions.length,2);
  assert.equal(E.reviseAdjustment(v2,"Change the version that was already delivered"),v2);
});

test("previously saved Chinese feedback keeps its original wording and produces English guidance", () => {
  const raw = "新员工看不懂首页报价按钮的用词。";
  const c = act(create(raw), "submit");
  assert.equal(c.text, raw);
  assert.equal(c.stage, "clarify");
  assert.match(view(c).question.text, /button/i);
  assert.equal(view(c).question.source.includes("按钮"), true);
  assert.equal(view(act(c, "answer", "Start a quote")).candidate, "Start a quote");
});

test("an unexplained reply to a button question is context, not a candidate or a simulated approval", () => {
  const asked = act(create("New employees find the homepage quote button label confusing."), "submit");
  for (const reply of ["221", "?", "I don't know", "I thought this would email the customer.", "看不懂"]) {
    const waiting = act(asked,"answer",reply), v = view(waiting);
    assert.deepEqual([waiting.stage,waiting.owner,v.question.type,v.candidate], ["clarify","Requester","wording-retry",""]);
    assert.equal(v.question.source, reply);
    assert.deepEqual(v.checks, []);
    assert.equal(E.step(waiting), waiting);
    for (const action of ["deliver","accept","authorize","publish"]) assert.equal(act(waiting,action),waiting);
    const fixed = act(waiting,"answer","Start a quote");
    assert.equal(act(fixed,"deliver").versions[0].candidate,"Start a quote");
    assert.equal(fixed.trail.some(e=>e.action==="answer" && e.text.includes(reply)),true);
    assert.equal(act(waiting,"answer","Ask the team").owner,"Website team");
  }
  for (const literal of ["“221”",'Use "221"', "Use the exact label 221"]) {
    const chosen = act(asked,"answer",literal);
    assert.equal(act(chosen,"deliver").versions[0].candidate,"221");
  }
  const direct = act(create('Change the homepage button label to "221".'),"submit");
  assert.equal(view(direct).candidate,"221");
});

test("reopening a prior unresolved delivery preserves its snapshot; completed releases stay frozen", () => {
  const asked = act(create("New employees find the homepage quote button label confusing."),"submit");
  const literal = act(asked,"answer",'"221"');
  // Previous builds treated the same unquoted reply as exact copy.
  const submitted = act(literal,"deliver");
  const old = {...submitted, answer:"221", versions:submitted.versions.map(v=>({...v,answer:"221"}))};
  const frozen = JSON.stringify(old.versions);
  assert.equal(E.resumeWorkingCase({...literal,answer:"221"}).stage,"clarify");
  for (const action of ["step","accept"]) {
    const reopened = action === "step" ? E.step(old) : act(old,action);
    assert.equal(reopened.stage,"clarify");
    assert.equal(reopened.rev,2);
    assert.equal(reopened.accepted,null);
    assert.equal(E.step(reopened),reopened);
    assert.equal(JSON.stringify(reopened.versions),frozen);
    const fixed = act(act(reopened,"answer","Get price"),"deliver");
    assert.equal(fixed.stage,"review");
    assert.equal(fixed.versions[1].candidate,"Get price");
    assert.equal(fixed.versions[0],old.versions[0]);
  }
  const complete = {...old,stage:"published",owner:"Complete",receipt:{rev:1,simulated:true}};
  assert.equal(E.resumeWorkingCase(complete),complete);
  assert.equal(E.step(complete),complete);
  assert.equal(view(complete).candidate,"221");
});
