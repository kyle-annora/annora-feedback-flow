(function (root) {
  "use strict";
  const E = typeof module === "object" && module.exports ? require("./engine.js") : root.CaseEngine;
  const clone = value => JSON.parse(JSON.stringify(value));
  function build(options = {}) {
    const kind = options.kind || "pdf";
    if (!["pdf","create","own"].includes(kind)) throw new Error("Choose a PDF, Create or personal feedback walkthrough.");
    const raw = options.text ?? (kind === "pdf" ? E.pdfFeedback : kind === "create" ? E.hesitationFeedback : "");
    if (typeof raw !== "string" || !raw.trim()) throw new Error("Enter feedback before starting this walkthrough.");
    let c = E.createReviewedCase(raw,kind === "pdf" ? {sourceId:"fb_2026-07-11_002",kind:"behavior",target:"WinQuote · Make PDF",journey:options.journey === true} : {target:options.target,journey:options.journey === true});
    if(options.context)c.reviewFlow.context=clone(options.context);
    const frames = [];
    function add(title,why) { frames.push({case:clone(c),title,why,role:c.owner}); }
    function run(action,value,title,why,sample = true) {
      c = E.review(c,action,value);
      if (sample) {
        c.trail[c.trail.length - 1].simulated = true;
        if (action === "answer") {
          if (!c.reviewFlow.journey?.enabled || c.reviewFlow.sentBundle.round === "initial") c.answerSimulated = true;
          if (c.reviewFlow.journey?.enabled) c.reviewFlow.questionRounds = c.reviewFlow.questionRounds.map(round=>
            round.id === c.reviewFlow.sentBundle.id ? {...round,answerSimulated:true} : round);
        }
        if (action === "accept") c.accepted.simulated = true;
        if (action === "authorize") c.authorization.simulated = true;
      }
      add(title,why);
    }
    add("Review the feedback before asking the customer","The website team checks the original request and existing decisions. Enough evidence can mean zero questions.");
    const legacy = E.transition(E.createCase(raw),"submit"), legacyView = E.derive(legacy);
    if (kind === "own" && (legacyView.blocked || legacyView.manual) && !legacyView.question) {
      frames[0].title = "The website team investigates the scope";
      frames[0].why = legacyView.reason || "This feedback needs a team decision. The walkthrough cannot invent an implementation or acceptance criteria.";
      return frames;
    }
    const ask = options.ask ?? (kind !== "pdf" && c.reviewFlow.questionDraft.some(question=>question.disposition === "ask"));
    if (ask) {
      run("draft-questions",undefined,"Draft questions privately","Questions are still team work. The customer has no new task until the reviewed bundle is sent.");
      const questions = clone(c.reviewFlow.questionDraft);
      const first = questions.find(q=>q.disposition === "ask");
      if (!first) {
        frames.at(-1).why = "The team has no supported customer question for this feedback. A person must write and screen it before sending.";
        return frames;
      }
      const answer = options.answer ?? (kind === "create" ? E.hesitationAnswers[1] : kind === "pdf" ? first.options[0] : first.options[0]);
      if (options.answer !== undefined && first.type === "single" && !first.options.includes(options.answer)) {
        first.type = "text"; first.options = [];
      }
      run("save-questions",questions,"Screen what the customer will receive","Only business context is asked. Questions resolved from records and technical investigation stay with the team.");
      run("preview-questions",undefined,"Preview the customer’s questions","This preview is unsent. The team can still edit the wording or return to a zero-question scope.");
      run("send-questions",undefined,"Send the reviewed question bundle","The sent questions are frozen. The requester now owns the next step; private drafts were not sent.");
      if (typeof answer !== "string" || !answer.trim()) {
        frames.at(-1).why = "A real answer is needed here. The walkthrough does not invent wording or a business requirement.";
        return frames;
      }
      run("answer",answer,"Review the answer and update the proposed scope","The actual answer changes the proposed approach and checks. It does not approve the team’s scope.",options.answer === undefined);
      if (!c.reviewFlow.suggestedScope.approach.trim() || c.reviewFlow.suggestedScope.conflict) {
        frames.at(-1).why = c.reviewFlow.suggestedScope.conflict || "The team must investigate this answer and author a specific proposal before the walkthrough can continue.";
        return frames;
      }
    }
    let selected = c.reviewFlow.suggestedScope || c.reviewFlow.scope;
    if (!selected.approach.trim() || !selected.checks.trim()) {
      frames.at(-1).why = "The website team must write a specific approach and acceptance checks. This walkthrough has no supported automatic proposal.";
      return frames;
    }
    const understanding = kind === "pdf" ? "Open the saved PDF without losing the current quote, and let the customer choose when to move to Workflow."
      : /Nothing is sent|does not send/i.test(selected.approach) ? "Opening the configurator should not send a quote to the customer."
      : /template/i.test(selected.approach) ? "Standard quotes use a template; custom layouts start from scratch." : selected.approach;
    run("confirm-scope",{...selected,understanding},options.journey ? "Share the team’s understanding" : "The team confirms the scope",
      options.journey ? "The customer can read or correct the team-authored understanding before a candidate exists. Internal drafts remain private." : "The team explicitly chooses the approach and checks after reviewing the source and any actual answer.");
    if (options.journey === true) {
      if (options.detailed === true) {
        run("begin-detailed-questions",undefined,"Resolve the remaining specification decisions","This is a distinct detailed batch after the shared understanding, not the initial clarification question again.");
        const questions = clone(c.reviewFlow.questionDraft), first = questions.find(q=>q.disposition === "ask");
        if (!first) {
          frames.at(-1).why = "The team must author a specific unresolved business question before sending a detailed batch. No generic successful answer is invented.";
          return frames;
        }
        const answer = options.detailedAnswer ?? first.options[0];
        if (options.detailedAnswer !== undefined && first.type === "single" && !first.options.includes(options.detailedAnswer)) { first.type = "text"; first.options = []; }
        run("save-questions",questions,"Review the detailed question batch","Only unresolved business decisions belong in this customer batch. Technical checks remain with the team.");
        run("preview-questions",undefined,"Preview the detailed questions","The draft is private until the team explicitly sends it.");
        run("send-questions",undefined,"Send the detailed question batch","The batch has its own identity and history. The earlier answer is preserved while the customer owns this new reply.");
        if (typeof answer !== "string" || !answer.trim()) return frames;
        run("answer",answer,"Use the detailed answer to refine the specification","The detailed answer changes a proposed decision. It does not silently replace the shared understanding or erase the initial clarification.",options.detailedAnswer === undefined);
        if (c.reviewFlow.suggestedScope.conflict || c.reviewFlow.suggestedScope.decisionRequired) {
          frames.at(-1).why = c.reviewFlow.suggestedScope.conflict || c.reviewFlow.suggestedScope.reason;
          return frames;
        }
        selected = c.reviewFlow.suggestedScope;
        const detailUnderstanding = /at the page footer/i.test(selected.approach)
          ? "Keep the quote on Make PDF and place the optional Go to Workflow action at the page footer."
          : "Keep the quote on Make PDF and place the optional Go to Workflow action beside the saved PDF result.";
        run("confirm-scope",{...selected,understanding:detailUnderstanding},"Share the refined understanding","The website team explicitly confirms the detailed decision and shares the revised understanding with the customer.");
      }
      run("finish-spec",undefined,"Finish the specification","The team proceeds from the explicitly shared understanding. Detailed questions are optional, and no customer acknowledgement is fabricated.");
      selected = c.reviewFlow.candidateDraft;
    }
    run("edit-candidate",selected,"Prepare the actual V1 candidate","The candidate is editable team work. Saving this draft does not send it or establish that a feature works.");
    if (E.derive(c).blocked) {
      frames.at(-1).why = E.derive(c).reason || "Resolve the failed candidate checks before preparing a result.";
      return frames;
    }
    run("begin-check",undefined,"Prepare a result preview","This step represents build and checking work with a labelled simulation. No real implementation is executed.");
    run("prepare-result",undefined,"Review the simulated result and team checks","The result is bound to this candidate and its checks. It is not proof that the live PDF feature works.");
    run("deliver",undefined,"Review the submitted V1","The submitted copy, source, questions, answers and simulated result are frozen together for the requester’s decision.");
    if (options.adjust !== false) {
      const detailPlacement = options.journey === true && options.detailed === true;
      const footerNext = detailPlacement && !/at the page footer/i.test(c.reviewFlow.candidateDraft.approach);
      const note = kind === "pdf" ? detailPlacement ? footerNext
        ? "Move the explicit Go to Workflow action to the page footer while keeping navigation optional."
        : "Move the explicit Go to Workflow action beside the saved PDF result."
        : "Make the explicit Go to Workflow action clear after the PDF opens." : E.suggestChange(c);
      if (note) {
        run("adjust",{rev:c.rev,reason:note},"The requester asks for an adjustment","The team owns the next revision. V1 remains unchanged, and the previous simulated result cannot be reused.");
        const approach = kind === "pdf"
          ? "Open the saved customer’s PDF in a new browser tab.\nKeep the same quote on Make PDF.\nShow a separate Go to Workflow action " + (footerNext ? "at the page footer." : "beside the saved PDF result.")
          : E.revisionDraft(c);
        if (!approach) {
          frames.at(-1).why = "The team must investigate this requested change. The walkthrough cannot fabricate a completed revision.";
          return frames;
        }
        const checks = kind === "pdf"
          ? "The saved customer’s PDF opens in a new tab.\nThe original tab stays on Make PDF with the same quote.\nGo to Workflow is visible " + (footerNext ? "at the page footer" : "beside the result") + " and navigates only when selected."
          : c.reviewFlow.candidateDraft.checks + "\n" + (E.derive(c).proposal?.branch === "paths"
            ? "The standard template and custom scratch explanations clearly identify when each option fits."
            : "The explanation explicitly states that opening the configurator does not send a quote to the customer.");
        run("edit-candidate",{approach,checks},"The team edits the real V2 draft","This is a changed candidate, not V1 with a new version label. The requested adjustment and original answer remain attached.");
        if (E.derive(c).blocked) {
          frames.at(-1).why = E.derive(c).reason || "The team still needs to resolve the failed checks.";
          return frames;
        }
        run("begin-check",undefined,"Prepare the revised result preview","Changing the draft invalidated the old preview and team check summary.");
        run("prepare-result",undefined,"Check the revised simulation","This new simulated result and check summary belong only to the edited V2.");
        run("deliver",undefined,"Review the submitted V2","Review the actual changed proposal against the original concern and requested adjustment. Earlier versions stay frozen.");
      }
    }
    run("accept",{rev:c.rev},"Accept V" + c.rev,"Acceptance finishes the requester’s review. The site owner still owns the separate release decision.");
    run("authorize",{rev:c.rev},"Authorize the accepted version","The site owner authorizes the exact accepted version and its frozen target. Opening this view is not authorization.");
    run("publish",{rev:c.rev},"Read the simulated release receipt","The receipt identifies the exact version, candidate and checks. No live implementation or publication took place.");
    return frames;
  }
  const api = {build};
  root.ReviewStory = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis);
