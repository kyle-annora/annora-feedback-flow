"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const S = require("./scenario-catalog.js");
const E = require("./engine.js");
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const act = (c,action,value) => E.review(c,action,value);
const create = (id,raw = S.get(id).feedback) => E.createReviewedCase(raw,{scenarioId:id,journey:true});
const share = (c,selected=c.reviewFlow.scope) => act(c,"confirm-scope",{...selected,understanding:selected.approach});
const ready = c => act(act(share(c),"finish-spec"),"prepare-result");
const delivered = c => act(ready(c),"deliver");
const q = (id,type="text",options=[],extra={}) => ({id,text:"Business decision " + id + "?",type,options,required:true,disposition:"ask",reason:"A specific missing business decision.",...extra});
function send(c,questions) {
  c = act(c,"draft-questions");
  if (questions) c = act(c,"save-questions",questions);
  return act(c,"send-questions");
}
function detailed(answer) {
  let c = act(share(create("refrigeration")),"begin-detailed-questions");
  c = act(c,"send-questions");
  return act(c,"answer",{bundleId:c.reviewFlow.sentBundle.id,answers:{"equipment-return":answer}});
}

test("the catalog is the three source-grounded cases, with isolated public copies and no fourth synthetic ticket", () => {
  const all = S.list();
  assert.deepEqual(all.map(item=>item.id),["pdf","compartment","refrigeration"]);
  assert.deepEqual(all.map(item=>item.ticketId),["fb_2026-07-11_002","fb_2026-07-11_001","fb_2026-09-23_001"]);
  for (const item of all) {
    for (const key of ["title","ticketId","feedback","target","summary","sourceNote"]) assert.equal(typeof item[key],"string");
    assert.ok(item.scope.approach && item.scope.checks && Array.isArray(item.questions) && Array.isArray(item.detailedQuestions));
  }
  assert.match(all[2].sourceNote,/not an original customer quotation/);
  assert.match(all[2].sourceNote,/not.*recorded customer approval/);
  assert.equal(all[0].history[0].status,"superseded");
  all[1].scope.approach = "Mutated outside";
  all[1].variants[0].configuration.compartments[0].title = "Mutated outside";
  assert.notEqual(S.get("compartment").scope.approach,"Mutated outside");
  assert.notEqual(S.variant("compartment","default").configuration.compartments[0].title,"Mutated outside");
  assert.equal(S.get("not-a-case"),null);
  for (const id of ["constructor","toString","__proto__"]) {
    assert.equal(S.get(id),null);
    assert.equal(S.variant(id,"default"),null);
    assert.equal(S.suggest(id,{}),null);
    assert.equal(S.matchesFeedback(id,"anything"),false);
    assert.equal(S.preview(id,{}).interactive,false);
  }
  assert.doesNotMatch(all[2].detailedQuestions[0].reason,/D2|historical|specification/i,"Customer-facing question rationale stays concise; source nuance belongs to the records.");
});

test("new scenarios use the original engine, allow zero-question complete V1 and preserve the existing PDF question route", () => {
  for (const item of S.list()) {
    const original = create(item.id), before = JSON.stringify(original), sent = delivered(freeze(original));
    assert.equal(JSON.stringify(original),before);
    assert.equal(sent.reviewFlow.scenarioId,item.id);
    assert.equal(sent.reviewFlow.source.id,item.ticketId);
    assert.equal(sent.versions.length,1);
    assert.equal(sent.reviewFlow.questionRounds.length,0);
    assert.equal(sent.reviewFlow.sentBundle,null);
    assert.equal(sent.versions[0].candidate,item.scope.approach);
    assert.equal(E.reviewPreview(sent).interactive,true);
    assert.equal(E.reviewPreview(E.derive(sent)).interactive,true);
    let accepted = act(sent,"accept",{rev:1});
    assert.equal(accepted.stage,"release");
    assert.equal(accepted.authorization,null);
    assert.throws(()=>act(accepted,"publish",{rev:1}),/accepted and authorized/);
    const completed = act(act(accepted,"authorize",{rev:1}),"publish",{rev:1});
    assert.equal(completed.receipt.rev,1);
    assert.equal(completed.receipt.candidate,item.scope.approach);
    assert.equal(completed.receipt.target,item.target);
    assert.equal(completed.receipt.implemented,false);
  }
  const legacy = E.createReviewedCase(E.pdfFeedback,{journey:true});
  assert.equal(legacy.reviewFlow.scenarioId,undefined);
  assert.equal(legacy.reviewFlow.questionDraft[0].disposition,"ask");
  assert.equal(legacy.reviewFlow.questionDraft[0].id,"next-step");
  assert.equal(create("pdf").reviewFlow.questionDraft.some(q=>q.disposition === "ask"),false);
  assert.throws(()=>E.createReviewedCase("Text",{scenarioId:"invented"}),/supported scenario/);
});

test("arbitrary, mixed and media-only input cannot inherit a selected historical outcome", () => {
  for (const id of ["pdf","compartment","refrigeration"]) {
    for (const raw of ["", "See the attached recording.", S.get(id).feedback + " Also automatically email every customer and change pricing rules.","Do the opposite of the example."]) {
      const c = create(id,raw);
      assert.equal(c.text,raw);
      assert.equal(c.reviewFlow.needsMaterialReview,true);
      assert.equal(c.reviewFlow.source.historical,false);
      assert.equal(c.reviewFlow.source.id,null);
      assert.equal(c.reviewFlow.source.referenceTicketId,S.get(id).ticketId);
      assert.deepEqual(c.reviewFlow.scope,{approach:"",checks:""});
      assert.equal(E.derive(c).blocked,true);
      assert.throws(()=>share(c),/must contain text/);
      assert.throws(()=>act(c,"prepare-result"),/unavailable/);
    }
  }
  let manual = create("pdf","Add an invoice export to the discount page.");
  manual = share(manual,{approach:"A team-authored invoice proposal, with no interactive implementation.",checks:"The team verifies this invoice requirement separately."});
  assert.equal(manual.reviewFlow.materialReviewed,true);
  assert.equal(manual.reviewFlow.needsMaterialReview,false);
  manual = act(manual,"finish-spec");
  assert.throws(()=>act(manual,"prepare-result"),/team needs an updated authored result/);
  assert.equal(manual.reviewFlow.result,null);
  assert.equal(manual.reviewFlow.phase,"candidate");
  assert.equal(E.derive(manual).candidate,"A team-authored invoice proposal, with no interactive implementation.");
});

test("typed questions freeze stable option labels, preserve uncertainty and accept real multi-select arrays", () => {
  const questions = [
    q("choice","single",["A","Other"],{optionIds:["choice-a","choice-other"]}),
    q("yesno","yes_no",["Yes","No","Not sure"],{optionIds:["yes","no","unsure"]}),
    q("outputs","multi",["Equipment","Charges","Totals","Not sure"],{optionIds:["equipment","charges","totals","unsure"],minSelections:1,maxSelections:2,exclusiveOptionIds:["unsure"]}),
    q("note","text",["Suggested answer"]),
    q("internal","text",[],{disposition:"team"}),q("removed","text",[],{disposition:"omit"}),
  ];
  const initial = act(create("pdf"),"draft-questions");
  const saved = act(initial,"save-questions",questions), preview = act(saved,"preview-questions");
  assert.equal(preview.reviewFlow.sentBundle,null);
  assert.deepEqual(preview.reviewFlow.questionPreview.questions.map(item=>item.id),["choice","yesno","outputs","note"]);
  const c = act(preview,"send-questions"), bundle = clone(c.reviewFlow.sentBundle);
  assert.deepEqual(bundle.questions[1].optionSnapshots,[{id:"yes",label:"Yes"},{id:"no",label:"No"},{id:"unsure",label:"Not sure"}]);
  const answered = act(freeze(c),"answer",{bundleId:bundle.id,answers:{choice:{optionId:"choice-other",otherText:"A different approach"},yesno:"unsure",outputs:["equipment","totals"],note:"My own words"}});
  assert.deepEqual(answered.reviewFlow.answers,{choice:"Other",yesno:"Not sure",outputs:["Equipment","Totals"],note:"My own words"});
  assert.deepEqual(answered.reviewFlow.answerOptionIds.outputs,["equipment","totals"]);
  assert.equal(answered.reviewFlow.answerNotes.choice,"A different approach");
  assert.equal(answered.reviewFlow.answers.yesno,"Not sure","Unknown must never become boolean false or an implied No.");
  assert.equal(answered.reviewFlow.phase,"answer-review");
  assert.equal(answered.reviewFlow.candidateDraft,null);
  assert.deepEqual(c.reviewFlow.sentBundle,bundle);
  questions[1].options[2] = "Changed outside";
  assert.deepEqual(answered.reviewFlow.questionRounds[0].questions,bundle.questions);
  const valid = {choice:"choice-a",yesno:"no",outputs:["charges"],note:"Actual answer"};
  assert.equal(act(c,"answer",{answers:valid}).reviewFlow.answers.yesno,"No");
  assert.throws(()=>act(c,"answer",{bundleId:"Q0",answers:valid}),/current sent question bundle/);
  assert.throws(()=>act(c,"answer",{answers:{...valid,yesno:false}}),/must contain text/);
  assert.throws(()=>act(c,"answer",{answers:{...valid,outputs:"Equipment"}}),/must be an array/);
  assert.throws(()=>act(c,"answer",{answers:{...valid,outputs:["equipment","equipment"]}}),/distinct options/);
  assert.throws(()=>act(c,"answer",{answers:{...valid,outputs:["equipment","charges","totals"]}}),/between 1 and 2/);
  assert.throws(()=>act(c,"answer",{answers:{...valid,outputs:["equipment","unsure"]}}),/exclusive/);
  assert.throws(()=>act(c,"answer",{answers:{...valid,choice:"choice-other"}}),/actual answer/);
  assert.throws(()=>act(c,"answer",{answers:{...valid,internal:"A private diagnosis"}}),/private question/);
  assert.throws(()=>act(initial,"save-questions",[q("bad","yes_no",["A","B"])]),/explicit Yes and No/);
});

test("the ten-question demo limit applies across both sent rounds without discarding the private draft", () => {
  const initialQuestions = Array.from({length:8},(_,index)=>q("initial-" + index));
  let c = send(create("refrigeration"),initialQuestions);
  c = act(c,"answer",Object.fromEntries(initialQuestions.map(item=>[item.id,"Actual business answer"])));
  c = share(c,S.get("refrigeration").scope);
  const first = clone(c.reviewFlow.questionRounds[0]);
  c = act(c,"begin-detailed-questions");
  const tooMany = Array.from({length:3},(_,index)=>q("detail-" + index));
  c = act(c,"save-questions",tooMany);
  const before = JSON.stringify(c);
  assert.throws(()=>act(c,"preview-questions"),/at most 10/);
  assert.throws(()=>act(c,"send-questions"),/at most 10/);
  assert.equal(JSON.stringify(c),before);
  assert.equal(c.reviewFlow.questionDraft.length,3,"The excess draft is preserved for team editing.");
  c = act(act(c,"save-questions",tooMany.slice(0,2)),"send-questions");
  assert.equal(c.reviewFlow.sentBundle.id,"Q2");
  assert.equal(c.reviewFlow.sentBundle.round,"detailed");
  assert.deepEqual(c.reviewFlow.questionRounds[0],first);
  assert.equal(c.reviewFlow.questionRounds.reduce((n,round)=>n+round.questions.length,0),10);
});

test("C answers produce distinct proposed behavior, checks and executable configurations only after explicit team confirmation", () => {
  const reselect = detailed("reselect"), restore = detailed("restore");
  assert.notEqual(reselect.reviewFlow.suggestedScope.approach,restore.reviewFlow.suggestedScope.approach);
  assert.notEqual(reselect.reviewFlow.suggestedScope.checks,restore.reviewFlow.suggestedScope.checks);
  assert.equal(reselect.reviewFlow.candidateDraft,null);
  assert.equal(restore.reviewFlow.candidateDraft,null);
  assert.match(restore.reviewFlow.suggestedScope.conflict,/differs from.*recorded/);
  assert.equal(reselect.reviewFlow.sentBundle.id,"Q2","Detailed identity remains distinct when initial questions were unnecessary.");
  assert.equal(reselect.answer,"","A detailed answer does not overwrite or invent initial clarification.");
  assert.throws(()=>act(restore,"finish-spec"),/unavailable/);
  for (const [policy,answerReview] of [["reselect",reselect],["restore",restore]]) {
    let c = share(answerReview,answerReview.reviewFlow.suggestedScope);
    if (policy === "restore") assert.equal(c.reviewFlow.scopeDecision.resolvedBy,"Website team");
    c = act(act(c,"finish-spec"),"prepare-result");
    const view = E.reviewPreview(c);
    assert.equal(view.type,"refrigeration");
    assert.equal(view.configuration.policy,policy);
    assert.equal(view.configuration.saveRequired,true);
    assert.equal(view.configuration.idempotent,true);
    assert.equal(view.configuration.compartments.length,2);
    assert.ok(E.derive(c).checks.every(check=>check.sourceLabel === "Detailed specification answer"));
    c = act(c,"deliver");
    assert.equal(c.versions[0].reviewFlow.questionRounds[0].answers["equipment-return"],policy === "reselect" ? "Select equipment again" : "Restore the previous equipment selection");
    assert.equal(E.reviewPreview(c).configuration.policy,policy);
  }
  const unsure = detailed("unsure");
  assert.equal(unsure.reviewFlow.answers["equipment-return"],"I'm not sure");
  assert.equal(unsure.reviewFlow.suggestedScope.decisionRequired,true);
  const extra = S.suggest("refrigeration",{"equipment-return":"reselect","another-requirement":"Send an email"},{round:"detailed"});
  assert.equal(extra.decisionRequired,true,"An authored choice must not erase extra unsupported requirements.");
  let corrected = share(reselect,reselect.reviewFlow.suggestedScope);
  corrected = act(corrected,"correct-understanding",{text:"Please review this choice again before preparing the result."});
  corrected = share(corrected,corrected.reviewFlow.scope);
  assert.deepEqual(corrected.reviewFlow.sharedUnderstanding.sourceAnswers,{initial:"",detailed:""},"Older answers remain historical context, not freshly supplied answers in the corrected scope cycle.");
  assert.equal(corrected.reviewFlow.questionRounds[0].answers["equipment-return"],"Select equipment again");
});

test("B complete V1 is not deliberately broken; genuine edited V2 updates preview and freezes earlier scope", () => {
  let c = delivered(create("compartment"));
  const v1 = clone(c.versions[0]), baseline = E.reviewPreview(c);
  assert.equal(baseline.configuration.grouped,true);
  assert.equal(baseline.configuration.editableTitles,true);
  assert.equal(baseline.configuration.compartments[0].sections.length,7);
  c = act(c,"adjust",{rev:1,reason:"Please repeat the compartment number on each section header as well."});
  assert.throws(()=>act(c,"prepare-result"),/Revise the actual candidate/);
  c = act(c,"edit-candidate",S.variant("compartment","section-labels").scope);
  assert.equal(E.reviewPreview(c).interactive,false);
  c = act(act(c,"prepare-result"),"deliver");
  assert.equal(c.rev,2);
  assert.equal(E.reviewPreview(c).configuration.repeatLabels,true);
  assert.deepEqual(c.versions[0],v1);
  assert.notEqual(c.versions[1].candidate,v1.candidate);
  assert.equal(c.accepted,null);
  assert.throws(()=>act(c,"accept",{rev:1}),/exact current/);
});

test("new scenarios preserve unsupported edited proposals as team work instead of preparing or delivering a mismatched fixture", () => {
  for (const item of S.list()) {
    let c = ready(create(item.id));
    c = act(c,"edit-candidate",{approach:c.reviewFlow.candidateDraft.approach + "\nAutomatically email this result to every customer."});
    assert.equal(E.reviewPreview(c).interactive,false);
    const draft = JSON.stringify(c);
    assert.throws(()=>act(freeze(c),"prepare-result"),/team needs an updated authored result/);
    assert.throws(()=>act(c,"deliver"),/unavailable/);
    assert.equal(JSON.stringify(c),draft);
    assert.equal(c.reviewFlow.phase,"candidate");
    assert.equal(c.reviewFlow.result,null);
    assert.equal(c.versions.length,0);
    let checks = ready(create(item.id));
    checks = act(checks,"edit-candidate",{checks:checks.reviewFlow.candidateDraft.checks + "\nReal production quote charges were verified."});
    assert.throws(()=>act(checks,"prepare-result"),/team needs an updated authored result/);
    assert.equal(checks.reviewFlow.teamCheck,null);
  }
  const custom = S.variant("compartment","loading-bay-title");
  const model = S.preview("compartment",custom.scope);
  assert.equal(model.configuration.compartments[1].title,"Loading bay freezer");
});

test("adjustment images and voice manifests remain separate from initial evidence and freeze with the exact revised version",()=>{
  let c=create("compartment");
  c.reviewFlow.attachments=[{id:"original-image",kind:"image",blobKey:"original-image",name:"Initial screenshot"}];
  c=delivered(c);
  const v1=clone(c.versions[0]),initial=clone(c.reviewFlow.attachments);
  const change={rev:1,reason:"Repeat the compartment number on each section header.",captureId:"revision-capture-1",context:{page:"Edit quote result",compartmentId:"compartment-2"},attachments:[
    {id:"revision-image",kind:"image",blobKey:"revision-image",name:"Section detail"},
    {id:"revision-audio",kind:"audio",blobKey:"revision-audio",transcript:"Please repeat the number on every section.",transcriptRevision:1,transcriptSource:"requester"},
  ]};
  c=act(freeze(c),"adjust",change);
  assert.deepEqual(c.reviewFlow.attachments,initial);
  assert.equal(c.reviewFlow.adjustmentEvidence.rev,1);
  assert.equal(c.reviewFlow.adjustmentEvidence.actor,"Reviewer");
  assert.deepEqual(c.adjustments.at(-1).evidence,c.reviewFlow.adjustmentEvidence);
  change.attachments[1].transcript="Mutated caller input";
  change.context.compartmentId="different";
  assert.equal(c.reviewFlow.adjustmentEvidence.attachments[1].transcript,"Please repeat the number on every section.");
  assert.equal(c.adjustments.at(-1).evidence.context.compartmentId,"compartment-2");
  c=act(c,"edit-candidate",S.variant("compartment","section-labels").scope);
  c=act(c,"prepare-result");
  const tampered=clone(c);tampered.reviewFlow.adjustmentEvidence.attachments[1].transcript="Changed after checking";
  assert.throws(()=>act(tampered,"deliver"),/current simulated result/);
  c=act(c,"deliver");
  const v2=clone(c.versions[1]);
  assert.equal(v2.reviewFlow.adjustmentEvidence.attachments[1].transcriptRevision,1);
  assert.deepEqual(c.versions[0],v1);
  c=act(c,"adjust",{rev:2,reason:"Use a specific name for the second card."});
  assert.equal(c.reviewFlow.adjustmentEvidence,null,"A new note without attachments does not silently reuse the last revision's attachments.");
  assert.equal(c.adjustments[0].evidence.attachments.length,2);
  assert.deepEqual(c.versions[1],v2);
});

test("site-owner revision evidence is cloned and cannot carry old approval or replace the initial attachments",()=>{
  let c=delivered(create("compartment"));c=act(c,"accept",{rev:1});
  const original=clone(c),value={rev:1,reason:"Use the loading bay title.",attachments:[{attachmentId:"owner-image",kind:"image",blobKey:"owner-image"}],context:{page:"Release approval"},captureId:"owner-note"};
  const adjusted=act(freeze(c),"request-release-changes",value);
  assert.equal(adjusted.reviewFlow.adjustmentEvidence.actor,"Site owner");
  assert.equal(adjusted.adjustments.at(-1).evidence.captureId,"owner-note");
  assert.equal(adjusted.accepted,null);assert.equal(adjusted.authorization,null);
  assert.deepEqual(adjusted.reviewFlow.attachments,original.reviewFlow.attachments);
  value.attachments[0].blobKey="Changed outside";
  assert.equal(adjusted.reviewFlow.adjustmentEvidence.attachments[0].blobKey,"owner-image");
  assert.throws(()=>act(original,"request-release-changes",{rev:1,reason:"A note",attachments:[{id:"bad",kind:"image",blob:{}}]}),/binary originals/);
  assert.throws(()=>act(original,"request-release-changes",{rev:1,reason:"A note",attachments:[{id:"same",kind:"image"},{id:"same",kind:"audio"}]}),/unique local id/);
  assert.throws(()=>act(original,"request-release-changes",{rev:0,reason:"A note",attachments:[]}),/exact current/);
});

test("context, attachment originals and editable transcript changes invalidate a prepared result and freeze per submitted version", () => {
  let c = create("compartment");
  c.reviewFlow.context = {page:"Edit quote",quoteId:"DEMO-100",compartmentId:"compartment-1"};
  c.reviewFlow.attachments = [{attachmentId:"audio-1",kind:"audio",blobKey:"blob-1",transcript:"The titles are unclear.",transcriptRevision:1}];
  c = ready(c);
  for (const change of [
    x=>{x.reviewFlow.context.compartmentId = "compartment-2";},
    x=>{x.reviewFlow.attachments[0].transcript = "A different request.";x.reviewFlow.attachments[0].transcriptRevision = 2;},
    x=>{x.reviewFlow.attachments.push({attachmentId:"image-1",blobKey:"blob-2"});},
  ]) {
    const edited = clone(c); change(edited);
    assert.equal(E.reviewPreview(edited).interactive,false);
    assert.throws(()=>act(edited,"deliver"),/current simulated result/);
  }
  c = act(c,"deliver");
  const v1 = clone(c.versions[0]);
  c = act(c,"adjust",{rev:1,reason:"Use the loading bay title for the second card."});
  c.reviewFlow.attachments[0].transcript = "Use the loading bay title.";
  c.reviewFlow.attachments[0].transcriptRevision = 2;
  c = act(c,"edit-candidate",S.variant("compartment","loading-bay-title").scope);
  c = act(act(c,"prepare-result"),"deliver");
  assert.deepEqual(c.versions[0],v1);
  assert.equal(c.versions[0].reviewFlow.attachments[0].transcriptRevision,1);
  assert.equal(c.versions[1].reviewFlow.attachments[0].transcriptRevision,2);
  assert.deepEqual(E.derive(JSON.parse(JSON.stringify(c))),E.derive(c));
});

test("the site owner can request actual changes without carrying old acceptance or authorization into the new version", () => {
  const accepted = act(delivered(create("compartment")),"accept",{rev:1});
  for (const start of [accepted,act(accepted,"authorize",{rev:1})]) {
    assert.throws(()=>act(start,"request-release-changes",{rev:0,reason:"Change it"}),/exact current/);
    assert.throws(()=>act(start,"request-release-changes",{rev:1,reason:" "}),/must contain text/);
    let c = act(freeze(start),"request-release-changes",{rev:1,reason:"Name the second card Loading bay freezer."});
    assert.equal(c.rev,2);
    assert.equal(c.stage,"processing");
    assert.equal(c.owner,"Website team");
    assert.equal(c.trail.at(-1).actor,"Site owner");
    assert.equal(c.accepted,null);assert.equal(c.authorization,null);assert.equal(c.receipt,null);
    assert.throws(()=>act(c,"authorize",{rev:2}),/exact accepted/);
    assert.throws(()=>act(c,"prepare-result"),/Revise the actual candidate/);
    c = act(c,"edit-candidate",S.variant("compartment","loading-bay-title").scope);
    c = act(act(c,"prepare-result"),"deliver");
    assert.throws(()=>act(c,"authorize",{rev:2}),/exact accepted/);
    c = act(c,"accept",{rev:2}); c = act(c,"authorize",{rev:2}); c = act(c,"publish",{rev:2});
    assert.equal(c.receipt.rev,2);
    assert.equal(c.versions[0].candidate,start.versions[0].candidate);
  }
});

test("simulated release failure keeps exact approvals, has no success receipt and requires an explicit retry", () => {
  const accepted = act(delivered(create("refrigeration")),"accept",{rev:1});
  assert.throws(()=>act(accepted,"publish-failed",{rev:1,reason:"Demo failure"}),/accepted and authorized/);
  const authorized = act(accepted,"authorize",{rev:1}), before = JSON.stringify(authorized);
  assert.throws(()=>act(authorized,"publish-failed",{rev:2,reason:"Demo failure"}),/exact current/);
  let failed = act(freeze(authorized),"publish-failed",{rev:1,reason:"Simulated target unavailable."});
  assert.equal(JSON.stringify(authorized),before);
  assert.equal(failed.reviewFlow.phase,"release-failed");
  assert.equal(failed.owner,"Website team");
  assert.equal(failed.receipt,null);
  assert.deepEqual(failed.accepted,authorized.accepted);
  assert.deepEqual(failed.authorization,authorized.authorization);
  assert.throws(()=>act(failed,"publish",{rev:1}),/explicit retry/);
  assert.throws(()=>act(failed,"retry-publish",{rev:2}),/exact current/);
  failed = JSON.parse(JSON.stringify(failed));
  const retry = act(failed,"retry-publish",{rev:1}), completed = act(retry,"publish",{rev:1});
  assert.equal(completed.receipt.rev,1);
  assert.equal(completed.receipt.target,authorized.authorization.target);
  assert.equal(completed.receipt.candidate,authorized.versions[0].candidate);
  assert.equal(completed.reviewFlow.releaseAttempt.status,"succeeded");
  assert.equal(completed.reviewFlow.releaseAttempts[0].status,"failed");
  assert.throws(()=>act(completed,"retry-publish",{rev:1}),/failed release/);
  const tampered = clone(authorized);tampered.authorization.target = "Another target";
  assert.throws(()=>act(tampered,"publish",{rev:1}),/release target/);
});

test("the catalog and three new reviewed cases work as browser globals without a second state engine", () => {
  const sandbox = {console};vm.createContext(sandbox);
  for (const file of ["model.js","custom-story.js","hesitation.js","scenario-catalog.js","team-review.js","engine.js"]) vm.runInContext(fs.readFileSync(require.resolve("./" + file),"utf8"),sandbox,{filename:file});
  assert.equal(sandbox.FlowScenarios.list().length,3);
  const c = sandbox.CaseEngine.createReviewedCase(sandbox.FlowScenarios.get("compartment").feedback,{scenarioId:"compartment",journey:true});
  assert.equal(c.reviewFlow.scenarioId,"compartment");
  assert.equal(c.versions.length,0);
  assert.equal(c.owner,"Website team");
});
