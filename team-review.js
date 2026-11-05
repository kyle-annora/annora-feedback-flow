(function (root) {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const fail = message => { throw new Error("Team review: " + message); };
  const lines = value => String(value || "").split("\n").map(s=>s.trim()).filter(Boolean);
  const pdfFeedback = "Generate PDF should automatically open the PDF once generated.";
  const pdfScope = {
    approach:"Open the saved customer’s PDF in a new browser tab.\nKeep the original quote on Make PDF.\nOffer an explicit Go to Workflow action when the user is ready to move on.",
    checks:"The saved customer’s PDF opens in a new tab.\nThe original tab remains on Make PDF with the same quote.\nGo to Workflow moves to Workflow only when explicitly selected.",
  };
  const pdfQuestions = [
    {id:"next-step",text:"Once the PDF is open, what do you usually need to do next?",type:"single",options:["Keep editing this quote","Move on to next workflow step","I'm not sure"],required:true,disposition:"ask",reason:"Ask for the customer’s next task, not a technical diagnosis."},
    {id:"record-scope",text:"Does the August 5 navigation decision apply to this request?",type:"text",options:[],required:false,disposition:"records",reason:"Verify the existing decision before asking the customer."},
    {id:"implementation",text:"Can the saved PDF open in a new tab while Make PDF remains open?",type:"text",options:[],required:false,disposition:"team",reason:"Technical feasibility remains with the website team."},
  ];
  const pdfDetailedQuestions = [{id:"workflow-placement",text:"Where would you expect to find Go to Workflow after opening the PDF?",type:"single",
    options:["Beside the PDF result","At the page footer","I'm not sure"],required:true,disposition:"ask",
    reason:"Resolve the optional action’s placement as a business decision. Opening the PDF still keeps Make PDF open."}];
  const hasJourney = f => f.journey?.enabled === true;
  function text(value,name,required=true) {
    if (typeof value !== "string" || (required && !value.trim())) fail(name + " must contain text.");
    if (value.length > 16000) fail(name + " is too long.");
    return value;
  }
  function scope(value,name="Scope") {
    if (!value || typeof value !== "object") fail(name + " needs an approach and acceptance checks.");
    return {approach:text(value.approach,name + " approach"),checks:text(value.checks,name + " checks")};
  }
  function log(c,action,actor,message,simulated=false) {
    return {...c,trail:[...c.trail,{action,actor,text:message,rev:c.rev,simulated,at:new Date().toISOString()}]};
  }
  function stage(c,value,phase) {
    const owners = {processing:"Website team",clarify:"Requester",blocked:"Website team",review:"Reviewer",release:"Site owner",authorized:"Website team",published:"Complete"};
    return {...c,stage:value,owner:owners[value],reviewFlow:{...c.reviewFlow,phase}};
  }
  function requirePhase(c,phases,action) {
    if (!c.reviewFlow || !phases.includes(c.reviewFlow.phase)) fail(action + " is unavailable at this step.");
  }
  function adaptive(c,legacy,override) {
    let probe = legacy.transition(legacy.createCase(c.text),"submit");
    if (probe.stage === "clarify" && c.answer) probe = legacy.transition(probe,"answer",c.answer);
    probe = {...probe,rev:c.rev,adjustment:c.adjustment,adjustments:clone(c.adjustments),versions:clone(c.versions),stage:"processing"};
    if (override !== undefined) probe.candidateOverride = override;
    return legacy.derive(probe);
  }
  function fromView(view) {
    if(!view.candidate?.trim()) return {approach:'',checks:''};
    return {approach:view.candidate || "",checks:(view.checks || []).map(row=>
      ["hesitation-review","revision"].includes(row.id) ? row.value : row.label || row.value).filter(Boolean).join("\n")};
  }
  function create(base,options,legacy) {
    const isPDF = options.sourceId === "fb_2026-07-11_002" || base.text.trim() === pdfFeedback;
    const view = adaptive(base,legacy,typeof base.candidateOverride === "string" ? base.candidateOverride : undefined);
    const questions = isPDF ? clone(pdfQuestions) : view.question ? [{id:"clarification",text:view.question.text,type:view.question.type === "hesitation" ? "text" : view.question.options.length > 1 ? "single" : "text",
      options:clone(view.question.options),required:true,disposition:"ask",reason:view.question.reason || "Ask only for missing customer context."}] : [];
    const flow = {schema:1,phase:"triage",kind:isPDF ? "behavior" : options.kind || (view.kind === "hesitation" ? "button" : view.kind),
      target:options.target || (isPDF ? "WinQuote · Make PDF" : "WinQuote homepage"),
      source:{id:options.sourceId || (isPDF ? "fb_2026-07-11_002" : null),historical:isPDF,
        history:clone(options.sourceHistory || (isPDF ? [{date:"2026-07-16",decision:"Open the saved PDF and navigate to Workflow."},{date:"2026-08-05",decision:"Keep Make PDF open; navigate to Workflow only through an explicit action."}] : []))},
      scope:isPDF ? clone(pdfScope) : fromView(view),confirmedScope:null,questionDraft:questions,questionPreview:null,
      sentBundle:null,answers:{},suggestedScope:null,candidateDraft:null,result:null,teamCheck:null};
    if (options.journey === true) Object.assign(flow,{
      journey:{enabled:true,scopeCycle:1,activeRound:"initial",detailedSentCycles:[]},
      initialQuestionDraft:clone(questions),initialAnswerText:base.answer || "",detailedAnswerText:"",sharedUnderstanding:null,
      understandingHistory:[],understandingCorrections:[],questionRounds:[],
    });
    return log(stage({...base,reviewFlow:flow},"processing","triage"),"submit","Requester","Submitted feedback for the website team to review before asking any customer questions.");
  }
  function begin(base,options,legacy) {
    if (base.reviewFlow) return base;
    if (!["draft","clarify","processing","blocked"].includes(base.stage)) fail("Keep the submitted review, acceptance, authorization or release frozen. Begin team review only on unfinished work.");
    const converted = create(base,options,legacy);
    converted.trail = clone(base.trail);
    converted.reviewFlow.legacyContext = {stage:base.stage,answer:base.answer,answerSimulated:base.answerSimulated,adjustment:base.adjustment};
    return log(converted,"begin-team-review","Website team","Opened team review on this existing case. Prior answers and delivered versions remain context; no new questions were sent.");
  }
  function pdfSuggestion(answer) {
    const result = {...clone(pdfScope),reason:"The answer does not establish a next task. The team must confirm the appropriate scope.",conflict:null};
    if (/workflow|next (?:step|task)|move on|redirect|工作流|下一步/i.test(answer)) {
      result.approach = "Open the saved customer’s PDF in a new browser tab.\nKeep the original quote on Make PDF.\nProvide an explicit Go to Workflow action for moving to the next step.";
      result.checks = "The saved customer’s PDF opens in a new tab.\nOpening the PDF does not redirect the original Make PDF tab.\nSelecting Go to Workflow opens Workflow for the same quote.";
      result.reason = "The customer wants to move on. An explicit action supports that task while preserving the recorded Make PDF constraint.";
      if (/auto|immediat|redirect|自动|立即|直接/i.test(answer)) result.conflict = "An automatic redirect conflicts with the recorded stay-on-Make-PDF decision. The website team must resolve this before changing the constraint.";
    } else if (/keep editing|edit(?:ing)? (?:this|the|my|same) quote|继续编辑|修改报价/i.test(answer)) {
      result.approach = "Open the saved customer’s PDF in a new browser tab.\nKeep the same quote on Make PDF so the customer can continue editing.\nKeep Go to Workflow as a separate action.";
      result.checks = "The saved customer’s PDF opens in a new tab.\nThe original tab retains the same quote on Make PDF.\nThe customer can return and continue editing that quote.\nNo workflow navigation happens without selecting Go to Workflow.";
      result.reason = "The customer wants to keep editing. Check continuity of the same quote, rather than assuming they want to leave Make PDF.";
    }
    return result;
  }
  function detailedSuggestion(c,answers) {
    const f = c.reviewFlow;
    const result = {...clone(f.scope),reason:"The detailed answer needs a team decision before the shared understanding changes.",conflict:null,decisionRequired:true};
    if (f.source.id !== "fb_2026-07-11_002") return result;
    const raw = Object.values(answers).filter(Boolean).join("\n");
    const answer = raw.trim().toLowerCase();
    const beside = answer === "beside the pdf result", footer = answer === "at the page footer";
    if (beside || footer) {
      const location = beside ? "beside the saved PDF result" : "at the page footer";
      result.approach = "Open the saved customer’s PDF in a new browser tab.\nKeep the same quote on Make PDF.\nShow a separate Go to Workflow action " + location + ".";
      result.checks = "The saved customer’s PDF opens in a new tab.\nThe original tab stays on Make PDF with the same quote.\nGo to Workflow is visible " + (beside ? "beside the result" : "at the page footer") + " and navigates only when selected.";
      result.reason = "The customer expects the optional Workflow action " + location + ". The team must confirm this placement while preserving the existing navigation constraint.";
      result.decisionRequired = false;
    } else if (/auto|immediat|redirect|自动|立即|直接/i.test(raw)) {
      result.conflict = "An automatic redirect conflicts with staying on Make PDF. The team must resolve the detailed answer without silently replacing that recorded constraint.";
    }
    return result;
  }
  function shareUnderstanding(c,value) {
    const f = c.reviewFlow;
    const item = {id:"U" + (f.understandingHistory.length + 1),text:text(value,"Shared understanding"),
      approach:f.confirmedScope.approach,checks:f.confirmedScope.checks,scopeCycle:f.journey.scopeCycle,
      sourceAnswer:c.answer,questionRoundIds:f.questionRounds.filter(round=>round.scopeCycle === f.journey.scopeCycle).map(round=>round.id)};
    f.sharedUnderstanding = item;
    f.understandingHistory = [...f.understandingHistory,clone(item)];
  }
  function questions(value,previous) {
    if (!Array.isArray(value) || value.length > 30) fail("Questions must be an array of at most 30 items.");
    const ids = new Set();
    return value.map(q=>{
      if (!q || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(q.id || "") || ids.has(q.id)) fail("Each question needs a unique valid id.");
      ids.add(q.id);
      if (!["single","text"].includes(q.type) || !["ask","records","team"].includes(q.disposition) || typeof q.required !== "boolean") fail("Choose a question type, disposition and required setting.");
      if (!Array.isArray(q.options) || q.options.some(o=>typeof o !== "string" || !o.trim()) || new Set(q.options).size !== q.options.length || (q.type === "single" && q.options.length < 2)) fail("A single-choice question needs at least two distinct options.");
      const prior = previous.find(item=>item.id === q.id) || pdfQuestions.find(item=>item.id === q.id);
      if (prior && prior.disposition !== "ask" && q.disposition === "ask" && q.screened !== true) fail("Screen and rewrite internal questions before asking the customer.");
      return {id:q.id,text:text(q.text,"Question"),type:q.type,options:clone(q.options),required:q.required,disposition:q.disposition,
        reason:text(q.reason || "","Question reason",false),...(q.screened === true ? {screened:true} : {})};
    });
  }
  const binding = c => JSON.stringify([c.rev,c.reviewFlow.candidateDraft,c.answer,c.adjustment,c.reviewFlow.confirmedScope,
    ...(hasJourney(c.reviewFlow) ? [c.reviewFlow.sharedUnderstanding,c.reviewFlow.understandingCorrections,c.reviewFlow.questionRounds] : [])]);
  const normalized = value => String(value || "").trim().replace(/[‘’]/g,"'").replace(/\s+/g," ").toLowerCase();
  function preview(input) {
    const unavailable = reason => ({interactive:false,reason});
    if (!input || typeof input !== "object") return unavailable("Prepare a current simulated result before opening an interactive preview.");
    let r, approach, kind, sourceId;
    if (input.reviewFlow && Array.isArray(input.versions)) {
      const frozen = ["review","release","authorized","published"].includes(input.stage);
      const v = frozen ? input.versions.at(-1) : null, f = v?.reviewFlow || input.reviewFlow;
      r = v?.result || f.result; approach = v?.candidate || f.candidateDraft?.approach; kind = f.kind; sourceId = f.source.id;
      if (!frozen && r && r.binding !== binding(input)) return unavailable("The candidate changed. Prepare a new simulated result before trying its interaction.");
    } else if (input.result) {
      r = input.result; approach = input.candidate ?? r.approach; kind = input.kind || r.kind; sourceId = r.sourceId;
    } else {
      r = input; approach = r.approach; kind = r.kind; sourceId = r.sourceId;
    }
    if (!r || r.simulated !== true || r.implemented !== false || r.verified !== false) return unavailable("Prepare a current labelled simulation; this preview does not execute a live feature.");
    if (approach !== r.approach) return unavailable("The result does not match the candidate. Prepare the result again.");
    if (kind !== "behavior" || sourceId !== "fb_2026-07-11_002") return unavailable("This candidate has no authored interactive PDF model. Review its actual proposal and checks.");
    const placement = "Open the saved customer’s PDF in a new browser tab.\nKeep the same quote on Make PDF.\nShow a separate Go to Workflow action beside the saved PDF result.";
    const footerPlacement = placement.replace("beside the saved PDF result","at the page footer");
    const approaches = [pdfScope.approach,pdfSuggestion("Keep editing this quote").approach,pdfSuggestion("Move on to next workflow step").approach,placement,footerPlacement];
    if (!approaches.some(copy=>normalized(copy) === normalized(approach))) return unavailable("This edited behavior is outside the authored interaction model. Review the actual proposed steps; the fixed PDF interaction would not demonstrate this candidate.");
    const supportedChecks = [...lines(pdfScope.checks),...lines(pdfSuggestion("Keep editing this quote").checks),...lines(pdfSuggestion("Move on to next workflow step").checks),
      "The original tab stays on Make PDF with the same quote.","Go to Workflow is visible beside the result and navigates only when selected.","Go to Workflow is visible at the page footer and navigates only when selected."];
    if (!lines(r.checks).length || lines(r.checks).some(check=>!supportedChecks.some(known=>normalized(known) === normalized(check)))) return unavailable("This candidate includes checks beyond the authored PDF interaction. Review the actual checks with the team; the fixed interaction cannot demonstrate all of them.");
    return {interactive:true,type:"pdf-workflow",opens:"sample-pdf-new-tab",retains:"make-pdf",workflow:"explicit",
      placement:normalized(approach) === normalized(placement) ? "beside-result" : normalized(approach) === normalized(footerPlacement) ? "page-footer" : "separate-action",
      reason:"This authored interaction demonstrates the proposed navigation in simulation. It does not verify a real PDF implementation."};
  }
  function derive(c,legacy) {
    const f = c.reviewFlow;
    if (["review","release","authorized","published"].includes(c.stage) && c.versions.length) return {...clone(c.versions.at(-1).view),question:null};
    const base = {kind:f.kind,question:null,candidate:"",checks:[],blocked:true,manual:false,reason:"The website team must review the scope before preparing a candidate.",wordCount:0,limit:null,proposal:null,reviewFlow:clone(f),result:clone(f.result),teamCheck:clone(f.teamCheck)};
    if (f.phase === "awaiting-answer") {
      const q = f.sentBundle.questions[0];
      return {...base,question:{type:q.type,text:q.text,options:clone(q.options),source:c.text,reason:"The team sent this reviewed question bundle."},reason:"Waiting for the requester’s answer."};
    }
    const draft = f.candidateDraft;
    if (!draft) return {...base,candidate:f.scope.approach,manual:true};
    let built = {...base,candidate:draft.approach,blocked:false,reason:"",wordCount:(draft.approach.match(/[A-Za-z]+(?:[-’'][A-Za-z]+)*/g) || []).length};
    if (f.kind !== "behavior") {
      const original = adaptive(c,legacy), edited = adaptive(c,legacy,draft.approach);
      if (!original.manual && !original.question) built = {...built,...edited,question:null,reviewFlow:clone(f),result:clone(f.result),teamCheck:clone(f.teamCheck)};
      else built.manual = true;
    }
    const requested = c.adjustment;
    const correction = hasJourney(f) && f.understandingCorrections.at(-1)?.text;
    const source = requested || correction || c.answer || c.text;
    const sourceLabel = requested ? "V" + (c.rev - 1) + " revision request" : correction ? "Understanding correction" : c.answer ? "Requester’s answer" : "Team-confirmed scope";
    const reviewedChecks = lines(draft.checks).map((value,index)=>({id:"team-check-" + index,label:value,value,status:"manual",source,sourceLabel,candidate:draft.approach}));
    built.checks = [...(built.checks || []),...reviewedChecks];
    if (!draft.approach.trim() || !reviewedChecks.length) {
      built.blocked = true; built.reason = "Add the actual candidate and its acceptance checks before preparing a result.";
    }
    return built;
  }
  function exact(c,value,action) {
    const rev = typeof value === "number" ? value : value?.rev;
    if (rev !== c.rev || c.versions.at(-1)?.rev !== c.rev) fail(action + " must identify the exact current submitted version V" + c.rev + ".");
  }
  function transition(input,action,value,legacy) {
    if (!input.reviewFlow) fail("This is not a team-reviewed case.");
    let c = clone(input), f = c.reviewFlow;
    const done = (message,actor="Website team",simulated=false) => log(c,action,actor,message,simulated);
    switch (action) {
      case "submit": return input;
      case "edit-scope":
        requirePhase(c,hasJourney(f) ? ["triage","question-draft","answer-review","spec-review"] : ["triage","question-draft","answer-review"],action);
        for (const key of ["approach","checks"]) if (value?.[key] !== undefined) f.scope[key] = text(value[key],"Scope " + key,false);
        return done("Saved a private scope draft. No customer question was sent.");
      case "draft-questions":
        requirePhase(c,["triage"],action);
        if (hasJourney(f)) f.journey.activeRound = "initial";
        c = stage(c,"processing","question-draft");
        return done("Drafting questions privately. Customer tasks have not changed.");
      case "begin-detailed-questions": {
        if (!hasJourney(f)) fail("Enable the reviewed journey before starting a distinct detailed question round.");
        requirePhase(c,["spec-review"],action);
        if (f.journey.detailedSentCycles.includes(f.journey.scopeCycle)) fail("The detailed question batch for this scope cycle has already been sent. Review its answer or finish the specification.");
        if (f.journey.activeRound !== "detailed" || f.journey.detailedDraftCycle !== f.journey.scopeCycle) {
          f.questionDraft = f.source.id === "fb_2026-07-11_002" ? clone(pdfDetailedQuestions) : [{id:"spec-detail",text:"What specific business decision remains unresolved in this specification?",type:"text",options:[],required:true,disposition:"team",
            reason:"The team must write a specific unresolved business question before asking the customer."}];
        }
        f.journey.activeRound = "detailed"; f.journey.detailedDraftCycle = f.journey.scopeCycle;
        f.questionPreview = null; c = stage(c,"processing","question-draft");
        return done("Drafting a distinct detailed question batch after the shared understanding. Nothing has been sent.");
      }
      case "save-questions":case "edit-questions":
        requirePhase(c,["question-draft"],action); f.questionDraft = questions(value,f.questionDraft); f.questionPreview = null;
        return done("Saved the private question draft. Nothing was sent.");
      case "close-questions":
        requirePhase(c,["question-draft"],action);
        c = stage(c,"processing",hasJourney(f) && f.journey.activeRound === "detailed" ? "spec-review" : "triage");
        return done("Returned to scope review without sending questions.");
      case "preview-questions": {
        requirePhase(c,["question-draft"],action); const selected = questions(f.questionDraft,f.questionDraft).filter(q=>q.disposition === "ask");
        if (!selected.length) fail("Select at least one customer question, or confirm scope without asking.");
        f.questionPreview = {questions:clone(selected),simulated:true,sent:false,...(hasJourney(f)?{round:f.journey.activeRound,scopeCycle:f.journey.scopeCycle}:{})}; return done("Previewed the selected customer questions. This is not a send.");
      }
      case "send-questions": {
        requirePhase(c,["question-draft"],action); const selected = questions(f.questionDraft,f.questionDraft).filter(q=>q.disposition === "ask");
        if (!selected.length) fail("Select at least one customer question, or confirm scope without asking.");
        let id = "Q1";
        if (hasJourney(f)) {
          const detailed = f.journey.activeRound === "detailed";
          if (detailed && f.journey.detailedSentCycles.includes(f.journey.scopeCycle)) fail("This detailed question batch has already been sent for this scope cycle.");
          const nextId = Math.max(0,...f.questionRounds.map(round=>Number(round.id.slice(1)))) + 1;
          id = "Q" + (detailed ? Math.max(2,nextId) : nextId);
        }
        f.sentBundle = {id,rev:c.rev,questions:clone(selected),scope:clone(f.scope),simulated:true,
          ...(hasJourney(f)?{round:f.journey.activeRound,scopeCycle:f.journey.scopeCycle}:{})};
        if (hasJourney(f)) {
          f.questionRounds = [...f.questionRounds,{...clone(f.sentBundle),answered:false,answers:null,answerText:""}];
          if (f.journey.activeRound === "detailed") f.journey.detailedSentCycles = [...f.journey.detailedSentCycles,f.journey.scopeCycle];
        }
        c = stage(c,"clarify","awaiting-answer"); return done("Sent only the reviewed customer questions in this simulation.","Website team",true);
      }
      case "answer": {
        requirePhase(c,["awaiting-answer"],action);
        const qs = f.sentBundle.questions;
        const supplied = typeof value === "string" ? {[qs[0].id]:value} : value?.answers || value;
        if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)) fail("Answers must identify the sent questions.");
        if (Object.keys(supplied).some(id=>!qs.some(q=>q.id === id))) fail("Do not answer a private question that was not sent.");
        const currentAnswers = {};
        for (const q of qs) {
          const answer = text(supplied[q.id] ?? "","Answer to “" + q.text + "”",q.required);
          if (answer && q.type === "single" && !q.options.includes(answer)) fail("Choose a sent answer option or ask the team to revise the question.");
          currentAnswers[q.id] = answer;
        }
        const answerText = qs.map(q=>currentAnswers[q.id]).filter(Boolean).join("\n");
        f.answers = hasJourney(f) ? {...f.answers,...currentAnswers} : currentAnswers;
        if (hasJourney(f)) {
          const round = f.questionRounds.find(item=>item.id === f.sentBundle.id);
          if (!round || round.answered || round.scopeCycle !== f.journey.scopeCycle || round.round !== f.journey.activeRound) fail("Answer only the current sent question batch once.");
          f.questionRounds = f.questionRounds.map(item=>item.id === round.id ? {...item,answered:true,answers:clone(currentAnswers),answerText,answerSimulated:false} : item);
          if (round.round === "detailed") f.detailedAnswerText = answerText;
          else { f.initialAnswerText = answerText; c.answer = answerText; c.answerSimulated = false; }
          f.suggestedScope = round.round === "detailed" ? detailedSuggestion(c,currentAnswers) :
            f.source.id === "fb_2026-07-11_002" ? pdfSuggestion(c.answer) : {...fromView(adaptive(c,legacy)),reason:"Review the candidate and checks derived from this actual answer. The website team must confirm them.",conflict:null};
        } else {
          c.answer = answerText; c.answerSimulated = false;
          f.suggestedScope = f.source.id === "fb_2026-07-11_002" ? pdfSuggestion(c.answer) : {...fromView(adaptive(c,legacy)),reason:"Review the candidate and checks derived from this actual answer. The website team must confirm them.",conflict:null};
        }
        c = stage(c,"processing","answer-review"); return done("The requester answered. The team must review the suggested scope before preparing a candidate.","Requester");
      }
      case "confirm-scope": {
        requirePhase(c,hasJourney(f) ? ["triage","answer-review","spec-review"] : ["triage","answer-review"],action);
        f.scope = scope(value,"Explicit team-selected scope"); f.confirmedScope = clone(f.scope);
        f.result = null; f.teamCheck = null;
        if (hasJourney(f)) {
          shareUnderstanding(c,value?.understanding ?? f.scope.approach);
          f.candidateDraft = null; c = stage(c,"processing","spec-review");
          return done("Shared the team-authored understanding and scope. The customer may correct it before the specification proceeds.");
        }
        f.candidateDraft = clone(f.scope); c = stage(c,"processing","candidate");
        return done("Confirmed the scope and checks. A suggestion alone did not approve them.");
      }
      case "edit-understanding":
        if (!hasJourney(f)) fail("This case does not use a shared-understanding step.");
        requirePhase(c,["spec-review"],action);
        shareUnderstanding(c,value?.text);
        return done("Explicitly updated the understanding shared with the customer. Private scope drafts were not substituted for it.");
      case "correct-understanding": {
        if (!hasJourney(f)) fail("This case does not use a shared-understanding step.");
        requirePhase(c,["spec-review","candidate","checking","ready"],action);
        if (!f.sharedUnderstanding) fail("The team must share an understanding before it can be corrected.");
        const correction = {id:"C" + (f.understandingCorrections.length + 1),text:text(value?.text,"Understanding correction"),scopeCycle:f.journey.scopeCycle,understanding:clone(f.sharedUnderstanding)};
        f.understandingCorrections = [...f.understandingCorrections,correction];
        f.sharedUnderstanding = {...f.sharedUnderstanding,needsRevision:true};
        f.journey.scopeCycle += 1; f.journey.activeRound = "initial";
        f.scope = {approach:f.sharedUnderstanding.approach,checks:f.sharedUnderstanding.checks}; f.confirmedScope = null;
        f.questionDraft = clone(f.initialQuestionDraft); f.questionPreview = null; f.sentBundle = null; f.suggestedScope = null;
        f.candidateDraft = null; f.result = null; f.teamCheck = null;
        c.candidateOverride = null; c.accepted = null; c.authorization = null; c.receipt = null;
        c = stage(c,"processing","triage");
        return done("The requester corrected the shared understanding. The original feedback is preserved; the team must revise and share the scope again.","Requester");
      }
      case "finish-spec":
        if (!hasJourney(f)) fail("This case does not use a separate specification review.");
        requirePhase(c,["spec-review"],action);
        if (!f.sharedUnderstanding || f.sharedUnderstanding.needsRevision || f.sharedUnderstanding.scopeCycle !== f.journey.scopeCycle) fail("Share the corrected understanding for the current scope cycle before proceeding.");
        f.candidateDraft = scope(f.sharedUnderstanding,"Shared scope");
        f.confirmedScope = clone(f.candidateDraft); f.result = null; f.teamCheck = null;
        c = stage(c,"processing","candidate");
        return done("Finished the specification using the explicitly shared understanding. No additional customer questions were required.");
      case "edit-candidate":
        requirePhase(c,["candidate","checking","ready"],action);
        if (typeof value === "string") value = {approach:value};
        if (!value || (value.approach === undefined && value.checks === undefined)) fail("Edit the approach or checks before saving.");
        for (const key of ["approach","checks"]) if (value[key] !== undefined) f.candidateDraft[key] = text(value[key],"Candidate " + key,false);
        c.candidateOverride = f.candidateDraft.approach; f.result = null; f.teamCheck = null; c = stage(c,"processing","candidate");
        return done("Saved the actual candidate. Its prior simulated result and check summary are now stale.");
      case "begin-check":
        requirePhase(c,["candidate"],action); c = stage(c,"processing","checking"); return done("Preparing a simulated result preview. No feature has been implemented or executed.");
      case "prepare-result": {
        requirePhase(c,["candidate","checking","ready"],action); const view = derive(c,legacy);
        if (view.blocked || !view.candidate.trim()) fail(view.reason || "Resolve candidate checks before preparing a result.");
        const prior = c.versions.at(-1);
        const priorChecks = prior?.reviewFlow?.candidateDraft.checks ?? (prior?.checks || []).map(row=>row.value || row.label).join("\n");
        if (prior && prior.candidate.trim() === view.candidate.trim() && priorChecks.trim() === f.candidateDraft.checks.trim()) fail("Revise the actual candidate or acceptance checks before preparing the next version.");
        const key = binding(c);
        f.result = {rev:c.rev,kind:f.kind,sourceId:f.source.id,title:"Simulated result preview",approach:view.candidate,steps:lines(view.candidate),checks:f.candidateDraft.checks,
          binding:key,simulated:true,implemented:false,verified:false};
        f.teamCheck = {rev:c.rev,title:"Simulated team check summary",summary:"Review the simulated result against these checks. Real feature behavior has not been executed or verified.",
          checks:clone(view.checks),binding:key,simulated:true,verified:false};
        c = stage(c,"processing","ready"); return done("Prepared a labelled simulated result and team check summary for this exact candidate. No live implementation was tested.","Website team",true);
      }
      case "deliver": {
        requirePhase(c,["ready"],action); const view = derive(c,legacy), key = binding(c);
        if (view.blocked || !f.result || !f.teamCheck || f.result.binding !== key || f.teamCheck.binding !== key) fail("Prepare a current simulated result and team check summary before sending this version.");
        const snapshot = {rev:c.rev,text:view.candidate,candidate:view.candidate,source:c.text,answer:c.answer,answerSimulated:c.answerSimulated,
          adjustment:c.adjustment,checks:clone(view.checks),view:clone(view),reviewFlow:clone(f),result:clone(f.result),teamCheck:clone(f.teamCheck)};
        c.versions.push(snapshot); c = stage(c,"review","review"); return done("Sent V" + c.rev + " and its simulated result for review. This is not evidence of a working live feature.");
      }
      case "adjust": {
        if (c.stage !== "review") fail("Only a submitted version can receive a revision request.");
        if (typeof value === "object") exact(c,value,action);
        const note = text(typeof value === "string" ? value : value?.reason,"Revision request");
        c.adjustment = note; c.adjustments.push({rev:c.rev,text:note}); c.rev += 1;
        c.accepted = null; c.authorization = null; c.receipt = null; c.candidateOverride = c.versions.at(-1).candidate;
        const previous = c.versions.at(-1);
        f.candidateDraft = clone(previous.reviewFlow?.candidateDraft || {approach:previous.candidate,checks:previous.checks.map(row=>row.value || row.label).join("\n")}); f.result = null; f.teamCheck = null;
        c = stage(c,"processing","candidate"); return done("Requested changes to V" + (c.rev - 1) + ": " + note,"Reviewer");
      }
      case "accept":
        if (c.stage !== "review") fail("Accept only the current submitted review version."); exact(c,value,action);
        c.accepted = {rev:c.rev,actor:"Reviewer",simulated:false}; c = stage(c,"release","accepted");
        return done("Accepted V" + c.rev + ". The site owner must separately authorize release.","Reviewer");
      case "authorize":
        if (c.stage !== "release" || c.accepted?.rev !== c.rev) fail("Authorize only the exact accepted version."); exact(c,value,action);
        c.authorization = {rev:c.rev,actor:"Site owner",target:c.versions.at(-1).reviewFlow.target,simulated:false}; c = stage(c,"authorized","authorized");
        return done("Authorized the simulated release of V" + c.rev + " to " + c.authorization.target + ".","Site owner");
      case "publish": {
        if (c.stage !== "authorized" || c.accepted?.rev !== c.rev || c.authorization?.rev !== c.rev) fail("Execute only the exact accepted and authorized version."); exact(c,value,action);
        const version = c.versions.at(-1);
        c.receipt = {rev:c.rev,target:c.authorization.target,simulated:true,candidate:version.candidate,checks:clone(version.checks),
          result:clone(version.result),teamCheck:clone(version.teamCheck),implemented:false,verified:false};
        c = stage(c,"published","published"); return done("Simulated release of V" + c.rev + ". No live feature was implemented, tested or published.","Website team",true);
      }
      default: fail("Unknown action “" + action + "”.");
    }
  }
  const api = {pdfFeedback,create,begin,derive,transition,preview};
  root.FlowTeamReview = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis);
