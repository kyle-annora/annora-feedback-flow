"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const engine = require("./engine.js");
const personas = require("./personas.js");

function run(id, answer) {
  const frames = [personas.start(id, answer)];
  while (!frames.at(-1).done) {
    const current = frames.at(-1);
    const saved = JSON.stringify(current);
    frames.push(personas.next(current));
    assert.equal(JSON.stringify(current), saved, "rewind must retain the original frame");
    assert.ok(frames.length <= current.total);
  }
  assert.equal(frames.length, frames[0].total);
  assert.equal(personas.next(frames.at(-1)), frames.at(-1));
  return frames;
}

test("the requester describes a concern, reviews a real revision, and hands accepted V2 to the site owner", () => {
  const frames = run("customer");
  assert.deepEqual(frames.map(frame => frame.case.stage),
    ["draft","clarify","processing","review","blocked","processing","review","release"]);
  assert.equal(frames[0].case.text, engine.hesitationFeedback);
  assert.equal(engine.derive(frames[1].case).question.type, "hesitation");
  assert.equal(frames[2].case.answer, engine.hesitationAnswers[0]);
  const v1 = frames[3].case, pending = frames[4].case, edited = frames[5].case, v2 = frames[6].case;
  assert.equal(engine.transition(pending, "deliver"), pending);
  assert.equal(pending.owner, "Website team");
  assert.notEqual(engine.derive(edited).candidate, v1.versions[0].candidate);
  assert.equal(v2.versions.length, 2);
  assert.deepEqual(v2.versions[0], v1.versions[0]);
  const last = frames.at(-1);
  assert.equal(last.case.accepted.rev, 2);
  assert.equal(last.case.accepted.actor, "Reviewer");
  assert.equal(last.case.authorization, null);
  assert.equal(last.case.receipt, null);
  assert.equal(last.handoff.role, "Site owner");
  assert.match(last.audience, /designated reviewer/i);
});

test("the website team delivers the same V1 and revised V2, then leaves the decision with the reviewer", () => {
  const frames = run("team");
  assert.deepEqual(frames.map(frame => frame.case.stage),
    ["processing","review","blocked","processing","review"]);
  const v1 = frames[1].case, revised = frames[3].case, delivered = frames.at(-1);
  assert.equal(v1.versions[0].rev, 1);
  assert.equal(revised.candidateOverride, delivered.case.versions[1].candidate);
  assert.deepEqual(delivered.case.versions[0], v1.versions[0]);
  assert.equal(delivered.case.accepted, null);
  assert.equal(delivered.case.authorization, null);
  assert.equal(delivered.case.receipt, null);
  assert.equal(delivered.handoff.role, "Reviewer");
  assert.ok(revised.trail.some(event => event.action === "edit" && event.actor === "Website team"));
  assert.deepEqual(delivered.case.versions, run("customer").at(-1).case.versions);
});

test("the site owner starts with the identical accepted V2 and separately authorizes its simulated release", () => {
  const frames = run("publisher"), accepted = frames[0].case;
  assert.deepEqual(frames.map(frame => frame.case.stage), ["release","authorized","published"]);
  assert.deepEqual(accepted.versions, run("customer").at(-1).case.versions);
  assert.equal(accepted.accepted.rev, 2);
  assert.equal(accepted.authorization, null);
  assert.equal(engine.transition(accepted, "publish"), accepted);
  assert.equal(frames[1].case.authorization.rev, 2);
  assert.equal(frames[1].case.authorization.actor, "Site owner");
  assert.equal(frames[1].case.receipt, null);
  assert.deepEqual(frames[2].case.versions, accepted.versions);
  assert.deepEqual(frames[2].case.receipt, {rev:2,target:"WinQuote homepage",simulated:true});
});

test("one changed concern changes the shared candidate, revision and reviewer question across all roles", () => {
  const [sending, paths] = engine.hesitationAnswers;
  const first = run("customer", sending), second = run("customer", paths);
  const firstV2 = first.at(-1).case.versions[1], secondV2 = second.at(-1).case.versions[1];
  assert.equal(first[0].case.text, second[0].case.text);
  assert.equal(firstV2.view.proposal.branch, "sending");
  assert.equal(secondV2.view.proposal.branch, "paths");
  assert.notEqual(firstV2.candidate, secondV2.candidate);
  assert.notEqual(firstV2.adjustment, secondV2.adjustment);
  assert.notEqual(firstV2.view.proposal.reviewQuestion, secondV2.view.proposal.reviewQuestion);
  for (const role of personas.list) {
    assert.deepEqual(run(role.id, paths).at(-1).case.versions, second.at(-1).case.versions);
  }
  const typed = "I wanted to try a layout, but I thought it might email the customer.";
  assert.equal(run("customer", typed).at(-1).case.versions[1].answer, typed);
  assert.equal(run("publisher", typed).at(-1).case.stage, "published");
});

test("unknown or extra-scope concerns never fabricate a proposal, acceptance or release", () => {
  for (const answer of ["I do not know.", "I was worried it would send a quote. Also add a PDF export."]) {
    for (const role of personas.list) {
      const end = run(role.id, answer).at(-1);
      assert.equal(end.case.stage, "blocked");
      assert.equal(end.case.versions.length, 0);
      assert.equal(end.case.accepted, null);
      assert.equal(end.case.authorization, null);
      assert.equal(end.case.receipt, null);
      assert.equal(end.handoff.role, "Website team");
    }
  }
  const blank = run("customer", "").at(-1);
  assert.equal(blank.case.stage, "clarify");
  assert.equal(blank.handoff.role, "Requester");
});

test("cached role scenarios expose independent English frames and mark every scripted decision as simulated", () => {
  for (const role of personas.list) {
    const first = run(role.id), snapshot = JSON.stringify(first);
    const second = personas.frames(role.id);
    assert.deepEqual(first, second);
    assert.doesNotMatch(JSON.stringify(first), /\p{Script=Han}/u);
    assert.ok(first.every(frame => frame.case.trail.every(event => event.simulated)));
    assert.ok(first.filter(frame => frame.case.answer).every(frame => frame.case.answerSimulated));
    assert.ok(first.filter(frame => frame.case.accepted).every(frame => frame.case.accepted.simulated));
    assert.ok(first.filter(frame => frame.case.authorization).every(frame => frame.case.authorization.simulated));
    const versioned = second.find(frame => frame.case.versions.length);
    versioned.case.versions[0].candidate = "Changed outside the cached scenario";
    assert.equal(JSON.stringify(first), snapshot);
    assert.notEqual(personas.frames(role.id).find(frame=>frame.case.versions.length).case.versions[0].candidate, versioned.case.versions[0].candidate);
  }
  assert.throws(() => personas.start("unknown"), /unavailable/);
});
