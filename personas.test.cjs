"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("./engine.js");
const personas = require("./personas.js");

function run(id) {
  const frames = [personas.start(id)];
  while (!frames.at(-1).done) {
    const current = frames.at(-1);
    const saved = JSON.stringify(current);
    frames.push(personas.next(current));
    assert.equal(JSON.stringify(current), saved, "earlier frames must remain unchanged for rewind");
    assert.ok(frames.length <= current.total);
  }
  assert.equal(frames.length, frames[0].total);
  assert.equal(personas.next(frames.at(-1)), frames.at(-1));
  return frames;
}

test("the customer clarifies once, requests a revision, then accepts the version authorized for release", () => {
  const frames = run("customer");
  assert.deepEqual(frames.map(f => f.case.stage),
    ["draft", "clarify", "processing", "review", "processing", "review", "release", "authorized", "published"]);
  assert.equal(engine.derive(frames[3].case).candidate, "Start a quote");
  assert.equal(engine.derive(frames[5].case).candidate, "Build my quote");
  assert.equal(frames[5].case.versions.length, 2);
  assert.deepEqual(frames[5].case.versions[0], frames[3].case.versions[0]);
});

test("the team keeps delivery until the requester explicitly changes the impossible limit", () => {
  const frames = run("team");
  const stopped = engine.derive(frames[1].case);
  assert.ok(stopped.blocked);
  assert.ok(stopped.checks.some(check => check.status === "fail"));
  assert.equal(frames[1].case.versions.length, 0);
  assert.match(frames[1].case.text, /3 words/);
  assert.match(frames[2].case.text, /10 words/);
  assert.ok(!engine.derive(frames[2].case).blocked);
  assert.equal(frames.at(-1).case.stage, "review");
});

test("the publisher walkthrough uses the accepted saved copy and separates authorization from execution", () => {
  const frames = run("publisher");
  assert.deepEqual(frames.map(frame => frame.case.stage), ["release", "authorized", "published"]);
  assert.equal(frames[0].case.versions.length, 2);
  assert.deepEqual(frames[2].case.versions, frames[0].case.versions);
  assert.equal(engine.derive(frames[2].case).candidate, "Build my quote");
  assert.equal(personas.start("customer").case.versions.length, 0);
});

test("all three sample walkthroughs display English at every step", () => {
  for (const role of personas.list) {
    for (const frame of run(role.id)) {
      const payload = [role, frame.title, frame.description, frame.case, engine.derive(frame.case)];
      assert.doesNotMatch(JSON.stringify(payload), /\p{Script=Han}/u);
    }
  }
});
