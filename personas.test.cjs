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

test("a requester may personally accept V1 without running the scripted V2 and every role follows that exact acceptance", () => {
  const original = personas.frames("customer"), before = JSON.stringify(original);
  const i = original.findIndex(frame=>frame.case.stage === "review");
  assert.equal(personas.canReview(original[i]),true);
  const decided = personas.decide(original,i,"accept"), accepted = decided.at(-1);
  assert.equal(JSON.stringify(original),before);
  assert.equal(accepted.case.stage,"release");
  assert.deepEqual(accepted.case.accepted,{rev:1,actor:"Reviewer",simulated:false});
  assert.equal(accepted.case.versions.length,1);
  assert.equal(accepted.case.authorization,null);
  assert.equal(accepted.case.receipt,null);
  assert.equal(accepted.handoff.title,"V1 accepted");
  assert.match(accepted.outcome,/V1/);
  assert.equal(accepted.case.trail.at(-1).simulated,false);
  const publisher = personas.from("publisher",accepted);
  assert.deepEqual(publisher.map(frame=>frame.case.stage),["release","authorized","published"]);
  assert.equal(publisher.at(-1).case.receipt.rev,1);
  assert.deepEqual(publisher.at(-1).case.versions,accepted.case.versions);
  const team = personas.from("team",accepted);
  assert.equal(team.length,1);
  assert.equal(team[0].handoff.role,"Site owner");
  assert.deepEqual(team[0].case.versions,accepted.case.versions);
  assert.equal(personas.frames("publisher").at(-1).case.receipt.rev,2,"Trying V1 must not rewrite the default sample.");
});

test("both concern branches allow a real V1 to V2 to V3 revision and leave each delivered version open for a personal decision", () => {
  for (const answer of engine.hesitationAnswers) {
    let frames = personas.frames("customer",answer), index = frames.findIndex(frame=>frame.case.stage === "review");
    let frozen = JSON.stringify(frames[index].case.versions);
    for (const rev of [2,3]) {
      const source = frames[index], before = JSON.stringify(frames), note = personas.suggestChange(source.case);
      assert.ok(note);
      frames = personas.decide(frames,index,"adjust",note);
      assert.equal(JSON.stringify(source.case.versions),frozen);
      assert.equal(JSON.stringify(source),JSON.stringify(JSON.parse(before)[index]));
      const end = frames.at(-1), c = end.case;
      assert.equal(c.stage,"review");
      assert.equal(c.rev,rev);
      assert.equal(c.versions.length,rev);
      assert.equal(c.adjustment,note);
      assert.equal(end.awaitingDecision,true);
      assert.equal(end.done,true);
      assert.equal(personas.canReview(end),true);
      assert.equal(c.accepted,null);
      assert.equal(c.authorization,null);
      assert.notEqual(c.versions.at(-1).candidate,c.versions.at(-2).candidate);
      assert.equal(c.trail.filter(event=>event.action === "adjust").at(-1).simulated,false);
      assert.equal(c.trail.at(-1).simulated,true,"The team delivery is still simulated.");
      const owner = personas.from("publisher",end);
      assert.equal(owner.length,1);
      assert.equal(owner[0].case.stage,"review");
      assert.equal(owner[0].handoff.role,"Reviewer");
      assert.equal(owner[0].case.accepted,null);
      assert.equal(owner[0].case.receipt,null);
      assert.deepEqual(personas.from("team",end)[0].case.versions,c.versions);
      frozen = JSON.stringify(c.versions);
      index = frames.length - 1;
    }
    frames = personas.decide(frames,index,"accept");
    const accepted = frames.at(-1);
    assert.equal(accepted.case.accepted.rev,3);
    const publisher = personas.from("publisher",accepted);
    assert.equal(publisher.at(-1).case.receipt.rev,3);
    assert.equal(JSON.stringify(publisher.at(-1).case.versions),frozen);
  }
});

test("unsupported revisions stay with the team rather than pretending to resolve keyword matches or extra requirements", () => {
  const frames = personas.frames("customer"), index = frames.findIndex(frame=>frame.case.stage === "review");
  for (const note of ["Change the customer quote to a red button.","Send the quote to the customer immediately.",
    "Make the text warmer.","Make it explicit that opening the configurator does not send a quote to the customer. Also add a PDF export."]) {
    const held = personas.decide(frames,index,"adjust",note).at(-1);
    assert.equal(held.case.stage,"blocked");
    assert.equal(held.handoff.role,"Website team");
    assert.equal(held.case.adjustment,note);
    assert.equal(held.case.versions.length,1);
    assert.equal(held.case.accepted,null);
    assert.equal(held.case.authorization,null);
    assert.equal(held.case.receipt,null);
    assert.equal(personas.from("publisher",held)[0].case.stage,"blocked");
  }
});

test("review controls cannot create a decision outside a delivered requester review and branching never falls into the default future", () => {
  const frames = personas.frames("customer");
  for (const index of [0,1,2,4,5,7]) {
    assert.equal(personas.canReview(frames[index]),false);
    assert.equal(personas.decide(frames,index,"accept"),frames);
  }
  const i = frames.findIndex(frame=>frame.case.stage === "review");
  assert.equal(personas.decide(frames,i,"adjust",""),frames);
  assert.equal(personas.decide(frames,i,"authorize"),frames);
  const team = personas.frames("team");
  assert.equal(personas.decide(team,1,"accept"),team);
  const branch = personas.decide(frames,i,"adjust",personas.suggestChange(frames[i].case));
  const requested = branch[i + 1];
  assert.equal(personas.next(requested),requested,"A branch must not silently resume the default V2 future.");
  assert.deepEqual(personas.next(requested,branch),branch[i + 2]);
});

test("a user-supplied concern remains personal in every snapshot and derived role, while restarting restores the authored sample", () => {
  const answer = engine.hesitationAnswers[1];
  const frames = personas.frames("customer",answer,{personalAnswer:true});
  for (const frame of frames.filter(item=>item.case.answer)) {
    assert.equal(frame.personalAnswer,true);
    assert.equal(frame.case.answerSimulated,false);
    assert.equal(frame.case.trail.find(event=>event.action === "answer").simulated,false);
    assert.ok(frame.case.versions.every(version=>version.answerSimulated === false));
  }
  const publisher = personas.from("publisher",frames.at(-1));
  assert.ok(publisher.every(frame=>!frame.case.answerSimulated));
  assert.ok(publisher.at(-1).case.versions.every(version=>version.answerSimulated === false));
  const reset = personas.frames("customer");
  assert.equal(reset[2].case.answer,engine.hesitationAnswers[0]);
  assert.equal(reset[2].case.answerSimulated,true);
  assert.equal(reset.at(-1).case.versions.length,2);
});

test("team practice preserves two edited fields in the exact release handoff and accepts only from requester review", () => {
  const start = personas.teamStart();
  assert.equal(start.case.answer, engine.hesitationAnswers[1]);
  assert.equal(start.case.stage, "processing");
  const [review1] = personas.teamSteps(start, "deliver");
  const v1 = structuredClone(review1.case.versions[0]);
  assert.equal(review1.case.trail.at(-1).simulated, false);
  const [revise] = personas.teamSteps(review1, "sample-change");
  assert.equal(revise.case.trail.at(-1).simulated, true);
  assert.deepEqual(personas.teamSteps(revise, "deliver", revise.items), []);
  const items = [{label:"Use a standard template", detail:"For a standard walk-in, use a preset.\n\nConfirm its size first."},
    {label:"Custom from scratch", detail:"Choose the custom layout for your own dimensions."}];
  const [edit, review2] = personas.teamSteps(revise, "deliver", items);
  assert.equal(edit.case.trail.at(-1).simulated, false);
  const v2 = review2.case.versions[1];
  assert.deepEqual(v2.view.proposal.items, items);
  assert.equal(v2.candidate, items.map(row=>row.label+"\n"+row.detail).join("\n\n"));
  for (const question of [v2.view.proposal.reviewQuestion,v2.checks.find(row=>row.id==="revision").value]) {
    assert.match(question,/Custom from scratch/);
    assert.doesNotMatch(question,/Confirm its size first/);
  }
  assert.deepEqual(review2.case.versions[0],v1);
  assert.deepEqual(personas.teamSteps(review2, "sample-change"), []);
  assert.deepEqual(personas.teamSteps(review2, "accept"), []);
  const [asRequester] = personas.teamSteps(review2, "view-requester");
  assert.deepEqual(asRequester.case,review2.case);
  const [accepted] = personas.teamSteps(asRequester, "accept");
  assert.equal(accepted.case.stage,"release");
  assert.equal(accepted.case.owner,"Site owner");
  assert.equal(accepted.case.accepted.rev,2);
  assert.equal(accepted.case.accepted.simulated,false);
  assert.equal(accepted.case.authorization,null);
  assert.equal(accepted.case.receipt,null);

  const [revise3] = personas.teamSteps(asRequester, "adjust", "Make it shorter.");
  assert.equal(revise3.personaId,"team");
  assert.equal(revise3.case.rev,3);
  assert.deepEqual(personas.teamSteps(revise3, "deliver",items),[]);
  const short = [{label:"Use a template",detail:"Standard walk-in."},{label:"Start from scratch",detail:"Custom walk-in."}];
  const v3 = personas.teamSteps(revise3, "deliver", short).at(-1);
  assert.equal(v3.case.stage,"review");
  assert.deepEqual(v3.case.versions[1],v2);
  assert.equal(v3.case.versions[2].rev,3);
});

test("owner perspective, human approval and simulated execution are separate and bound to one frozen version", () => {
  let frame = personas.teamStart();
  frame = personas.teamSteps(frame,"deliver").at(-1);
  frame = personas.teamSteps(frame,"sample-change").at(-1);
  const items=[{label:"Standard template",detail:"Start a standard walk-in from the preset."},
    {label:"Start from scratch",detail:"Choose custom sizes for your layout."}];
  const sent=personas.teamSteps(frame,"deliver",items).at(-1);
  const reviewer=personas.teamSteps(sent,"view-requester")[0];
  assert.deepEqual(personas.releaseSteps(reviewer,"view-owner",2),[]);
  const [accepted]=personas.teamSteps(reviewer,"accept");
  const version=structuredClone(accepted.case.versions[1]);
  assert.equal(personas.canOpenOwner(accepted),true);
  assert.deepEqual(personas.releaseSteps(accepted,"approve",2),[]);
  assert.deepEqual(personas.releaseSteps(accepted,"view-owner",1),[]);
  const [owner]=personas.releaseSteps(accepted,"view-owner",2);
  assert.equal(owner.case,accepted.case);
  assert.equal(owner.case.authorization,null);
  assert.equal(owner.case.receipt,null);
  assert.deepEqual(personas.releaseSteps(owner,"view-owner",2),[]);
  assert.deepEqual(personas.releaseSteps(owner,"approve",1),[]);
  assert.deepEqual(personas.releaseSteps(owner,"execute",2),[]);
  const [authorized]=personas.releaseSteps(owner,"approve",2);
  assert.equal(authorized.case.owner,"Website team");
  assert.deepEqual(authorized.case.authorization,{rev:2,actor:"Site owner",target:"WinQuote homepage",simulated:false});
  assert.equal(authorized.case.receipt,null);
  assert.deepEqual(personas.releaseSteps(authorized,"approve",2),[]);
  assert.deepEqual(personas.releaseSteps(authorized,"execute",1),[]);
  const [published]=personas.releaseSteps(authorized,"execute",2);
  assert.deepEqual(published.case.receipt,{rev:2,target:"WinQuote homepage",simulated:true});
  assert.deepEqual(published.case.versions.at(-1),version);
  assert.deepEqual(published.case.trail.slice(-2).map(({action,actor,simulated})=>[action,actor,simulated]),
    [["authorize","Site owner",false],["publish","Website team",true]]);
  assert.deepEqual(personas.releaseSteps(published,"execute",2),[]);
  assert.deepEqual(personas.releaseSteps(published,"approve",2),[]);

  const customer=personas.frames("customer",engine.hesitationAnswers[0],{personalAnswer:true});
  const early=personas.decide(customer,3,"accept").at(-1);
  assert.equal(early.case.accepted.rev,1);
  assert.equal(personas.canOpenOwner(early),true);
  assert.equal(personas.releaseSteps(early,"view-owner",1)[0].case.versions[0],early.case.versions[0]);
  const example=personas.frames("customer",engine.hesitationAnswers[0]).at(-1);
  assert.equal(personas.canOpenOwner(example),false);
  assert.deepEqual(personas.releaseSteps(example,"view-owner",2),[]);
});
