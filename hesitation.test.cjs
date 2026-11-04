"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");

const ask = (feedback = E.hesitationFeedback) => E.transition(E.createCase(feedback), "submit");
const answer = (asked, reply) => E.transition(asked, "answer", reply);

function drive(c) {
  const frames = [c];
  while (frames.length < 15) {
    const next = E.step(frames.at(-1));
    if (next === frames.at(-1)) return frames;
    frames.push(next);
  }
  assert.fail("The guided walkthrough did not stop.");
}

function proposalFor(c, expected) {
  assert.deepEqual([c.stage, c.owner], ["processing", "Website team"]);
  const v = E.derive(c);
  assert.equal(v.kind, "hesitation");
  assert.equal(v.proposal.branch, expected);
  assert.ok(v.candidate.trim());
  assert.ok(!v.candidate.includes(c.answer), "A customer concern is evidence, not proposed copy.");
  const manual = v.checks.find(k => k.status === "manual" && k.source === c.answer &&
    [k.label, k.value].some(field => field?.includes(v.proposal.reviewQuestion)));
  assert.ok(manual, "Send the reviewer a question grounded in the customer's original answer.");
  return v;
}

test("the same Create feedback asks about hesitation and forks into two different proposals and review questions", () => {
  const asked = ask();
  assert.deepEqual([asked.stage, asked.owner], ["clarify", "Requester"]);
  assert.equal(asked.text, E.hesitationFeedback);
  const v = E.derive(asked);
  assert.equal(v.kind, "hesitation");
  assert.equal(v.question.type, "hesitation");
  assert.match(v.question.text, /hesitat|pause|unsure|hold back|expect/i);
  assert.doesNotMatch(v.question.text, /what.*should.*(label|button).*say|replacement wording/i);
  assert.deepEqual(v.question.options, E.hesitationAnswers);
  assert.equal(v.question.options.length, 2);
  assert.equal(v.candidate, "");
  assert.equal(E.transition(asked, "deliver"), asked);

  const [a, b] = v.question.options.map(reply => answer(asked, reply));
  assert.deepEqual([a.answer, b.answer], v.question.options);
  assert.equal(a.text, b.text);
  assert.equal(a.text, E.hesitationFeedback);
  const first = proposalFor(a, "sending"), second = proposalFor(b, "paths");
  assert.notEqual(first.candidate, second.candidate);
  assert.notEqual(first.proposal.reviewQuestion, second.proposal.reviewQuestion);
  assert.match(first.proposal.items.map(i=>i.detail).join(" "), /send|sent|share|email/i);
  assert.match(first.proposal.reviewQuestion, /customer|send|sent|share|email/i);
  assert.ok(second.proposal.items.length >= 2);
  assert.match(second.proposal.items.map(i=>i.label).join(" "), /template/i);
  assert.match(second.proposal.items.map(i=>i.label).join(" "), /scratch/i);
  assert.ok(second.proposal.items.every(i=>i.detail.trim()), "Each entry needs a cue for when to use it.");
  assert.match(second.proposal.reviewQuestion, /choos|which|path|entry|template|scratch/i);
});

test("typed replies work without matching a preset; an unrecognized reason stays with the team", () => {
  const asked = ask("Create 看不懂");
  assert.equal(E.derive(asked).question.type, "hesitation");
  for (const [reply, branch] of [
    ["I thought the button would email the quote to our customer.", "sending"],
    ["I couldn’t tell if I should use a template or start from scratch.", "paths"]
  ]) {
    assert.ok(!E.hesitationAnswers.includes(reply));
    const c = answer(asked, reply);
    assert.equal(c.text, "Create 看不懂");
    assert.equal(c.answer, reply);
    assert.equal(c.answerSimulated, false);
    proposalFor(c, branch);
  }
  for (const reply of ["I’m not sure why I paused.", "The lettering was too small on my screen."]) {
    const c = answer(asked, reply), v = E.derive(c);
    assert.deepEqual([c.stage, c.owner, c.answer], ["blocked", "Website team", reply]);
    assert.ok(!v.proposal);
    assert.equal(v.candidate, "");
    assert.equal(E.transition(c,"deliver"),c);
    assert.equal(E.step(c),c);
    assert.deepEqual(c.versions,[]);
  }
});

test("a reviewer can send a branch back to the team without changing the delivered V1", () => {
  const review = E.transition(answer(ask(), E.hesitationAnswers[0]), "deliver");
  const v1 = JSON.stringify(review.versions[0]);
  const requested = E.transition(review, "adjust", "Say explicitly that the quote stays private.");
  assert.equal(requested.rev, 2);
  assert.equal(requested.owner, "Website team");
  assert.equal(E.transition(requested, "deliver"), requested, "Do not silently deliver V1 again.");
  const copy = "Configure a walk-in\nThis opens a private draft. No quote is sent to the customer.";
  const revised = E.editCandidate(requested, copy);
  const rereview = E.transition(revised, "deliver");
  assert.deepEqual([rereview.stage, rereview.owner], ["review", "Reviewer"]);
  assert.equal(rereview.versions[1].candidate, copy);
  assert.equal(rereview.versions[1].answer, E.hesitationAnswers[0]);
  assert.equal(JSON.stringify(rereview.versions[0]), v1);
  assert.equal(rereview.authorization, null);
  assert.equal(E.transition(rereview, "accept").accepted.rev, 2);
});

test("the walkthrough preserves the first delivery and keeps acceptance, authorization and release distinct on both branches", () => {
  const asked = ask();
  const [send, paths] = E.hesitationAnswers;
  const sendReview = E.transition(answer(asked, send), "deliver");
  const frozen = JSON.stringify(sendReview.versions[0]);
  // Starting another answer from the same clarification must not rewrite a delivered proposal.
  for (const [reply, branch] of [[send, "sending"], [paths, "paths"]]) {
    const frames = drive(answer(asked, reply));
    assert.deepEqual(frames.map(c => c.stage), ["processing", "review", "release", "authorized", "published"]);
    const [, review, accepted, authorized, released] = frames;
    assert.equal(review.owner, "Reviewer");
    assert.equal(review.versions[0].view.proposal.branch, branch);
    assert.equal(review.versions[0].answer, reply);
    assert.equal(review.versions[0].source, asked.text);
    assert.equal(E.transition(review, "authorize"), review);
    assert.equal(accepted.accepted.actor, "Reviewer");
    assert.equal(accepted.owner, "Site owner");
    assert.equal(accepted.authorization, null);
    assert.equal(E.transition(accepted, "publish"), accepted);
    assert.equal(authorized.authorization.actor, "Site owner");
    assert.equal(authorized.receipt, null);
    assert.deepEqual(released.receipt, {rev:1, target:"WinQuote homepage", simulated:true});
    assert.deepEqual(released.versions, review.versions);
  }
  assert.equal(JSON.stringify(sendReview.versions[0]), frozen);
  assert.equal(asked.answer, "");
  const automatic = drive(E.createCase(E.hesitationFeedback));
  assert.equal(automatic.at(-1).stage, "published");
  assert.equal(automatic.at(-1).answerSimulated, true);
  assert.equal(automatic.at(-1).versions[0].answer, send);
});

test("explicit replacement copy skips clarification; the original unspecified-label path still asks for wording", () => {
  const exact = ask('Rename the homepage "Create" button to "Start a quote".');
  assert.equal(exact.stage, "processing");
  assert.equal(E.derive(exact).question, null);
  assert.equal(E.derive(exact).candidate, "Start a quote");
  const generic = ask("New employees find the homepage quote button label confusing.");
  assert.equal(generic.stage, "clarify");
  assert.equal(E.derive(generic).kind, "button");
  assert.deepEqual(E.derive(generic).question.options, []);
  assert.equal(E.derive(answer(generic, "Request a quote")).candidate, "Request a quote");
});
