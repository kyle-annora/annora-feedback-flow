"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const E = require("./engine.js");
const clone = value => JSON.parse(JSON.stringify(value));
const frozen = value => { if (value && typeof value === "object") { Object.values(value).forEach(frozen); Object.freeze(value); } return value; };
const act = (c,action,value) => E.review(c,action,value);
const pdf = () => E.createReviewedCase(E.pdfFeedback);
function ready(c = pdf(),scope = c.reviewFlow.scope) {
  c = act(c,"confirm-scope",scope);
  return act(c,"prepare-result");
}
function delivered(c = pdf(),scope = c.reviewFlow.scope) { return E.transition(ready(c,scope),"deliver"); }
function answered(answer) {
  let c = act(pdf(),"draft-questions");
  c = act(c,"send-questions");
  return E.transition(c,"answer",answer);
}

test("new reviewed cases stay original CaseEngine records and begin with team triage, including the zero-question PDF scope", () => {
  const c = pdf(), before = JSON.stringify(c);
  assert.equal(c.stage,"processing");
  assert.equal(c.owner,"Website team");
  assert.equal(c.reviewFlow.phase,"triage");
  assert.equal(c.reviewFlow.source.id,"fb_2026-07-11_002");
  assert.equal(c.reviewFlow.source.history.at(-1).date,"2026-08-05");
  assert.equal(c.reviewFlow.kind,"behavior");
  assert.equal(c.reviewFlow.sentBundle,null);
  assert.equal(c.answer,"");
  assert.deepEqual(c.versions,[]);
  assert.equal(E.derive(c).question,null);
  assert.equal(E.derive(c).blocked,true);
  assert.equal(E.step(c),c,"A walkthrough must not silently make the team’s triage decision.");
  assert.equal(JSON.stringify(c),before);
  assert.throws(()=>act(c,"confirm-scope"),/Explicit team-selected scope/);
  assert.throws(()=>E.transition(c,"deliver"),/unavailable/);
  const unrelated = E.createReviewedCase("Add a PDF export to pricing rules.");
  assert.equal(unrelated.reviewFlow.source.id,null,"Do not attach this historical record to arbitrary PDF feedback.");
  assert.equal(unrelated.reviewFlow.source.historical,false);
  assert.equal(E.createCase(E.pdfFeedback).stage,"draft","The legacy constructor remains unchanged.");
});

test("opting unfinished original work into team review preserves the same source, versions, revision and actual answer", () => {
  let c = E.transition(E.createCase(E.hesitationFeedback),"submit");
  c = E.transition(c,"answer",E.hesitationAnswers[0]);
  c = E.transition(c,"deliver");
  c = E.transition(c,"adjust","Make it clearer that opening the configurator does not send anything to the customer.");
  const before = JSON.stringify(c), converted = E.beginTeamReview(frozen(c));
  assert.equal(JSON.stringify(c),before);
  for (const key of ["text","rev","answer","answerKey","answerSimulated","adjustment","adjustments","versions"]) assert.deepEqual(converted[key],c[key]);
  assert.deepEqual(converted.trail.slice(0,-1),c.trail);
  assert.equal(converted.trail.at(-1).action,"begin-team-review");
  assert.equal(converted.reviewFlow.phase,"triage");
  assert.equal(converted.reviewFlow.sentBundle,null);
  assert.equal(converted.reviewFlow.legacyContext.answer,c.answer);
  assert.equal(E.beginTeamReview(converted),converted);
  for (const state of [delivered(),act(delivered(),"accept",{rev:1})]) assert.equal(E.beginTeamReview(state),state);
  const legacyReview = E.transition(E.transition(E.createCase('Change the homepage button label to "Start a quote".'),"submit"),"deliver");
  assert.throws(()=>E.beginTeamReview(legacyReview),/frozen/);
  let draft = act(converted,"confirm-scope",{approach:"Configure a walk-in\nOpening the configurator does not send a quote to your customer.",checks:"Opening the configurator does not send a quote to the customer."});
  draft = act(draft,"prepare-result");
  const v2 = act(draft,"deliver");
  assert.equal(v2.rev,2);
  assert.equal(v2.versions.length,2);
  assert.deepEqual(v2.versions[0],c.versions[0]);
});

test("private question drafts and previews never become customer tasks until an ask-only bundle is explicitly sent", () => {
  const initial = act(pdf(),"draft-questions");
  const questions = clone(initial.reviewFlow.questionDraft);
  questions[0].text = "What do you need to do after opening the PDF?";
  const saved = act(frozen(initial),"save-questions",questions);
  assert.equal(saved.stage,"processing");
  assert.equal(saved.owner,"Website team");
  assert.equal(saved.reviewFlow.sentBundle,null);
  assert.equal(E.derive(saved).question,null);
  const preview = act(saved,"preview-questions");
  assert.equal(preview.reviewFlow.questionPreview.sent,false);
  assert.equal(preview.reviewFlow.sentBundle,null);
  const cancelled = act(preview,"close-questions");
  assert.equal(cancelled.reviewFlow.phase,"triage");
  assert.equal(cancelled.reviewFlow.questionDraft[0].text,questions[0].text);
  const sent = act(preview,"send-questions");
  assert.equal(sent.stage,"clarify");
  assert.equal(sent.owner,"Requester");
  assert.deepEqual(sent.reviewFlow.sentBundle.questions.map(q=>q.id),["next-step"]);
  assert.ok(sent.reviewFlow.sentBundle.questions.every(q=>q.disposition === "ask"));
  questions[0].text = "Changed outside the case";
  assert.notEqual(sent.reviewFlow.sentBundle.questions[0].text,questions[0].text);
  const unsafe = clone(saved.reviewFlow.questionDraft); unsafe[2].disposition = "ask";
  assert.throws(()=>act(saved,"save-questions",unsafe),/Screen and rewrite/);
  unsafe[2].screened = true; unsafe[2].text = "Do you normally return to edit this quote?";
  assert.equal(act(act(saved,"save-questions",unsafe),"send-questions").reviewFlow.sentBundle.questions.length,2);
  assert.throws(()=>act(sent,"answer",{"implementation":"Yes"}),/private question/);
  assert.throws(()=>act(sent,"answer",{}),/must contain text/);
});

test("PDF answers adapt suggested approach and checks but the website team explicitly confirms the scope", () => {
  const edit = answered("Keep editing this quote"), workflow = answered("Move on to next workflow step");
  assert.equal(edit.stage,"processing");
  assert.equal(edit.owner,"Website team");
  assert.equal(edit.reviewFlow.phase,"answer-review");
  assert.equal(edit.reviewFlow.candidateDraft,null);
  assert.notEqual(edit.reviewFlow.suggestedScope.approach,workflow.reviewFlow.suggestedScope.approach);
  assert.notEqual(edit.reviewFlow.suggestedScope.checks,workflow.reviewFlow.suggestedScope.checks);
  assert.match(edit.reviewFlow.suggestedScope.checks,/continue editing/);
  assert.match(workflow.reviewFlow.suggestedScope.approach,/explicit Go to Workflow/);
  assert.match(workflow.reviewFlow.suggestedScope.checks,/does not redirect/);
  assert.throws(()=>act(edit,"prepare-result"),/unavailable/);
  assert.throws(()=>act(edit,"confirm-scope"),/Explicit team-selected/);
  const chosen = {...edit.reviewFlow.suggestedScope,checks:"Confirm the same quote remains available to edit after the saved PDF opens."};
  const draft = act(edit,"confirm-scope",chosen);
  assert.equal(draft.reviewFlow.candidateDraft.checks,chosen.checks);
  assert.equal(draft.answer,"Keep editing this quote");
  let typed = act(pdf(),"draft-questions");
  const qs = clone(typed.reviewFlow.questionDraft); qs[0].type = "text"; qs[0].options = [];
  typed = act(act(typed,"save-questions",qs),"send-questions");
  typed = act(typed,"answer","Automatically redirect me to Workflow immediately.");
  assert.match(typed.reviewFlow.suggestedScope.conflict,/conflicts/);
  assert.match(typed.reviewFlow.suggestedScope.approach,/Keep the original quote on Make PDF/);
});

test("reviewed Create feedback reuses the original adaptive derivation while unsupported feedback needs an explicit team draft", () => {
  const results = E.hesitationAnswers.map(answer=>{
    let c = E.createReviewedCase(E.hesitationFeedback);
    c = act(c,"draft-questions"); c = act(c,"send-questions"); c = act(c,"answer",answer);
    c = act(c,"confirm-scope",c.reviewFlow.suggestedScope);
    return E.derive(c);
  });
  assert.equal(results[0].proposal.branch,"sending");
  assert.equal(results[1].proposal.branch,"paths");
  assert.notEqual(results[0].candidate,results[1].candidate);
  assert.notEqual(results[0].proposal.reviewQuestion,results[1].proposal.reviewQuestion);
  const known = E.createReviewedCase(E.initialFeedback);
  let draft = act(known,"confirm-scope",known.reviewFlow.scope);
  draft = act(draft,"edit-candidate",{approach:"Standard: template. Custom: from scratch. Add customer details next. Extra unnecessary words that definitely break this original word limit by several additional words."});
  assert.equal(E.derive(draft).blocked,true,"The reviewed path does not bypass the original word-limit assessment.");
  assert.throws(()=>act(draft,"prepare-result"),/over the limit/);
  const unknown = E.createReviewedCase("Change the pricing rules for discounts.");
  assert.equal(E.derive(unknown).manual,true);
  assert.throws(()=>act(unknown,"confirm-scope",{approach:"",checks:""}),/must contain text/);
  const explicit = act(unknown,"confirm-scope",{approach:"Team-authored proposal for the pricing rule; implementation is not simulated.",checks:"The business reviewer confirms the precise rule before development."});
  assert.equal(E.derive(explicit).manual,true);
  assert.equal(E.derive(explicit).blocked,false);
});

test("a simulated result and team check summary are required before delivery and are not evidence that the live feature works", () => {
  let c = act(pdf(),"confirm-scope",pdf().reviewFlow.scope);
  assert.throws(()=>act(c,"deliver"),/unavailable/);
  c = act(c,"begin-check");
  assert.equal(c.reviewFlow.phase,"checking");
  c = act(c,"prepare-result");
  assert.equal(c.reviewFlow.phase,"ready");
  assert.equal(c.reviewFlow.result.simulated,true);
  assert.equal(c.reviewFlow.result.implemented,false);
  assert.equal(c.reviewFlow.result.verified,false);
  assert.equal(c.reviewFlow.teamCheck.verified,false);
  assert.match(c.reviewFlow.teamCheck.summary,/not been executed or verified/);
  const tampered = clone(c); tampered.reviewFlow.candidateDraft.checks += "\nA new unchecked requirement.";
  assert.throws(()=>act(tampered,"deliver"),/current simulated result/);
  const saved = act(c,"edit-candidate",{checks:c.reviewFlow.candidateDraft.checks + "\nCheck the explicit Go to Workflow wording."});
  assert.equal(saved.reviewFlow.result,null);
  assert.equal(saved.reviewFlow.teamCheck,null);
  assert.equal(saved.reviewFlow.phase,"candidate");
  assert.throws(()=>act(saved,"deliver"),/unavailable/);
});

test("V1 freezes scope, sent questions, actual answers and simulated checks; V2 submits the actual edited candidate", () => {
  let c = answered("Keep editing this quote");
  c = delivered(c,c.reviewFlow.suggestedScope);
  const source = JSON.stringify(c), v1 = clone(c.versions[0]);
  assert.equal(v1.reviewFlow.answers["next-step"],"Keep editing this quote");
  assert.equal(v1.reviewFlow.sentBundle.questions.length,1);
  assert.equal(v1.result.approach,v1.candidate);
  assert.deepEqual(v1.teamCheck.checks,v1.checks);
  assert.deepEqual(v1.reviewFlow.confirmedScope,v1.reviewFlow.scope);
  c = E.transition(frozen(c),"adjust",{rev:1,reason:"Make the explicit workflow action easier to find."});
  assert.equal(c.rev,2);
  assert.equal(c.reviewFlow.phase,"candidate");
  assert.equal(c.owner,"Website team");
  assert.equal(c.reviewFlow.result,null);
  assert.throws(()=>act(c,"prepare-result"),/Revise the actual candidate/);
  const next = "Open the saved customer’s PDF in a new tab.\nKeep the same quote on Make PDF.\nShow a separate Go to Workflow action beside the saved PDF result.\n";
  c = E.editCandidate(c,next);
  c = act(c,"prepare-result"); c = E.transition(c,"deliver");
  assert.deepEqual(c.versions[0],v1);
  assert.equal(c.versions[1].candidate,next);
  assert.equal(c.versions[1].adjustment,"Make the explicit workflow action easier to find.");
  assert.equal(c.versions[1].result.rev,2);
  assert.equal(c.versions[1].result.approach,next);
  assert.equal(c.versions[1].answer,v1.answer);
  assert.equal(c.accepted,null);
  assert.equal(c.authorization,null);
  assert.equal(JSON.parse(source).versions[0].candidate,v1.candidate);
  assert.throws(()=>act(c,"accept",{rev:1}),/exact current submitted version/);
});

test("acceptance, site-owner authorization and execution remain separate exact-version original engine transitions", () => {
  let c = delivered(), v1 = clone(c.versions[0]);
  assert.throws(()=>E.transition(c,"authorize",{rev:1}),/exact accepted/);
  assert.throws(()=>E.transition(c,"accept"),/exact current submitted version/);
  c = E.transition(c,"accept",{rev:1});
  assert.deepEqual(c.accepted,{rev:1,actor:"Reviewer",simulated:false});
  assert.equal(c.stage,"release");
  assert.equal(c.authorization,null);
  assert.equal(c.receipt,null);
  assert.throws(()=>E.transition(c,"publish",{rev:1}),/exact accepted and authorized/);
  assert.throws(()=>E.transition(c,"authorize",{rev:2}),/exact current submitted version/);
  c.reviewFlow.target = "Changed after submission";
  c = E.transition(c,"authorize",{rev:1});
  assert.equal(c.authorization.target,v1.reviewFlow.target,"Authorize the submitted target, not a later working draft.");
  assert.equal(c.stage,"authorized");
  assert.equal(c.receipt,null);
  assert.throws(()=>E.transition(c,"publish",{rev:2}),/exact current submitted version/);
  c = E.transition(c,"publish",{rev:1});
  assert.equal(c.stage,"published");
  assert.equal(c.receipt.rev,1);
  assert.equal(c.receipt.target,"WinQuote · Make PDF");
  assert.equal(c.receipt.candidate,v1.candidate);
  assert.deepEqual(c.receipt.result,v1.result);
  assert.equal(c.receipt.simulated,true);
  assert.equal(c.receipt.implemented,false);
  assert.equal(c.receipt.verified,false);
  assert.equal(E.beginTeamReview(c),c);
});

test("reviewed records survive JSON persistence with frozen evidence and browser modules load without a second state engine", () => {
  const saved = delivered(answered("Move on to next workflow step"),answered("Move on to next workflow step").reviewFlow.suggestedScope);
  const restored = JSON.parse(JSON.stringify(saved));
  assert.deepEqual(E.derive(restored),E.derive(saved));
  let c = E.transition(restored,"accept",{rev:1}); c = E.transition(c,"authorize",{rev:1}); c = E.transition(c,"publish",{rev:1});
  assert.equal(c.receipt.rev,1);
  const context = {};
  for (const name of ["model.js","custom-story.js","hesitation.js","team-review.js","engine.js"]) vm.runInNewContext(fs.readFileSync(require.resolve("./" + name),"utf8"),context);
  const browser = context.CaseEngine.createReviewedCase(context.CaseEngine.pdfFeedback);
  assert.equal(browser.reviewFlow.phase,"triage");
  assert.equal(browser.stage,"processing");
  assert.equal(context.PDFFlow,undefined);
});

test("integrated walkthroughs use real reviewed CaseEngine transitions for PDF and both Create concerns", () => {
  const Story = require("./review-story.js");
  for (const options of [{kind:"pdf"},{kind:"pdf",ask:true,answer:"Keep editing this quote"},
    {kind:"create"}, {kind:"create",answer:E.hesitationAnswers[0]}]) {
    const frames = Story.build(options), end = frames.at(-1).case;
    assert.equal(end.stage,"published");
    assert.equal(end.rev,2);
    assert.equal(end.versions.length,2);
    assert.notEqual(end.versions[0].candidate,end.versions[1].candidate);
    assert.equal(end.receipt.verified,false);
    assert.equal(end.receipt.implemented,false);
    assert.ok(frames.every(frame=>frame.case.reviewFlow && frame.why && frame.role === frame.case.owner));
    const firstReview = frames.find(frame=>frame.case.stage === "review").case;
    assert.deepEqual(end.versions[0],firstReview.versions[0]);
    if (options.ask === true || options.kind === "create") {
      assert.ok(frames.some(frame=>frame.case.reviewFlow.questionPreview?.sent === false && !frame.case.reviewFlow.sentBundle));
    } else assert.ok(frames.every(frame=>frame.case.reviewFlow.sentBundle === null));
    if (options.answer !== undefined) assert.equal(end.answerSimulated,false);
  }
  const create = Story.build({kind:"create"}).at(-1).case;
  assert.equal(create.versions[0].view.proposal.branch,"paths");
  assert.equal(create.answer,E.hesitationAnswers[1]);
  assert.equal(create.answerSimulated,true);
});

test("walkthroughs stop for unsupported scope, missing answers or unresolved constraint conflicts", () => {
  const Story = require("./review-story.js");
  const unsupported = Story.build({kind:"own",text:"Add a PDF export to the discount settings."});
  assert.equal(unsupported.at(-1).case.reviewFlow.phase,"triage");
  assert.equal(unsupported.at(-1).case.versions.length,0);
  const missing = Story.build({kind:"own",text:"New employees find the homepage quote button label confusing."});
  assert.equal(missing.at(-1).case.stage,"clarify");
  assert.equal(missing.at(-1).case.versions.length,0);
  const conflicting = Story.build({kind:"pdf",ask:true,answer:"Automatically redirect me to Workflow immediately."});
  assert.equal(conflicting.at(-1).case.reviewFlow.phase,"answer-review");
  assert.match(conflicting.at(-1).why,/conflicts/);
  assert.equal(conflicting.at(-1).case.accepted,null);
  const unknown = Story.build({kind:"create",answer:"I don't know why I paused."});
  assert.equal(unknown.at(-1).case.reviewFlow.phase,"answer-review");
  assert.equal(unknown.at(-1).case.versions.length,0);
  assert.equal(Story.build({kind:"pdf",adjust:false}).at(-1).case.receipt.rev,1);
});

test("the PDF interactive model is bound to authored behavior and checks, not arbitrary edited text", () => {
  const initial = pdf();
  assert.equal(E.reviewPreview(initial).interactive,false);
  const known = ready(initial);
  assert.equal(E.reviewPreview(known).interactive,true);
  assert.equal(E.reviewPreview(E.derive(known)).interactive,true);
  assert.equal(E.reviewPreview(known.reviewFlow.result).interactive,true);
  let changed = act(known,"edit-candidate",{approach:"Replace PDF generation with a CSV export and immediately redirect to Workflow."});
  assert.equal(E.reviewPreview(changed).interactive,false,"Editing invalidates the old interaction immediately.");
  changed = act(changed,"prepare-result");
  assert.equal(E.reviewPreview(changed).interactive,false,"A new textual simulation does not imply an authored interactive model exists.");
  const sent = act(changed,"deliver");
  assert.equal(E.reviewPreview(sent).interactive,false);
  assert.equal(E.derive(sent).candidate,changed.reviewFlow.candidateDraft.approach);
  const customChecks = act(known,"edit-candidate",{checks:"Automatically email the PDF to the customer and redirect to Workflow."});
  assert.equal(E.reviewPreview(act(customChecks,"prepare-result")).interactive,false);
  const tampered = clone(known); tampered.reviewFlow.candidateDraft.approach += "\nA different unprepared action.";
  assert.equal(E.reviewPreview(tampered).interactive,false);
  const Story = require("./review-story.js");
  for (const options of [{kind:"pdf"},{kind:"pdf",ask:true,answer:"Keep editing this quote"},{kind:"pdf",ask:true,answer:"Move on to next workflow step"}]) {
    const frames = Story.build(options);
    assert.ok(frames.filter(frame=>frame.case.stage === "review").every(frame=>E.reviewPreview(frame.case).interactive));
  }
});

test("reviewed Create questions preserve suggested concerns and allow a different actual answer without changing the PDF single-choice contract", () => {
  let c = E.createReviewedCase(E.hesitationFeedback);
  assert.equal(c.reviewFlow.questionDraft[0].type,"text");
  assert.deepEqual(c.reviewFlow.questionDraft[0].options,E.hesitationAnswers);
  c = act(act(c,"draft-questions"),"send-questions");
  c = act(c,"answer","I thought the button might email a quote to the customer.");
  assert.equal(c.answerSimulated,false);
  assert.match(c.reviewFlow.suggestedScope.approach,/Nothing is sent/);
  let unknown = E.createReviewedCase(E.hesitationFeedback);
  unknown = act(act(unknown,"draft-questions"),"send-questions");
  unknown = act(unknown,"answer","The lettering was too small for me to read.");
  assert.equal(unknown.reviewFlow.phase,"answer-review");
  assert.equal(unknown.reviewFlow.suggestedScope.approach,"");
  assert.equal(pdf().reviewFlow.questionDraft[0].type,"single");
});

const journeyPDF = () => E.createReviewedCase(E.pdfFeedback,{journey:true});
function sharedJourney(c = journeyPDF(),understanding = "Open the saved PDF while retaining the quote, with an optional Workflow action.") {
  return act(c,"confirm-scope",{...c.reviewFlow.scope,understanding});
}
function detailedJourney(answer = "Beside the PDF result",initial = true) {
  let c = journeyPDF();
  if (initial) {
    c = act(act(c,"draft-questions"),"send-questions");
    c = act(c,"answer","Keep editing this quote");
    c = act(c,"confirm-scope",{...c.reviewFlow.suggestedScope,understanding:"Open the PDF and retain the same quote for editing."});
  } else c = sharedJourney(c);
  c = act(c,"begin-detailed-questions");
  c = act(c,"send-questions");
  return act(c,"answer",answer);
}

test("the journey shares a separate understanding before any candidate and private edits cannot silently rewrite it", () => {
  const initial = journeyPDF(), text = initial.text;
  let c = sharedJourney(initial), shared = clone(c.reviewFlow.sharedUnderstanding);
  assert.equal(c.stage,"processing");
  assert.equal(c.owner,"Website team");
  assert.equal(c.reviewFlow.phase,"spec-review");
  assert.equal(c.reviewFlow.candidateDraft,null);
  assert.equal(c.reviewFlow.questionRounds.length,0);
  assert.equal(shared.text,"Open the saved PDF while retaining the quote, with an optional Workflow action.");
  assert.equal(shared.scopeCycle,1);
  assert.equal(shared.questionDraft,undefined);
  assert.equal(shared.sentBundle,undefined);
  assert.equal(shared.scope,undefined,"The public understanding does not contain the private question scope or draft.");
  c = act(c,"edit-scope",{approach:"Private team draft not yet shared.",checks:"Private unresolved investigation."});
  assert.deepEqual(c.reviewFlow.sharedUnderstanding,shared);
  c = act(c,"edit-understanding",{text:"The saved PDF opens separately; the quote stays available."});
  assert.equal(c.reviewFlow.sharedUnderstanding.text,"The saved PDF opens separately; the quote stays available.");
  assert.equal(c.reviewFlow.sharedUnderstanding.approach,shared.approach);
  assert.equal(c.reviewFlow.understandingHistory.length,2);
  const candidate = act(c,"finish-spec");
  assert.equal(candidate.reviewFlow.phase,"candidate");
  assert.equal(candidate.reviewFlow.candidateDraft.approach,shared.approach,"Finish only from the shared scope, never an unshared private edit.");
  assert.equal(candidate.text,text);
  assert.equal(candidate.reviewFlow.questionRounds.length,0,"Questions are optional; there is no fabricated acknowledgement.");
  assert.equal(pdf().reviewFlow.journey,undefined);
  assert.equal(ready().reviewFlow.phase,"ready","The legacy reviewed path still bypasses the opt-in spec step.");
});

test("customer understanding corrections preserve the raw request and old understanding and reopen team triage", () => {
  const original = sharedJourney(), before = JSON.stringify(original), shared = clone(original.reviewFlow.sharedUnderstanding);
  assert.throws(()=>act(original,"correct-understanding",{text:" "}),/must contain text/);
  let corrected = act(frozen(original),"correct-understanding",{text:"I need to keep editing the same quote, not move on yet."});
  assert.equal(JSON.stringify(original),before);
  assert.equal(corrected.text,E.pdfFeedback);
  assert.equal(corrected.reviewFlow.phase,"triage");
  assert.equal(corrected.owner,"Website team");
  assert.equal(corrected.reviewFlow.journey.scopeCycle,2);
  assert.equal(corrected.reviewFlow.sharedUnderstanding.needsRevision,true);
  assert.deepEqual(corrected.reviewFlow.understandingCorrections[0].understanding,shared);
  assert.equal(corrected.reviewFlow.understandingCorrections[0].text,"I need to keep editing the same quote, not move on yet.");
  assert.deepEqual(corrected.reviewFlow.understandingHistory[0],shared);
  assert.equal(corrected.reviewFlow.sentBundle,null);
  assert.equal(corrected.reviewFlow.candidateDraft,null);
  assert.equal(corrected.accepted,null);
  assert.throws(()=>act(corrected,"finish-spec"),/unavailable/);
  corrected = act(corrected,"confirm-scope",{...corrected.reviewFlow.scope,understanding:"Retain this same quote for editing while the PDF opens in a new tab."});
  assert.equal(corrected.reviewFlow.sharedUnderstanding.scopeCycle,2);
  assert.equal(corrected.reviewFlow.sharedUnderstanding.needsRevision,undefined);
  assert.equal(corrected.reviewFlow.understandingHistory.length,2);
  assert.equal(corrected.text,E.pdfFeedback);
  assert.equal(act(corrected,"finish-spec").reviewFlow.phase,"candidate");
});

test("asynchronous understanding corrections remain available until the candidate is sent and invalidate pending drafts or previews", () => {
  const shared = sharedJourney();
  const candidate = act(shared,"finish-spec"), checking = act(candidate,"begin-check"), readyState = act(checking,"prepare-result");
  for (const source of [candidate,checking,readyState]) {
    const before = JSON.stringify(source), correction = act(frozen(source),"correct-understanding",{text:"I need the same quote available for editing after the PDF opens."});
    assert.equal(JSON.stringify(source),before);
    assert.equal(correction.text,E.pdfFeedback);
    assert.equal(correction.reviewFlow.phase,"triage");
    assert.equal(correction.owner,"Website team");
    assert.equal(correction.reviewFlow.sharedUnderstanding.needsRevision,true);
    assert.equal(correction.reviewFlow.journey.scopeCycle,2);
    assert.equal(correction.reviewFlow.candidateDraft,null);
    assert.equal(correction.reviewFlow.result,null);
    assert.equal(correction.reviewFlow.teamCheck,null);
    assert.equal(correction.candidateOverride,null);
    assert.equal(correction.accepted,null);
    assert.equal(correction.authorization,null);
    assert.throws(()=>act(correction,"deliver"),/unavailable/);
  }
  const sent = act(readyState,"deliver");
  assert.throws(()=>act(sent,"correct-understanding",{text:"Change the sent version silently"}),/unavailable/);
  assert.equal(act(sent,"adjust",{rev:1,reason:"The quote must remain available for editing."}).reviewFlow.phase,"candidate");
});

test("initial clarification and detailed specification questions are distinct immutable batches with explicit asynchronous handoffs", () => {
  let c = journeyPDF();
  assert.throws(()=>act(c,"begin-detailed-questions"),/unavailable/);
  c = act(act(c,"draft-questions"),"send-questions");
  assert.equal(c.reviewFlow.sentBundle.id,"Q1");
  assert.equal(c.reviewFlow.sentBundle.round,"initial");
  assert.equal(c.owner,"Requester");
  c = act(c,"answer","Keep editing this quote");
  const firstRound = clone(c.reviewFlow.questionRounds[0]);
  assert.equal(c.owner,"Website team");
  c = act(c,"confirm-scope",{...c.reviewFlow.suggestedScope,understanding:"Keep this quote available for editing."});
  c = act(c,"begin-detailed-questions");
  assert.equal(c.reviewFlow.questionDraft[0].id,"workflow-placement");
  const preview = act(c,"preview-questions");
  assert.equal(preview.reviewFlow.questionPreview.round,"detailed");
  assert.equal(preview.reviewFlow.questionRounds.length,1,"A private preview creates no sent round.");
  assert.equal(act(preview,"close-questions").reviewFlow.phase,"spec-review");
  c = act(preview,"send-questions");
  assert.equal(c.reviewFlow.sentBundle.id,"Q2");
  assert.equal(c.reviewFlow.sentBundle.round,"detailed");
  assert.equal(c.owner,"Requester");
  assert.throws(()=>act(c,"finish-spec"),/unavailable/);
  assert.throws(()=>act(c,"answer",{"next-step":"Keep editing this quote"}),/private question/);
  c = act(c,"answer","At the page footer");
  assert.deepEqual(c.reviewFlow.questionRounds[0],firstRound);
  assert.equal(c.reviewFlow.questionRounds[1].answers["workflow-placement"],"At the page footer");
  assert.equal(c.reviewFlow.questionRounds[1].answered,true);
  assert.equal(c.answer,"Keep editing this quote","The detailed answer does not erase initial clarification needed by the original adaptive parser.");
  assert.equal(c.reviewFlow.answers["next-step"],"Keep editing this quote");
  assert.equal(c.reviewFlow.detailedAnswerText,"At the page footer");
  c = act(c,"confirm-scope",{...c.reviewFlow.suggestedScope,understanding:"Keep editing and place Workflow at the footer."});
  assert.throws(()=>act(c,"begin-detailed-questions"),/already been sent/);
  const noInitial = detailedJourney("Beside the PDF result",false);
  assert.equal(noInitial.reviewFlow.questionRounds[0].id,"Q1","The first sent batch is Q1; its detailed phase remains separate metadata.");
});

test("different detailed answers update exact placement and checks while the previously shared understanding stays unchanged until the team shares again", () => {
  const beside = detailedJourney("Beside the PDF result"), footer = detailedJourney("At the page footer");
  assert.notEqual(beside.reviewFlow.suggestedScope.approach,footer.reviewFlow.suggestedScope.approach);
  assert.notEqual(beside.reviewFlow.suggestedScope.checks,footer.reviewFlow.suggestedScope.checks);
  assert.match(beside.reviewFlow.suggestedScope.approach,/beside the saved PDF result/);
  assert.match(footer.reviewFlow.suggestedScope.approach,/at the page footer/);
  assert.doesNotMatch(footer.reviewFlow.sharedUnderstanding.text,/footer/);
  assert.match(footer.reviewFlow.suggestedScope.checks,/stays on Make PDF/);
  for (let c of [beside,footer]) {
    const expected = /at the page footer/.test(c.reviewFlow.suggestedScope.approach) ? "page-footer" : "beside-result";
    c = act(c,"confirm-scope",{...c.reviewFlow.suggestedScope,understanding:"Use the customer’s explicitly chosen placement."});
    c = act(act(c,"finish-spec"),"prepare-result");
    assert.equal(E.reviewPreview(c).interactive,true);
    assert.equal(E.reviewPreview(c).placement,expected);
  }
  const unsure = detailedJourney("I'm not sure");
  assert.equal(unsure.reviewFlow.suggestedScope.decisionRequired,true);
  let typed = act(sharedJourney(),"begin-detailed-questions");
  const qs = clone(typed.reviewFlow.questionDraft); qs[0].type = "text"; qs[0].options = [];
  typed = act(act(typed,"save-questions",qs),"send-questions");
  typed = act(typed,"answer","Automatically redirect to Workflow instead.");
  assert.match(typed.reviewFlow.suggestedScope.conflict,/conflicts/);
  assert.match(typed.reviewFlow.suggestedScope.approach,/Keep the original quote on Make PDF/);
});

test("a corrected scope cycle can send its own detailed batch without resending an earlier cycle or losing its answers", () => {
  let c = detailedJourney("Beside the PDF result");
  c = act(c,"confirm-scope",{...c.reviewFlow.suggestedScope,understanding:"Place Workflow beside the result."});
  const rounds = clone(c.reviewFlow.questionRounds);
  c = act(c,"correct-understanding",{text:"The location should be the footer instead."});
  c = act(c,"confirm-scope",{...c.reviewFlow.scope,understanding:"Keep the same quote and reconsider the optional action’s location."});
  c = act(c,"begin-detailed-questions");
  c = act(c,"send-questions");
  assert.equal(c.reviewFlow.sentBundle.id,"Q3");
  assert.equal(c.reviewFlow.sentBundle.scopeCycle,2);
  c = act(c,"answer","At the page footer");
  assert.deepEqual(c.reviewFlow.questionRounds.slice(0,2),rounds);
  assert.equal(c.reviewFlow.questionRounds[1].answers["workflow-placement"],"Beside the PDF result");
  assert.equal(c.reviewFlow.questionRounds[2].answers["workflow-placement"],"At the page footer");
  assert.deepEqual(c.reviewFlow.journey.detailedSentCycles,[1,2]);
});

test("delivered journey versions freeze understanding, corrections and all answer rounds and old approvals remain exact", () => {
  let c = detailedJourney("Beside the PDF result");
  c = act(c,"confirm-scope",{...c.reviewFlow.suggestedScope,understanding:"Keep Make PDF and put Workflow beside the saved result."});
  c = act(act(c,"finish-spec"),"prepare-result");
  const changedSource = clone(c); changedSource.reviewFlow.questionRounds[0].answers["next-step"] = "Changed after preparation";
  assert.throws(()=>act(changedSource,"deliver"),/current simulated result/);
  c = act(c,"deliver");
  const v1 = clone(c.versions[0]);
  assert.equal(v1.reviewFlow.sharedUnderstanding.text,"Keep Make PDF and put Workflow beside the saved result.");
  assert.equal(v1.reviewFlow.questionRounds.length,2);
  assert.equal(v1.reviewFlow.questionRounds[0].answers["next-step"],"Keep editing this quote");
  c = act(c,"adjust",{rev:1,reason:"Place the action at the footer instead."});
  c = act(c,"edit-candidate",{approach:v1.candidate.replace("beside the saved PDF result","at the page footer"),checks:v1.reviewFlow.candidateDraft.checks.replace("beside the result","at the page footer")});
  c = act(act(c,"prepare-result"),"deliver");
  assert.deepEqual(c.versions[0],v1);
  assert.equal(c.versions[1].reviewFlow.questionRounds.length,2);
  assert.match(c.versions[1].candidate,/page footer/);
  assert.throws(()=>act(c,"accept",{rev:1}),/exact current submitted/);
  c = act(c,"accept",{rev:2}); c = act(c,"authorize",{rev:2}); c = act(c,"publish",{rev:2});
  assert.equal(c.receipt.rev,2);
  assert.equal(c.receipt.verified,false);
  assert.deepEqual(c.versions[0],v1);
  assert.deepEqual(E.derive(JSON.parse(JSON.stringify(c))),E.derive(c));
});

test("opt-in walkthroughs include public understanding and optional detailed decisions while old routes remain unchanged", () => {
  const Story = require("./review-story.js");
  const zero = Story.build({kind:"pdf",journey:true});
  assert.ok(zero.some(frame=>frame.case.reviewFlow.phase === "spec-review"));
  assert.equal(zero.at(-1).case.stage,"published");
  assert.equal(zero.at(-1).case.reviewFlow.questionRounds.length,0);
  for (const detailedAnswer of ["Beside the PDF result","At the page footer"]) {
    const frames = Story.build({kind:"pdf",journey:true,ask:true,answer:"Keep editing this quote",detailed:true,detailedAnswer});
    const end = frames.at(-1).case;
    assert.equal(end.stage,"published");
    assert.equal(end.reviewFlow.questionRounds.length,2);
    assert.equal(end.reviewFlow.questionRounds[0].answerSimulated,false);
    assert.equal(end.reviewFlow.questionRounds[1].answerSimulated,false);
    assert.equal(end.answer,"Keep editing this quote");
    assert.equal(end.versions.length,2);
    assert.notEqual(end.versions[0].candidate,end.versions[1].candidate);
    assert.ok(frames.some(frame=>frame.case.reviewFlow.phase === "spec-review" && frame.case.reviewFlow.questionRounds.length === 2));
  }
  const unsure = Story.build({kind:"pdf",journey:true,detailed:true,detailedAnswer:"I'm not sure"});
  assert.equal(unsure.at(-1).case.reviewFlow.phase,"answer-review");
  assert.equal(unsure.at(-1).case.versions.length,0);
  const create = Story.build({kind:"create",journey:true});
  assert.equal(create.at(-1).case.stage,"published");
  assert.equal(create.at(-1).case.versions[0].view.proposal.branch,"paths");
  const legacy = Story.build({kind:"pdf"});
  assert.ok(legacy.every(frame=>frame.case.reviewFlow.journey === undefined));
  assert.ok(!legacy.some(frame=>frame.case.reviewFlow.phase === "spec-review"));
});
