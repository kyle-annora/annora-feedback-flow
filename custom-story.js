(function (root) {
  "use strict";
  const Model = typeof module === "object" && module.exports
    ? require("./model.js")
    : root.FlowModel;

  const step = (record, role, phase, title, copy, focus, extra = {}) => ({
    record, role, phase, title, copy, focus, page: "detail", ...extra,
  });
  const act = (record, role, action, payload = {}) =>
    Model.change(record, role, action, payload, record.rev);

  function exampleAnswer(question, supplied) {
    const choice = supplied?.choice?.trim(), note = supplied?.note?.trim() || "";
    if (choice || note) {
      const selected = choice || "Other wording";
      if (![...question.options, "Other wording", "Ask the team"].includes(selected)) {
        throw new Error("Choose one of the current options or write your own answer.");
      }
      if (selected === "Other wording" && !note) throw new Error("Enter the answer you want to try.");
      return {answer: {choice:selected, note}, supplied:true};
    }
    return {
      answer: question.options.length
        ? {choice:question.options[0], note:""}
        : {choice:"Other wording", note:"Start a quote"},
      supplied:false,
    };
  }

  function extraRequirement(record,draft,checks) {
    const inputs = [record.raw];
    if (record.goalSource === "client") inputs.push(record.goal);
    const covered = new Set(checks.filter(check => check.id === "word-limit" || check.id === "customer-details").map(check => check.source));
    for (const input of inputs) {
      for (const part of Model.clauses(input)) {
        const afterLabel = part.match(/(?:改成|改为|换成|命名为|写成|\bto)\s*[「“"][^」”"]+[」”"]\s*(.+)$/i)?.[1]?.trim();
        const request = afterLabel || part;
        // A matching “customer details” or word-count clause can still ask for a different feature.
        const separateFeature = /导出|上传|下载|跳转|排序|译成|翻译|字号|背景色|\b(?:export|pdf|upload|download|redirect|reposition|translate|font size|background colou?r)\b/i.test(request);
        if (separateFeature && (afterLabel || Model.suggest(part).kind !== "button")) return request;
        if (!afterLabel && (covered.has(request) || (draft.kind === "entry" && Model.isEntryConstraint(request)))) continue;
        if (!afterLabel && Model.suggest(part).kind === draft.kind) continue;
        // Only treat an explicit, separate request as unaccounted for. A descriptive clause can explain its neighbor.
        const actionable = /新增|添加|增加|支持|导出|跳转|链接|按钮颜色|字号|改成|改为|打开|删掉|删除|隐藏|移到|移动|移至|挪到|右上角|背景色|发送|翻译|排序|上传|下载|\b(?:export|redirect|enable|move|style|add|send|remove|delete|hide|translate|upload|download|resize)\b/i;
        const secondaryCopy = draft.kind === "button" && /保留|移除|去掉|提示|\b(?:keep|retain|omit)\b/i.test(request);
        if (!actionable.test(request) && !secondaryCopy) continue;
        return request;
      }
    }
    return "";
  }

  function build(input) {
    if (typeof input?.raw !== "string" || !input.raw.trim()) {
      throw new Error("Describe what you would like to change in WinQuote.");
    }
    const record = Model.create("WQ-PREVIEW", {
      raw:input.raw, goal:input.goal, goalSource:input.goalSource,
      location:input.location || "Homepage · Quote entry", attachment:input.attachment,
    });
    const intakeDraft = {
      raw:record.raw, goal:record.goal, custom:record.goalSource === "client",
      location:record.location, attachment:record.attachment,
    };
    const frames = [step(record, "client", "Original feedback", "Start with your feedback",
      "This walkthrough uses your feedback and its page location. Candidates, decisions and receipts belong to this simulation.",
      "#ws-raw", {page:"new", source:"winquote", drafts:{"intake:winquote":JSON.stringify(intakeDraft)}})];
    let current = act(record, "team", "take");
    let assumption = "";
    const add = (role, phase, title, copy, focus, extra) =>
      frames.push(step(current, role, phase, title, copy, focus, {assumption, ...extra}));

    // A correction or an explicit trial answer can introduce a policy change as well.
    const blockedGoal = record.goalSource === "client" && Model.suggest(record.goal).blocked;
    if (blockedGoal && !current.blocked) current = act(current, "team", "block", {note:blockedGoal});
    if (current.blocked) {
      add("team", "Team review", "Check the pricing rules",
        "This feedback affects quoting behavior. The website team confirms the rules and scope before agreeing on how to review the change.", ".dt-callout");
      return frames;
    }

    if (current.needsQuestion) {
      const question = Model.questionDraft(current);
      if (!question) {
        add("team", "Clarification", "The team prepares a question", "The website team needs more information and will write a clarification question.", 'form[data-kind="ask"]');
        return frames;
      }
      current = act(current, "team", "ask", question);
      const {answer,supplied} = exampleAnswer(question,input.answer);
      const answerText = answer.choice === "Other wording" ? answer.note : [answer.choice,answer.note].filter(Boolean).join(" · ");
      assumption = supplied
        ? (input.answerOrigin === "record" ? "Recorded answer: “" : "Walkthrough answer: “") + answerText + "”."
        : "Example answer for this walkthrough: “" + answerText + "”.";
      const key = "detail:" + current.id + ":q1";
      add("client", "Clarification", question.prompt,
        question.reason + (supplied ? input.answerOrigin === "record" ? " This walkthrough uses the answer already recorded on this feedback." : " Your walkthrough answer will guide the draft." : " The original feedback has no answer, so the walkthrough will use a sample."),
        'form[data-kind="answer"]', {drafts:{[key+"choice"]:answer.choice,[key+"note"]:answer.note}});
      current = act(current, "client", "answer", answer);
      const blockedAnswer = Model.suggest(answerText).blocked;
      if (blockedAnswer) {
        current = act(current, "team", "block", {note:blockedAnswer});
        add("team", "Team review", "The answer affects pricing rules",
          "The website team needs to confirm this rule before drafting copy or review criteria.", ".dt-callout");
        return frames;
      }
    }

    const draft = Model.draft(current);
    const checks = Model.assess(current,draft.text);
    if (!draft.text) {
      add("team", "Team review", "The website team needs to draft a candidate",
        "The simulated AI needs more information. The website team will confirm the scope and review criteria before delivery.", "[data-live-proof]");
      return frames;
    }

    const focus = draft.kind === "button" ? ".dt-proof-button" : '[data-key="deliver1text"]';
    const extra = extraRequirement(current,draft,checks);
    const why = extra ? "The copy is ready to draft. Another part of the request needs team review."
      : current.answer ? "The draft uses the clarification answer." : "The request is clear enough to draft without clarification.";
    add("team", "Candidate", draft.kind === "button" ? "Check the button label" : "Review the homepage copy",
      why + " The website team checks the draft against the review criteria.", focus);
    if (extra) {
      const explanation = "The website team needs to confirm the scope and review criteria for “" + extra + "”. The current candidate covers only the copy request.";
      current = act(current, "team", "block", {note:explanation});
      add("team", "Team review", "Another requirement needs team review", explanation, ".dt-callout");
      return frames;
    }
    const missing = checks.find(check => check.status === "missing");
    if (missing) {
      add("team", "Needs attention", "Address the unmet requirement",
        "“" + missing.label + "” needs attention. " + missing.result + " The website team will revise the candidate.",
        '[data-live-proof] [data-result="missing"]');
      return frames;
    }
    current = act(current, "team", "deliver", draft);
    const manual = checks.some(check => check.status === "manual");
    add("client", "Review criteria", "Review V1 against these criteria",
      manual
        ? "Compare the candidate, sources and measurements. The reviewer decides whether the copy meets each manual criterion."
        : "Each check shows its result and source. The reviewer uses this evidence to decide whether to accept V1.",
      ".dt-evidence", {round:1});

    // The following decisions exist only on the isolated example record.
    current = act(current, "client", "accept", {round:1});
    add("publisher", "Release authorization", "The site owner authorizes release",
      "The walkthrough assumes the reviewer accepted V1. The site owner checks the version and target before making a separate release decision.",
      ".dt-releasefacts", {releaseLink:true});
    current = act(current, "publisher", "authorize", {round:1,target:current.release.target});
    current = act(current, "team", "start");
    current = act(current, "team", "success");
    add("client", "Simulated release receipt", "View the simulated release receipt",
      "The receipt records the site owner’s authorization and the website team’s simulated release.",
      ".dt-proof");
    return frames;
  }

  root.FlowCustomStory = {build};
  if (typeof module === "object" && module.exports) module.exports = root.FlowCustomStory;
})(globalThis);
