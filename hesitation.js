(function (root) {
  "use strict";
  const common = typeof module === "object" && module.exports;
  const Model = common ? require("./model.js") : root.FlowModel;
  const feedback = "The “Create” button on the WinQuote homepage is unclear. I don’t know what it should say.";
  const answers = Object.freeze([
    "I was worried clicking it would send a quote to the customer.",
    "I wasn’t sure whether to use a template or start from scratch.",
  ]);
  const proposals = {
    sending: {
      items: [{label:"Configure a walk-in", detail:"Opens the configurator. Nothing is sent to your customer."}],
      reviewQuestion:"What opens when you click this, and what, if anything, is sent to the customer?",
    },
    paths: {
      items: [
        {label:"Use a template", detail:"For a standard walk-in, start with a preset layout."},
        {label:"Start from scratch", detail:"For a custom walk-in, build your own layout."},
      ],
      reviewQuestion:"Which option would you choose for a standard walk-in, and which for a custom layout?",
    },
  };
  function question(raw, suggested) {
    if (suggested.blocked || (suggested.kind === "button" && !suggested.question)) return null;
    // Match the control's name, not “create” as a verb in another request.
    const namedControl = /[“"'‘「]\s*create\s*[”"'’」]|\bcreate\s+(?:button|CTA|label|link)\b|\b(?:click(?:ing)?|press(?:ing)?|tap(?:ping)?)\s+create\b(?!\s+(?:a|an|the|my|new)\b)|\bcreate\b\s*(?:(?:is|looks|seems|feels)\s+)?(?:unclear|confusing|ambiguous|vague|按钮|看不懂|不(?:清楚|明白))|(?:看不懂|不理解|不明白)\s*create\b|\b(?:understand|by)\s+create\b(?=\s*[.?!,]|$)/i;
    if (!namedControl.test(raw) || !/unclear|confus|ambiguous|vague|hesitat|(?:hard|difficult) to understand|(?:don['’]?t|didn['’]?t|couldn['’]?t|can['’]?t|not sure|unsure).{0,40}(?:understand|mean|tell|happen|what|click|word)|看不懂|不明白|不清(?:楚|晰)|困惑|不确定|不理解|犹豫/i.test(raw)) return null;
    // A requester who knows the replacement already can use the existing exact-wording path.
    if (/\bI (?:already )?know (?:what|the wording)|(?:已(?:经)?知道|已确定).{0,12}(?:文案|措辞|改成)/i.test(raw)) return null;
    return {
      type:"hesitation", prompt:"What made you hesitate before clicking “Create”?",
      options:[...answers], source:raw.trim(),
      reason:"Describe what gave you pause. The website team will propose the wording.",
    };
  }

  // Only these two concerns have an authored response in the simulator. A second
  // task or unfamiliar concern belongs with the team, even if it mentions “send”.
  function outsideScope(text) {
    return Model.suggest(text).blocked ||
      /\b(?:export|import|downloads?|uploads?|redirect|reposition|resize|translate|recolou?r|PDF|discount|pricing|tax rate|font size|background colou?r|mobile layout|small text|too small|hard to read|API|attachment)\b|(?:^|[.!?;,]|\b(?:also|and|please|could you|need you to))\s*(?:also\s+)?(?:move|hide|delete|style|add|remove|change the colou?r|enable|implement|integrate|fix)\b|(?:导出|导入|上传|下载|移到|移动|隐藏|删除|字号|背景色|翻译|定价|折扣|税率|新增|移动端|字数|词以内)|\d+\s+words?\b/i.test(text);
  }
  function interpret(answer) {
    const target = /customer|client|recipient|buyer|quote|客户|客人|报价|发出/i;
    const sending = /\b(?:send|sends|sending|sent|email|emails|emailing|emailed|e-mail|share|shared|notify)\b|发[送给出]|寄给|通知/i;
    const paths = /\btemplates?\b.{0,70}\bscratch\b|\bscratch\b.{0,70}\btemplates?\b|(?:which|what)\s+(?:(?:quote|homepage|home page|entry|starting)\s+)?(?:one|entry|entrance|option|path|route|button|starting point|way)|哪个(?:入口|选项|按钮)|哪(?:个|条)路|两个入口|模板.{0,20}(?:从头|从零|自定义)|(?:从头|从零).{0,20}模板/i;
    const hesitation = /worr|afraid|fear|concern|thought|scared|think|might|would|could|wasn['’]?t sure|weren['’]?t sure|didn['’]?t know|couldn['’]?t tell|can['’]?t tell|unsure|whether|not sure|don['’]?t know|uncertain|confus|担心|怕|以为|害怕|不确定|不知道|不清楚|看不懂|分不清|不明白|会不会|是否/i;
    let send = false, choose = false;
    for (const part of Model.clauses(answer)) {
      if (/\b(?:not|never) (?:worried|concerned|afraid|confused)|\b(?:wasn['’]?t|isn['’]?t|weren['’]?t) (?:worried|concerned|afraid|confused)|(?:不担心|不怕|不是担心)/i.test(part)) continue;
      const afraidOfNotSending = /(?:won['’]?t|wouldn['’]?t|would not|won't|never|不会|不能|不敢|无法).{0,24}(?:send|email|share|notify|发|寄)/i.test(part);
      if (hesitation.test(part) && !afraidOfNotSending && target.test(part) && sending.test(part)) send = true;
      if ((hesitation.test(part) || /which|哪个/i.test(part)) && paths.test(part)) choose = true;
    }
    return send === choose ? null : send ? "sending" : "paths";
  }
  const words = s => (s.match(/[A-Za-z]+(?:[-’'][A-Za-z]+)*/g) || []).length;
  function hold(base, reason, source, sourceLabel) {
    const check = {id:"scope", label:"Team review", value:reason, status:"manual", source, sourceLabel};
    return {...base, blocked:true, manual:true, reason, checks:[check]};
  }
  function revisionIntent(note, branch) {
    if (!note || outsideScope(note)) return null;
    const key = note.trim().replace(/[.!]+$/, "").toLowerCase();
    const shortRequests = ["Make it shorter", "Shorten the copy", "Make the copy more concise",
      "Make the reassurance shorter while still saying opening the configurator does not send a quote to the customer",
      "Make the two explanations shorter while keeping standard templates and custom work from scratch clear"];
    if (shortRequests.some(text=>text.toLowerCase()===key)) return "shorter";
    const sendingRequests = [
      "Make it clearer that opening the configurator does not send anything to the customer",
      "Make it explicit that opening the configurator does not send a quote to the customer",
      "Explain that opening the configurator does not send a quote to the customer",
      "Explain that clicking only opens the configurator and does not send a quote to the customer",
    ];
    const pathsRequests = ["Make the distinction between standard and custom jobs clearer",
      "Make the distinction between standard templates and custom work from scratch clearer",
      "Explain which option is for a standard walk-in and which is for a custom layout"];
    if (branch === "sending" && sendingRequests.some(text=>text.toLowerCase()===key)) return "sending";
    if (branch === "paths" && pathsRequests.some(text=>text.toLowerCase()===key)) return "paths";
    return null;
  }
  function suggestChange(c) {
    const branch = interpret(c.answer || "");
    const copy = c.versions.at(-1)?.candidate || "";
    if (branch === "sending") return /Try sizes and options/i.test(copy)
      ? "Make the reassurance shorter while still saying opening the configurator does not send a quote to the customer."
      : "Make it explicit that opening the configurator does not send a quote to the customer.";
    if (branch === "paths") return /choose your own sizes and options/i.test(copy)
      ? "Make the two explanations shorter while keeping standard templates and custom work from scratch clear."
      : "Make the distinction between standard templates and custom work from scratch clearer.";
    return "";
  }
  // Authored simulation supports only a revision to the same two concerns.
  // Unknown requirements stay with the team instead of receiving invented copy.
  function revisionDraft(c) {
    const branch = interpret(c.answer || ""), intent = revisionIntent(c.adjustment, branch);
    if (!intent) return null;
    const previous = c.versions.at(-1)?.candidate || "";
    let copy;
    if (branch === "sending") {
      if (intent === "shorter") copy = "Configure a walk-in\nOpen the configurator. No quote is sent to the customer.";
      else copy = "Configure a walk-in\nTry sizes and options. Opening the configurator does not send a quote to your customer.";
    } else {
      copy = intent === "shorter"
        ? "Use a template\nStandard walk-in: use a preset.\n\nStart from scratch\nCustom walk-in: build your own layout."
        : "Use a template\nFor a standard walk-in, start with a preset layout.\n\nStart from scratch\nFor a custom walk-in, choose your own sizes and options.";
    }
    // A scripted edit must change the real candidate. Repeating a request that
    // this authored draft already meets is a team decision, not a new version.
    return copy.trim() !== previous.trim() ? copy : null;
  }
  function reviewPrompt(branch, copy, intent) {
    const blocks = copy.trim().split(/\n\s*\n/);
    if (branch === "paths") {
      const labels = blocks.map(block => block.split("\n")[0]).filter(Boolean);
      return (intent === "shorter" ? "Do the shorter explanations for “" : "Do “") + (labels[0] || "the first option") + "” and “" + (labels[1] || "the second option") +
        "” explain which fits a standard walk-in and which fits a custom layout?";
    }
    const label = copy.trim().split("\n")[0] || "this button";
    return (intent === "shorter" ? "Does the shorter explanation under “" : "Does the explanation under “") + label +
      "” make it clear that opening the configurator does not send a quote to the customer?";
  }
  function assessCopy(branch, copy, intent) {
    if (branch === "sending") {
      const noSend = /\b(?:nothing\s+is\s+(?:sent|shared|emailed)|no\s+quote\s+is\s+(?:sent|shared|emailed)|(?:does|do|will)\s+not\s+(?:send|email|share)|won['’]?t\s+(?:send|email|share)|not\s+(?:sent|shared|emailed))\b/i.test(copy);
      if (!/configur|draft/i.test(copy) || !noSend || !/customer|client/i.test(copy)) return "Explain that this opens a configurator or draft and does not send a quote to the customer.";
    } else if (!/standard/i.test(copy) || !/custom/i.test(copy) || !/template/i.test(copy) || !/scratch/i.test(copy)) {
      return "Keep both choices clear: a template for a standard walk-in, and scratch for a custom layout.";
    }
    return "";
  }
  function derive(c, q, answered, base) {
    const view = {...base, kind:"hesitation", proposal:null};
    if (outsideScope(c.text)) return hold(view, "This feedback includes another requirement. The website team needs to confirm its scope before proposing copy.", c.text, "Original feedback");
    if (!answered) return {...view, question:{type:q.type, text:q.prompt, source:q.source, options:q.options, reason:q.reason}, reason:q.reason};
    const branch = !outsideScope(c.answer) && interpret(c.answer);
    if (!branch) return hold(view, "The website team will review this answer before proposing copy or asking the reviewer to check it.", c.answer, "Requester’s answer");
    const {items} = proposals[branch];
    const candidate = items.map(({label, detail}) => label + "\n" + detail).join("\n\n");
    const edited = typeof c.candidateOverride === "string";
    const priorCopy = c.versions.at(-1)?.candidate;
    const copy = edited ? c.candidateOverride : (c.adjustment && priorCopy) || candidate;
    const showItems = copy === candidate;
    const intent = revisionIntent(c.adjustment, branch);
    const reviewQuestion = c.adjustment || edited ? reviewPrompt(branch, copy, intent) : proposals[branch].reviewQuestion;
    const check = {id:"hesitation-review", label:"Customer understanding", value:proposals[branch].reviewQuestion, status:"manual", source:c.answer, sourceLabel:"Requester’s answer", candidate:copy};
    Object.assign(view, {proposal:{branch, items:showItems ? items.map(item=>({...item})) : [], reviewQuestion, edited:!showItems},
      candidate:copy, wordCount:words(copy), checks:[check]});
    if (c.adjustment) {
      const sourceLabel = 'V' + (c.rev - 1) + ' revision request';
      if (outsideScope(c.adjustment)) return hold({...view, proposal:null}, "The website team needs to confirm the scope of this revision before sending it back for review.", c.adjustment, sourceLabel);
      // A freeform revision is new work for the website team, not permission to
      // deliver V1 again or claim that the simulated draft has satisfied it.
      const changed = edited && copy.trim() !== priorCopy?.trim();
      const shorter = intent !== "shorter" || words(copy) < words(priorCopy || "");
      const failure = changed && !shorter ? "The reviewer asked for shorter copy. Reduce the actual word count before delivering it." : "";
      view.checks.push({id:"revision", label:"Review the requested change", source:c.adjustment, sourceLabel, candidate:copy,
        status:changed && shorter ? "manual" : "fail", value:changed ? failure ||
          (intent ? (intent === "shorter" ? words(priorCopy || "") + " → " + words(copy) + " words. " : "") + reviewQuestion :
            "Does this candidate resolve the request “" + c.adjustment + "”?") : "Update the draft to address the reviewer’s request."});
      if (!changed) { view.blocked = true; view.reason = view.checks.at(-1).value; }
      if (failure) { view.blocked = true; view.reason = failure; }
    }
    const copyFailure = edited && assessCopy(branch, copy, intent);
    if (copyFailure) {
      view.blocked = true; view.reason = copyFailure;
      view.checks.push({id:"concern-coverage", label:"Preserve the customer’s concern", source:c.answer,
        sourceLabel:"Requester’s answer", candidate:copy, status:"fail", value:copyFailure});
    }
    if (!copy.trim()) {
      view.blocked = true;
      view.reason = "Add draft copy before sending it for review.";
      view.checks.push({id:"candidate", label:"Draft copy", value:view.reason, status:"fail", source:c.text, sourceLabel:"Original feedback"});
    }
    return view;
  }
  const api = {feedback, answers, question, derive, suggestChange, revisionDraft};
  root.FlowHesitation = api;
  if (common) module.exports = api;
})(globalThis);
