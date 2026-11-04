(function (root) {
  "use strict";
  const common = typeof module === "object" && module.exports;
  const Model = common ? require("./model.js") : root.FlowModel;
  const Personal = common ? require("./custom-story.js") : root.FlowCustomStory;
  const initialFeedback = "Recommend templates first for standard quotes, and start custom quotes from scratch. Keep the reminder to add customer details next. Use no more than 18 words.";
  const ownerByStage = {
    draft: "Requester", clarify: "Requester", processing: "Website team", review: "Reviewer",
    release: "Site owner", authorized: "Website team", published: "Complete", blocked: "Website team",
  };
  const workStages = ["draft", "processing", "clarify", "blocked"];
  const count = s => (s.match(/[A-Za-z]+(?:[-’'][A-Za-z]+)*/g) || []).length;
  const clean = s => typeof s === "string" ? s.trim() : "";
  const clone = input => JSON.parse(JSON.stringify(input));
  const askKey = q => q ? JSON.stringify([q.prompt, q.source, q.options]) : "";
  const apiKind = kind => ["entry", "button"].includes(kind) ? kind : "other";

  function createCase(text = initialFeedback) {
    return {
      text: String(text), stage: "draft", owner: ownerByStage.draft, rev: 1,
      versions: [], trail: [], answer: "", answerKey: "", answerSimulated: false,
      adjustment: "", adjustments: [], candidateOverride:null,
      accepted: null, authorization: null, receipt: null,
    };
  }

  // Feed the original application's parser raw excerpts, clarification and each actual review note.
  function recordFor(c) {
    const record = Model.create("WQ-DEMO", { raw: c.text, location: "WinQuote homepage" });
    const question = Model.questionDraft(record);
    if (question && c.answer && c.answerKey === askKey(question)) {
      const choice = [...question.options, "Ask the team"].includes(c.answer) ? c.answer : "Other wording";
      record.answer = { choice, note: choice === "Other wording" ? c.answer : "" };
      record.needsQuestion = false;
    }
    record.adjustments = c.adjustments.map(item => ({round:item.rev, note:item.text}));
    record.rounds = c.versions.map(v => ({n:v.rev, text:v.candidate}));
    return record;
  }

  // Use the same complete-clause coverage check as the personal tour. It catches, for instance,
  // a known label plus a separate request to change positioning or export a PDF.
  function unsupportedReason(c, record) {
    if (record.blocked) return record.blocked;
    if (["Ask the team", "请团队建议"].includes(c.answer)) return "The requester asked the website team to propose the copy and decide how to check it.";
    if (record.answer && Model.suggest(c.answer).blocked) return Model.suggest(c.answer).blocked;
    const text = [c.text, ...c.adjustments.map(item => item.text)].join("\n");
    const frames = Personal.build({raw:text, answer:record.answer || undefined});
    const last = frames.at(-1);
    return last.phase === "Team review" ? (last.record.blocked || last.copy) : "";
  }

  function normalizeChecks(rows) {
    return rows.map(({result, status, ...fields}) => ({
      ...fields, value: result,
      status: {met:"pass", missing:"fail", manual:"manual"}[status],
    }));
  }

  // These two variants keep the unchanged final sentence anchored across budget edits.
  function anchoredCandidate(draft, record, rows) {
    if (draft.kind !== "entry" || !draft.text || !rows.some(row => row.id === "entry-priority" && row.direction === "first")) return draft.text;
    const details = rows.some(row => row.id === "customer-details" && row.keepDetails);
    const suffix = details ? " Add customer details next." : "";
    const long = "Standard quotes start with a template. Custom quotes start from scratch." + suffix;
    const short = "Standard: template. Custom: from scratch." + suffix;
    const limit = getLimit(rows);
    const shorter = /缩短|精简|更短|shorter|shorten/i.test(record.adjustments.at(-1)?.note || "");
    return (limit !== null && count(long) > limit) || shorter ? short : long;
  }
  function getLimit(rows) {
    return rows.find(row => row.id === "word-limit")?.limit ?? null;
  }

  // Missing one of the two requested paths is measurable. The reviewer still
  // decides whether a present explanation actually communicates the right order.
  function assessEditedEntry(checks, candidate) {
    const direction = checks.find(row => row.id === "entry-priority");
    if (!direction) return;
    const hasStandard = /\bstandard\b|标准/.test(candidate.toLowerCase());
    const hasCustom = /\bcustom\b|定制/.test(candidate.toLowerCase());
    const hasTemplate = /\btemplates?\b|模板/i.test(candidate);
    const hasScratch = /\bscratch\b|从头|从零/i.test(candidate);
    if (!(hasStandard && hasCustom && hasTemplate && hasScratch)) {
      direction.status = "fail";
      direction.value = "Explain that standard quotes start with a template and custom quotes start from scratch.";
    }
  }

  function derive(c) {
    if (!workStages.includes(c.stage) && c.versions.length) {
      const version = c.versions.at(-1);
      return { ...clone(version.view), question:null };
    }
    const view = {kind:"other", question:null, candidate:"", checks:[], blocked:false,
      manual:false, reason:"", wordCount:0, limit:null};
    if (!clean(c.text)) return {...view,reason:"Write your feedback to see a draft and its review criteria here."};
    const record = recordFor(c);
    const suggested = Model.suggest(c.text);
    view.kind = apiKind(suggested.kind);
    const question = Model.questionDraft(record);
    if (question) {
      view.question = {text:question.prompt, options:question.options, source:question.source, reason:question.reason};
      view.reason = question.reason;
      return view;
    }
    const draft = Model.draft(record);
    const edited = typeof c.candidateOverride === "string";
    view.candidate = edited ? c.candidateOverride : anchoredCandidate(draft,record,Model.assess(record,draft.text));
    view.wordCount = count(view.candidate);
    view.checks = normalizeChecks(Model.assess(record,view.candidate));
    if (edited && view.kind === "entry") assessEditedEntry(view.checks,view.candidate);
    view.limit = getLimit(view.checks);
    view.manual = true;
    const reason = unsupportedReason(c,record);
    if (reason || !clean(draft.text)) {
      view.blocked = true;
      view.reason = reason || "The website team needs to confirm the scope before drafting a change or setting review criteria.";
      if (!view.checks.some(it=>it.status === "manual" && it.value === view.reason)) {
        view.checks.push({id:"scope",label:"Confirm the scope",value:view.reason,status:"manual",source:c.adjustment || c.text,sourceLabel:c.adjustment ? `V${c.rev - 1} revision request` : "Original feedback"});
      }
      return view;
    }
    view.manual = false;
    if (!clean(view.candidate)) {
      const reason = "Add draft copy before sending it for review.";
      view.checks.push({id:"candidate",label:"Draft copy",value:reason,status:"fail",source:c.text,sourceLabel:"Original feedback"});
      return {...view,blocked:true,reason};
    }
    const failed = view.checks.find(it => it.status === "fail");
    if (failed) {
      view.reason = view.limit !== null && view.wordCount > view.limit
        ? `${view.wordCount} words, ${view.wordCount - view.limit} over the limit.`
        : failed.value;
      view.blocked = true;
    }
    return view;
  }

  const workStage = view => view.question ? "clarify" : view.blocked ? "blocked" : "processing";
  function setStage(c, stage) { return {...c, stage, owner:ownerByStage[stage]}; }
  function log(c, action, actor, text, simulated) {
    return {...c, trail:[...c.trail,{action,actor,text,rev:c.rev,simulated,at:new Date().toISOString()}]};
  }

  function editSource(c,text) {
    const raw = String(text);
    if (raw === c.text) return c;
    if (c.versions.length) return createCase(raw);
    const fresh = {...c,text:raw,candidateOverride:null};
    if (!c.answerKey || askKey(Model.suggest(raw).question) !== c.answerKey) {
      Object.assign(fresh,{answer:"",answerKey:"",answerSimulated:false});
    }
    if (c.stage === "draft" || !raw.trim()) return setStage(fresh,"draft");
    return setStage(fresh,workStage(derive(fresh)));
  }

  function editCandidate(c,text) {
    if (!["processing","blocked"].includes(c.stage)) return c;
    if (text != null && typeof text !== "string") return c;
    const override = text ?? null;
    if ((c.candidateOverride ?? null) === override) return c;
    const edited = {...c,candidateOverride:override};
    return setStage(edited,workStage(derive(edited)));
  }

  function reviseAdjustment(c,value) {
    const note = clean(value), last = c.adjustments.at(-1);
    if (c.stage !== "blocked" || c.rev < 2 || last?.rev !== c.rev - 1 || !note || note === last.text) return c;
    const corrected = {...c, adjustment:note, adjustments:[...c.adjustments.slice(0,-1),{...last,text:note}]};
    const next = setStage(corrected,workStage(derive(corrected)));
    return log(next,"reviseAdjustment","Reviewer",`Updated the revision request for V${c.rev}: ${note}`,false);
  }

  function transition(c,action,value) { return apply(c,action,value,false); }
  function apply(c,action,value,simulated) {
    const view = derive(c), note = clean(value);
    let next = c, message, actor = c.owner;
    switch (action) {
      case "submit":
        if (c.stage !== "draft" || !clean(c.text)) return c;
        next = setStage(c,workStage(view));
        message = view.question ? "Submitted feedback. One question needs an answer." : "Submitted feedback to the website team.";
        break;
      case "answer": {
        if (c.stage !== "clarify" || !note || !view.question) return c;
        const answered = {...c,answer:note,answerKey:askKey(Model.suggest(c.text).question),answerSimulated:simulated};
        next = setStage(answered,workStage(derive(answered)));
        message = "Answered the question: " + note;
        break;
      }
      case "deliver": {
        if (c.stage !== "processing" || !view.candidate || view.blocked || view.question) return c;
        const snapshot = {rev:c.rev,text:view.candidate,candidate:view.candidate,source:c.text,
          answer:c.answer,adjustment:c.adjustment,checks:clone(view.checks),view:clone(view)};
        next = setStage({...c,versions:[...c.versions,snapshot]},"review");
        message = `Sent V${c.rev} to the reviewer.`;
        break;
      }
      case "adjust": {
        if (c.stage !== "review" || !note) return c;
        const adjusted = setStage({...c,adjustment:note,adjustments:[...c.adjustments,{rev:c.rev,text:note}],rev:c.rev+1,candidateOverride:null},"processing");
        next = setStage(adjusted,workStage(derive(adjusted)));
        message = `Requested changes to V${c.rev}: ${note}`;
        break;
      }
      case "accept":
        if (c.stage !== "review") return c;
        next = setStage({...c,accepted:{rev:c.rev,actor,simulated}},"release");
        message = `Accepted V${c.rev}. Release approval is with the site owner.`;
        break;
      case "authorize":
        if (c.stage !== "release" || c.accepted?.rev !== c.rev) return c;
        next = setStage({...c,authorization:{rev:c.rev,actor,target:"WinQuote homepage",simulated}},"authorized");
        message = `Approved the simulated release of V${c.rev} to the WinQuote homepage.`;
        break;
      case "publish":
        if (c.stage !== "authorized" || c.authorization?.rev !== c.rev) return c;
        next = setStage({...c,receipt:{rev:c.rev,target:c.authorization.target,simulated:true}},"published");
        message = `Simulated release of V${c.rev} to the WinQuote homepage. Receipt recorded.`;
        break;
      default: return c;
    }
    return log(next,action,actor,message,simulated);
  }

  function exampleRevision(c,view) {
    if (view.kind === "button") {
      const label = view.candidate === "Build my quote" ? "Start a quote" : "Build my quote";
      return `Change the button label to "${label}".`;
    }
    if (view.kind === "entry" && view.wordCount > 10) return "Shorten the copy to no more than 10 words and keep both quote paths clear.";
    if (view.kind === "entry") return /Add customer details/.test(view.candidate)
      ? "Remove the reminder to add customer details next."
      : "Keep the reminder to add customer details next.";
    return "";
  }

  function step(c) {
    const view = derive(c);
    const run = (action,value) => apply(c,action,value,true);
    switch (c.stage) {
      case "draft": return run("submit");
      case "clarify": return run("answer",view.question.options[0] || "Start a quote");
      case "processing": return run("deliver");
      case "review": {
        if (c.rev !== 1) return run("accept");
        const note = exampleRevision(c,view);
        if (!note) return run("accept");
        const revised = run("adjust",note);
        // Do not invent a simulated new requirement the explicit original budget cannot support.
        return revised.stage === "blocked" ? run("accept") : revised;
      }
      case "release": return run("authorize");
      case "authorized": return run("publish");
      default: return c;
    }
  }

  const api = {initialFeedback,createCase,editSource,editCandidate,reviseAdjustment,derive,transition,step};
  root.CaseEngine = api;
  if (common) module.exports = api;
})(globalThis);
