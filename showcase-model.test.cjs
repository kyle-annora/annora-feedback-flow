"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const E = require("./engine.js");
const M = require("./showcase-model.js");
const Capture = require("./capture-state.js");
const clone = value => JSON.parse(JSON.stringify(value));
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function act(state, action, value) {
  const before = JSON.stringify(state);
  const next = M.step(freeze(state), action, value);
  assert.equal(JSON.stringify(state), before, action + " must not mutate its input or saved history");
  if (state.id) assert.equal(next.id, state.id, action + " must remain on the same request");
  if (state.c) {
    assert.equal(next.c.text, state.c.text, action + " must preserve original feedback");
    assert.deepEqual(next.c.versions.slice(0, state.c.versions.length), state.c.versions,
      action + " must preserve every submitted snapshot");
  }
  return next;
}
function screen() {
  let s = act(M.fresh(), "start");
  s = act(s, "submit", {id:"WQ-099"});
  return act(s, "next-team");
}
function answerStep() {
  return act(act(screen(), "send-question"), "open-question");
}
function plan(answer = M.options[0]) {
  return act(answerStep(), "answer", {answer});
}
function review(answer = M.options[0]) {
  return act(act(plan(answer), "share-plan"), "next-candidate");
}
const revised = {
  approach:"Open the saved customer’s PDF in a new browser tab.\nKeep the same quote on Make PDF.\nShow a separate Go to Workflow action beside the saved PDF result.",
  checks:"The saved customer’s PDF opens in a new tab.\nThe original tab stays on Make PDF with the same quote.\nGo to Workflow is visible beside the result and navigates only when selected."
};
function revision() {
  return act(act(review(), "adjust"), "send-adjustment", {
    reason:"Make Go to Workflow easier to find beside the PDF result."
  });
}
function v2() { return act(revision(), "deliver", revised); }

test("the showcase uses one CaseEngine request through submission, question, plan, V1, real V2 edit and separate release", () => {
  let s = act(M.fresh(), "start");
  assert.equal(M.view(s).owner, "Requester");
  s = act(s, "submit", {id:"WQ-099"});
  const original = s.c.text;
  assert.equal(original, E.pdfFeedback);
  assert.equal(s.c.reviewFlow.phase, "triage");
  assert.equal(M.view(s).owner, "Website team");
  s = act(s, "next-team");
  s = act(s, "send-question");
  assert.equal(s.c.stage, "clarify");
  assert.equal(M.view(s).owner, "Requester");
  s = act(s, "open-question");
  s = act(s, "answer", {answer:M.options[0]});
  assert.equal(s.c.reviewFlow.phase, "answer-review");
  assert.equal(M.view(s).owner, "Website team");
  s = act(s, "share-plan");
  assert.equal(s.c.reviewFlow.phase, "spec-review");
  assert.match(s.c.reviewFlow.sharedUnderstanding.text, /keep editing/);
  s = act(s, "next-candidate");
  assert.equal(s.c.stage, "review");
  assert.equal(M.view(s).owner, "Requester");
  assert.equal(s.c.versions.length, 1);
  const v1 = clone(s.c.versions[0]);
  assert.equal(v1.answer, M.options[0]);
  assert.equal(v1.reviewFlow.questionRounds[0].answers["next-step"], M.options[0]);
  assert.equal(v1.result.implemented, false);
  assert.equal(v1.result.verified, false);
  assert.equal(v1.teamCheck.simulated, true);
  s = act(s, "adjust");
  assert.equal(s.c.rev, 1, "Opening the adjustment form does not request a new version yet");
  s = act(s, "send-adjustment", {reason:"Put Go to Workflow beside the PDF result."});
  assert.equal(s.c.rev, 2);
  assert.equal(M.view(s).owner, "Website team");
  assert.equal(s.c.reviewFlow.result, null);
  assert.deepEqual(s.draftScope, v1.reviewFlow.candidateDraft,
    "The revision starts from the actual submitted proposal, without an invented fix");
  s = act(s, "deliver", revised);
  assert.equal(s.c.versions.length, 2);
  assert.deepEqual(s.c.versions[0], v1);
  assert.equal(s.c.versions[1].candidate, revised.approach);
  assert.equal(s.c.versions[1].reviewFlow.candidateDraft.checks, revised.checks);
  assert.notEqual(s.c.versions[1].candidate, v1.candidate);
  s = act(s, "accept");
  assert.equal(s.c.accepted.rev, 2);
  assert.equal(s.c.authorization, null);
  assert.equal(s.c.receipt, null);
  assert.equal(M.view(s).owner, "Site owner");
  assert.throws(() => M.step(s,"publish"), /not available/);
  s = act(s, "authorize");
  assert.equal(s.c.authorization.rev, 2);
  assert.equal(s.c.receipt, null);
  assert.equal(M.view(s).owner, "Website team");
  s = act(s, "publish");
  assert.equal(s.id, "WQ-099");
  assert.equal(s.c.text, original);
  assert.equal(s.scene, "done");
  assert.equal(s.c.stage, "published");
  assert.equal(M.view(s).owner, "Complete");
  assert.equal(s.c.receipt.rev, 2);
  assert.equal(s.c.receipt.candidate, s.c.versions[1].candidate);
  assert.deepEqual(s.c.receipt.checks, s.c.versions[1].checks);
  assert.equal(s.c.receipt.target, "WinQuote · Make PDF");
  assert.equal(s.c.receipt.simulated, true);
  assert.equal(s.c.receipt.implemented, false);
  assert.equal(s.c.receipt.verified, false);
  assert.equal(s.c.accepted.simulated, true);
  assert.equal(s.c.authorization.simulated, true);
  assert.deepEqual(s.c.versions[0], v1);
});

test("AI question drafts and internal checks stay private until the team sends the screened customer question", () => {
  const s = screen(), before = JSON.stringify(s);
  assert.equal(s.c.owner, "Website team");
  assert.equal(s.c.reviewFlow.phase, "question-draft");
  assert.equal(s.c.reviewFlow.sentBundle, null);
  assert.equal(E.derive(s.c).question, null);
  assert.deepEqual(M.view(s).sentQuestions, []);
  assert.deepEqual(s.c.reviewFlow.questionDraft.map(q => q.disposition), ["ask","records","team"]);
  const question = "After opening the quote PDF, do you keep editing or move to the next workflow step?";
  const sent = act(s, "send-question", {question});
  assert.equal(JSON.stringify(s), before);
  assert.equal(sent.scene, "notify");
  assert.equal(sent.c.reviewFlow.sentBundle.questions.length, 1);
  assert.equal(sent.c.reviewFlow.sentBundle.questions[0].text, question);
  assert.equal(sent.c.reviewFlow.sentBundle.questions[0].screened, true);
  assert.ok(M.view(sent).sentQuestions.every(q => q.disposition === "ask"));
  assert.deepEqual(M.view(sent).sentQuestions.map(q => q.id), ["next-step"]);
  assert.ok(!JSON.stringify(M.view(sent).sentQuestions).includes("implementation"));
  assert.ok(!JSON.stringify(M.view(sent).sentQuestions).includes("record-scope"));
  const opened = act(sent, "open-question");
  assert.deepEqual(opened.c, sent.c, "A reminder reopens the exact sent bundle on the same ticket");
  assert.equal(M.view(opened).question, question);
  assert.throws(() => M.step(opened,"send-question"), /not available/);
  assert.throws(() => M.step(s,"send-question",{question:"  "}), /must contain text/);
});

test("trying the two answers previews different proposed behavior and checks without sending an answer or mutating the request", () => {
  const base = answerStep(), before = JSON.stringify(base);
  const editPreview = M.view({...base,answer:M.options[0]});
  const nextPreview = M.view({...base,answer:M.options[1]});
  assert.notEqual(editPreview.scope.approach, nextPreview.scope.approach);
  assert.notEqual(editPreview.scope.checks, nextPreview.scope.checks);
  assert.match(editPreview.scope.checks, /continue editing/);
  assert.match(nextPreview.scope.checks, /does not redirect/);
  assert.match(editPreview.scope.approach, /Make PDF/);
  assert.match(nextPreview.scope.approach, /Make PDF/);
  assert.equal(base.c.answer, "");
  assert.equal(base.c.reviewFlow.phase, "awaiting-answer");
  assert.equal(JSON.stringify(base), before);
  const edit = act(base,"answer",{answer:M.options[0]});
  const next = act(base,"answer",{answer:M.options[1]});
  assert.equal(edit.c.reviewFlow.sentBundle.id, next.c.reviewFlow.sentBundle.id);
  assert.equal(edit.c.reviewFlow.candidateDraft, null);
  assert.equal(next.c.reviewFlow.candidateDraft, null);
  assert.notEqual(edit.draftScope.approach, next.draftScope.approach);
  assert.notEqual(edit.draftScope.checks, next.draftScope.checks);
  assert.notEqual(edit.draftScope.understanding, next.draftScope.understanding);
  assert.equal(JSON.stringify(base), before);
  assert.throws(() => M.step(base,"answer",{answer:"Automatically redirect immediately"}), /Choose/);
});

test("the team explicitly shares its edited scope before preparing the exact submitted version", () => {
  const initial = plan(), before = JSON.stringify(initial);
  const edited = {...initial.draftScope,
    approach:revised.approach,
    checks:revised.checks,
    understanding:"Open the quote PDF and put the optional Workflow action beside the result."};
  const editing = act(initial,"edit-plan");
  assert.equal(editing.editing, true);
  assert.equal(editing.c.reviewFlow.sharedUnderstanding, null);
  const shared = act(editing,"share-plan",edited);
  assert.equal(shared.editing, false);
  assert.deepEqual(shared.c.reviewFlow.confirmedScope, {approach:edited.approach,checks:edited.checks});
  assert.equal(shared.c.reviewFlow.sharedUnderstanding.text, edited.understanding);
  assert.equal(shared.c.reviewFlow.candidateDraft, null);
  assert.equal(JSON.stringify(initial), before);
  const sent = act(shared,"next-candidate");
  assert.equal(sent.c.versions[0].candidate, edited.approach);
  assert.equal(sent.c.versions[0].reviewFlow.sharedUnderstanding.text, edited.understanding);
  assert.equal(sent.c.versions[0].reviewFlow.candidateDraft.checks, edited.checks);
  assert.throws(() => M.step(initial,"next-candidate"), /not available/);
  assert.throws(() => M.step(initial,"share-plan",{checks:"  "}), /must contain text/);
});

test("V2 cannot be delivered until the actual candidate or checks change; failed delivery preserves V1 and the editable draft", () => {
  const s = revision(), before = JSON.stringify(s);
  assert.equal(s.c.rev, 2);
  assert.throws(() => M.step(freeze(s),"deliver"), /Revise the actual candidate or acceptance checks/);
  assert.equal(JSON.stringify(s), before);
  assert.equal(s.c.versions.length, 1);
  const changed = act(s,"deliver",revised);
  const actual = changed.c.versions[1];
  assert.equal(actual.candidate, revised.approach);
  assert.equal(actual.adjustment, "Make Go to Workflow easier to find beside the PDF result.");
  assert.equal(actual.result.approach, actual.candidate);
  assert.equal(actual.result.checks, revised.checks);
  assert.equal(actual.teamCheck.binding, actual.result.binding);
  assert.deepEqual(changed.c.versions[0], s.c.versions[0]);
  assert.equal(E.reviewPreview(changed.c).placement, "beside-result");
});

test("the initial delivered version can be accepted directly, while authorization and release remain separate", () => {
  const v1 = review(M.options[1]);
  const accepted = act(v1,"accept");
  assert.equal(accepted.c.rev, 1);
  assert.equal(accepted.c.versions.length, 1);
  assert.equal(accepted.c.accepted.rev, 1);
  assert.equal(accepted.c.authorization, null);
  assert.equal(accepted.c.receipt, null);
  assert.throws(() => M.step(v1,"authorize"), /not available/);
  assert.throws(() => M.step(accepted,"adjust"), /not available/);
  const authorized = act(accepted,"authorize");
  assert.equal(authorized.c.authorization.rev, 1);
  assert.equal(authorized.c.receipt, null);
  assert.equal(act(authorized,"publish").c.receipt.rev, 1);
});

test("stale actions and edits from read-only history cannot move the current request or change frozen versions", () => {
  const latest = v2(), before = JSON.stringify(latest);
  for (const action of ["submit","send-question","answer","share-plan","deliver","publish"]) {
    assert.throws(() => M.step(freeze(latest),action,{answer:M.options[0]}), /not available/);
  }
  let past = act(latest,"back");
  assert.equal(M.view(past).scene, "revise");
  assert.equal(M.view(past).historyViewing, true);
  assert.equal(past.scene, "review", "Back changes the viewed snapshot, not the current scene");
  assert.deepEqual(past.c, latest.c);
  for (const action of ["deliver","accept","adjust","answer","edit-plan","open-preview"]) {
    assert.throws(() => M.step(freeze(past),action,revised), /Return to the current step/);
  }
  past = act(past,"back");
  assert.equal(M.view(past).scene, "adjust");
  const resumed = act(past,"current");
  assert.equal(M.view(resumed).scene, "review");
  assert.equal(M.view(resumed).rev, 2);
  assert.deepEqual(resumed.c, latest.c);
  assert.deepEqual(resumed.history, latest.history);
  assert.equal(JSON.stringify(latest), before);
});

test("a stale V1 approval cannot accept, authorize or release the V2 snapshot", () => {
  const s = v2();
  assert.throws(() => M.step(s,"accept",{rev:1}), /version|revision|current|stale/i);
  const adjustment = act(s,"adjust");
  assert.throws(() => M.step(adjustment,"send-adjustment",{rev:1,reason:"Move the action"}), /version|revision|current|stale/i);
  const accepted = act(s,"accept",{rev:2});
  assert.throws(() => M.step(accepted,"authorize",{rev:1}), /version|revision|current|stale/i);
  const authorized = act(accepted,"authorize",{rev:2});
  assert.throws(() => M.step(authorized,"publish",{rev:1}), /version|revision|current|stale/i);
  assert.equal(act(authorized,"publish",{rev:2}).c.receipt.rev, 2);
});

test("customer updates keep the exact ticket and next owner visible between acceptance, authorization and the simulated receipt", () => {
  let s = v2();
  const item = () => ({id:s.id,c:s.c,captureSubmission:true,curatedDemo:true});
  const before = JSON.stringify(s);
  const ready = Capture.updates([item()])[0];
  assert.equal(ready.key, "WQ-099:V2");
  assert.equal(ready.owner, "You · Requester");
  assert.equal(JSON.stringify(s), before);
  s = act(s,"accept");
  const accepted = Capture.updates([item()],{[ready.key]:true})[0];
  assert.equal(accepted.id, "WQ-099");
  assert.equal(accepted.key, "WQ-099:accepted-V2");
  assert.equal(accepted.owner, "Site owner");
  assert.equal(accepted.label, "View accepted version");
  assert.match(accepted.next, /No action needed from you/);
  assert.match(accepted.next, /site owner/);
  assert.equal(accepted.read, false, "Reading V2 does not mark the next handoff as read");
  assert.equal(s.c.authorization, null);
  s = act(s,"authorize");
  const authorized = Capture.updates([item()],{[accepted.key]:true})[0];
  assert.equal(authorized.id, "WQ-099");
  assert.equal(authorized.key, "WQ-099:authorized-V2");
  assert.equal(authorized.owner, "Website team");
  assert.equal(authorized.label, "View approved version");
  assert.match(authorized.next, /simulated release/);
  assert.equal(authorized.read, false);
  assert.equal(s.c.receipt, null);
  assert.deepEqual(Capture.updates([{...item(),captureSubmission:false}]), [],
    "The owner-continuity update remains restricted to actual demo submissions");
  const restored = clone({items:[item()],seen:{[authorized.key]:true}});
  assert.equal(Capture.updates(restored.items,restored.seen)[0].read, true);
  s = act(s,"publish");
  const receipt = Capture.updates([item()])[0];
  assert.equal(receipt.id, "WQ-099");
  assert.equal(receipt.key, "WQ-099:receipt-V2");
  assert.equal(receipt.owner, "Complete");
  assert.equal(receipt.next, "No further action needed");
  assert.doesNotMatch(JSON.stringify([accepted,authorized,receipt]), /implementation|record-scope|Technical feasibility/);
});

test("the zero-question historical route reaches shared scope and review without fabricating a customer answer or notification", () => {
  const initial = screen();
  const shared = act(initial,"send-question",{includeQuestion:false});
  assert.equal(shared.scene, "shared");
  assert.equal(shared.c.reviewFlow.phase, "spec-review");
  assert.equal(shared.c.reviewFlow.sentBundle, null);
  assert.deepEqual(shared.c.reviewFlow.questionRounds, []);
  assert.equal(shared.c.answer, "");
  assert.deepEqual(M.view(shared).sentQuestions, []);
  assert.ok(!shared.history.some(frame => ["notify","answer","plan"].includes(frame.scene)));
  const sent = act(shared,"next-candidate");
  assert.equal(sent.c.versions.length, 1);
  assert.equal(sent.c.versions[0].answer, "");
  assert.match(sent.c.versions[0].candidate, /Make PDF/);
  assert.match(sent.c.versions[0].candidate, /explicit Go to Workflow/);
  const completed = act(act(act(sent,"accept"),"authorize"),"publish");
  assert.equal(completed.c.receipt.rev, 1);
  assert.equal(completed.c.receipt.simulated, true);
});

test("a JSON save and reload preserves the current ticket and read-only history, and resuming does not replay earlier work", () => {
  assert.throws(() => M.step(M.fresh(),"back"), /no earlier step/);
  const current = v2();
  let saved = clone(act(act(current,"back"),"back"));
  assert.equal(M.view(saved).historyViewing, true);
  assert.equal(M.view(saved).scene, "adjust");
  assert.deepEqual(saved.c, current.c);
  saved = act(saved,"current");
  assert.equal(saved.id, current.id);
  assert.equal(saved.scene, "review");
  assert.equal(saved.c.rev, 2);
  assert.deepEqual(saved.c, current.c);
  assert.equal(saved.c.reviewFlow.questionRounds.length, 1);
  assert.equal(saved.c.versions.length, 2);
  assert.equal(act(saved,"accept").c.accepted.rev, 2);
});

test("opening the simulated result never changes candidate, approvals, version snapshots or original feedback", () => {
  const original = review(), before = JSON.stringify(original.c);
  const opened = act(original,"open-preview");
  assert.equal(opened.previewOpen, true);
  assert.equal(JSON.stringify(opened.c), before);
  assert.equal(opened.history.length, original.history.length);
  const closed = act(opened,"open-preview");
  assert.equal(closed.previewOpen, false);
  assert.equal(JSON.stringify(closed.c), before);
  assert.equal(closed.c.accepted, null);
  assert.equal(closed.c.authorization, null);
  assert.equal(closed.c.receipt, null);
});

test("the browser model exposes the same pure API against the original CaseEngine", () => {
  const context = {CaseEngine:E};
  vm.runInNewContext(fs.readFileSync(require.resolve("./showcase-model.js"),"utf8"), context);
  const browser = context.ShowcaseModel;
  assert.deepEqual(Array.from(browser.options), M.options);
  const started = browser.step(browser.fresh(),"start");
  const submitted = browser.step(started,"submit",{id:"WQ-100"});
  assert.equal(submitted.c.text, E.pdfFeedback);
  assert.equal(submitted.c.reviewFlow.journey.enabled, true);
  assert.equal(browser.view(submitted).owner, "Website team");
  assert.equal(browser.view(submitted).next, M.view(act(act(M.fresh(),"start"),"submit",{id:"WQ-100"})).next);
});
