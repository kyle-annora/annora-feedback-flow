(function (root) {
  "use strict";
  const TEAM = "Website team",
    UNASSIGNED = "Unassigned",
    TARGET = "WinQuote production site (simulated)";
  const names = {
    client: "Reviewer",
    team: TEAM,
    publisher: "Site owner",
    combined: "Reviewer and site owner",
  };
  const insist = (ok, msg) => {
    if (!ok) throw new Error(msg);
  };
  const val = (s) => (typeof s === "string" ? s.trim() : "");
  const required = (s, msg) => {
    insist(val(s), msg);
    return s;
  };
  const stamp = () => new Date().toISOString();
  const snapshot = (x) => JSON.parse(JSON.stringify(x));
  // The simulator reads only the current record. Source excerpts stay verbatim.
  const isEntry = (s) =>
    /模板|template/i.test(s) &&
    /入口|报价|新建|从头|下一步|优先|首选|先用|from scratch|standard (?:quote|job|walk-in)|custom (?:quote|job|walk-in)|quote paths?|quote options?|two paths|templates? first/i.test(
      s,
    );
  const uncertain = (s) =>
    /还是|是否|要不要|不确定|待确认|不清楚|待定|尚未确定|不知道|not sure|unclear|whether|unsure|can[’']?t tell|don[’']?t know|which (?:one|option|path)|should (?:we|I)/i.test(
      s,
    );
  const direction = (s) => {
    if (uncertain(s)) return "";
    if (
      /并列|并行|同等|不分先后|同样重要|不要优先|不优先|平行|side[- ]by[- ]side|equally|equal prominence|(?:give|keep|treat|make) both.{0,24}equal/i.test(
        s,
      )
    )
      return "parallel";
    return /优先.{0,10}模板|模板.{0,6}优先|先用模板|首选模板|先.{0,3}推荐模板|prefer.{0,12}template|templates? first|recommend.{0,20}templates? for standard|(?:standard (?:quotes?|jobs?|walk-ins?).{0,20}(?:start|use|choose|prefer|recommend).{0,20}template)|use (?:a )?templates? for standard/i.test(
      s,
    )
      ? "first"
      : "";
  };
  const blockedReason =
    "This affects pricing rules. The website team needs to confirm which rules apply before preparing a candidate.";
  const policy = (s) =>
    /(?:报价|计价|定价|折扣|价格|税率).{0,12}(?:规则|逻辑|算法|计算)|(?:调整|修改|更改|自动|应用).{0,8}(?:税率|折扣|打.{0,3}折)|(?:打|享受)[一二两三四五六七八九十0-9.]{1,4}折|自动.{0,8}(?:计价|定价)|(?:automatically apply|calculat(?:e|ing)|chang(?:e|ing)|adjust|modify|updat(?:e|ing)|apply).{0,34}(?:discount|tax rate|pricing (?:rules?|logic)|prices?)|(?:pricing|discount|tax|quote calculation) (?:logic|rules?|formulas?)/i.test(
      maskQuoted(s),
    );
  function maskQuoted(raw) {
    return raw.replace(/「[^」]*」|“[^”]*”|"[^"]*"|‘[^’]*’|(?<![\w])'[^'\n]+'(?![\w])/g,
      quote => " ".repeat(quote.length));
  }
  // Preserve punctuation inside the requested label, including fragments used as evidence.
  function clauses(raw) {
    const outside = maskQuoted(raw);
    const boundaries = /[。！？；，、,;\n!?]+|\.(?=\s|$)|另外|此外|同时|顺便|还要|也要|并且|并(?=新增|增加|添加|支持|导出|跳转|移动|隐藏|显示|调整|把|将)|\b(?:also|additionally)\b|\s+and\s+(?=(?:also\s+)?(?:add|remove|omit|keep|retain|show|move|hide|export|upload|redirect|enable|style|translate|resize|change|send|download)\b)/gi;
    const parts = [];
    let start = 0;
    for (const boundary of outside.matchAll(boundaries)) {
      const part = raw.slice(start, boundary.index).trim();
      if (part) parts.push(part);
      start = boundary.index + boundary[0].length;
    }
    const tail = raw.slice(start).trim();
    if (tail) parts.push(tail);
    return parts;
  }
  const source = (text, label) => ({ text, label });
  const sourceRows = (text, label) =>
    clauses(text).map((x) => source(x, label));
  const labelQuotes = /^(?:「([^」]+)」|“([^”]+)”|"([^"]+)"|‘([^’]+)’|'(.+)')/u;
  const quotedLabel = s => s.match(labelQuotes)?.slice(1).find(Boolean);
  const visualChange = (s) =>
    /颜色|位置|字号|间距|尺寸|背景|样式|\b(?:color|position|size|spacing)\b/i.test(
      s,
    );
  function replacement(s, buttonContext = false) {
    const marker =
      /(?:改成|改为|换成|换为|替换成|替换为|改叫|命名为|写成)/.exec(s) ||
      (/\b(?:change|rename|relabel|set|switch)\b/i.test(s) && /\s+to\s+/i.exec(s)) ||
      /\b(?:read|say|label|call|name)\s+(?=[“"‘'])/i.exec(s) ||
      /\b(?:label|call|name)\s+(?:the\s+(?:homepage\s+)?button|it)\s+(?=[“"‘'])/i.exec(s);
    if (!marker) return "";
    const before = s.slice(0, marker.index),
      after = s.slice(marker.index + marker[0].length).trim();
    if (visualChange(before)) return "";
    if (
      !buttonContext &&
      !/按钮|CTA|button|(?:首页|把|将)\s*(?:的)?\s*[A-Za-z「“"]/i.test(before + marker[0])
    )
      return "";
    const quote = quotedLabel(after);
    if (quote) return val(quote);
    if (/^[「“"‘']/.test(after)) return "";
    return val(clauses(after)[0])
      .replace(/[.!?]$/, "")
      .trim();
  }
  const isButton = (s) =>
    /按钮|\bCTA\b|\bbutton\b/i.test(s) &&
    !visualChange(s) &&
    /文案|标签|字样|叫|写|命名|名称|改成|改为|换成|看不懂|用词|label|wording|button text|button (?:name|copy)|button.{0,20}(?:unclear|confusing|hard to understand)|(?:unclear|confusing).{0,20}button/i.test(
      s,
    );
  const detailsTerm = /客户(?:信息|资料)|customer (?:details|information|info)\b/i;
  const detailsRequest = (s) => {
    if (!detailsTerm.test(s)) return null;
    return !/(?:去掉|删除|移除|不(?:用|必|要|再|需|保留)|remove|omit|drop|delete|without|skip|leave out|(?:don['’]t|do not|never) (?:include|mention|retain|add|keep)|no longer (?:mention|include)).{0,55}(?:客户|customer)/i.test(
      s,
    );
  };
  const wordLimit = (s) => {
    const hit = s.match(
      /(\d{1,4})\s*(?:个)?\s*(?:(?:英文?|English)\s*)?(?:单词|词|words?)\s*(?:以内|以下|为限|最多)?/i,
    );
    return hit &&
      /最多|上限|至多|不(?:要)?超过|不多于|控制在|以内|以下|缩短到|缩到|限制在|at most|no more than|or (?:less|fewer)|maximum|max\b|up to|limit|cap(?:ped)?|(?:keep|cut|trim|reduce|shorten).{0,35}(?:to|under|within)|under|within|no longer than|fewer than/i.test(
        s,
      )
      ? Math.max(0, Number(hit[1]) - (/\b(?:under|fewer than)\s+\d+/i.test(s) ? 1 : 0))
      : null;
  };
  const isEntryConstraint = s => wordLimit(s) !== null || detailsRequest(s) !== null ||
    /(?:keep|retain|preserve).{0,25}(?:quote paths?|options?|distinction)|保留(?:入口区别|两个入口)/i.test(s);
  const wordCount = (s) =>
    (s.match(/[A-Za-z]+(?:[-’'][A-Za-z]+)*/g) || []).length;
  function suggest(raw) {
    raw = val(raw);
    const rows = sourceRows(raw, "Original feedback");
    const rule = policy(raw);
    const exact = replacement(raw);
    const kind = rule
      ? "policy"
      : exact || isButton(raw)
        ? "button"
        : isEntry(raw)
          ? "entry"
          : "manual";
    const entryDirection = rows
      .map((row) => direction(row.text))
      .filter(Boolean)
      .at(-1);
    const details = rows
      .map((row) => detailsRequest(row.text))
      .filter((value) => value !== null)
      .at(-1);
    let goal = raw,
      question = null,
      next = "The website team confirms the scope and prepares a candidate.";
    if (kind === "policy") {
      next = "The website team checks the pricing rules.";
    } else if (kind === "button") {
      if (exact) {
        goal = "Change the homepage button label to “" + exact + "”";
        next = "The website team checks the button location and wording.";
      } else {
        const target = (rows.find((row) => isButton(row.text)) || { text: raw })
          .text;
        question = {
          prompt: "What should the homepage button say?",
          options: [],
          source: target,
          reason: "Your answer becomes the button label. You can also ask the website team to suggest one.",
        };
      }
    } else if (kind === "entry") {
      goal =
        (entryDirection === "first"
          ? "Recommend templates first for standard quotes"
          : entryDirection === "parallel"
            ? "Show the template and from-scratch paths side by side"
            : "Help new employees choose the right quote path") +
        (details ? " and explain that customer details come next" : "");
      if (!entryDirection) {
        question = {
          prompt: "Should the homepage recommend templates first or show both quote paths side by side?",
          options: ["Recommend templates first for standard quotes", "Show both paths side by side"],
          source: (rows.find((row) => /模板|template/i.test(row.text)) || { text: raw })
            .text,
          reason: "This determines how the first line introduces the two quote paths.",
        };
      }
    }
    if (question) next = "The website team asks for clarification.";
    return {
      goal,
      kind,
      question,
      next,
      needsQuestion: !!question,
      blocked: rule ? blockedReason : "",
    };
  }
  function questionDraft(r) {
    return r.needsQuestion
      ? suggest(
          r.goalSource === "client" && suggest(r.goal).question
            ? r.goal
            : r.raw,
        ).question
      : null;
  }
  function create(id, input) {
    required(id, "A feedback ID is required.");
    const raw = required(input.raw, "Enter your feedback first."),
      s = suggest(raw);
    const corrected = val(input.goal);
    const goal = corrected || s.goal;
    let goalSource = input.goalSource;
    if (!["client", "raw", "ai"].includes(goalSource)) {
      if (goal === raw || goal === raw.trim()) goalSource = "raw";
      else goalSource = goal === s.goal ? "ai" : "client";
    }
    const explicitCorrection =
      goalSource === "client" &&
      (s.kind === "entry"
        ? !!direction(corrected)
        : s.kind === "button" && !!replacement(corrected));
    const r = {
      id,
      rev: 1,
      title:
        val(input.title) ||
        {
          button: "Homepage button label",
          entry: "Homepage quote guidance",
          policy: "Pricing rule review",
        }[s.kind] ||
        raw.trim().slice(0, 36),
      raw,
      goal,
      goalSource,
      location: input.location || "",
      attachment: input.attachment || null,
      linkedTo: input.linkedTo || null,
      stage: "working",
      owner: UNASSIGNED,
      needsQuestion: !!(s.needsQuestion && !explicitCorrection),
      blocked: s.blocked,
      question: null,
      answer: null,
      rounds: [],
      adjustments: [],
      events: [],
      acceptedRound: null,
      acceptance: null,
      release: {
        target: TARGET,
        authorization: null,
        receipt: null,
        attempts: [],
      },
      decisions: [],
    };
    r.events.push({
      text: "Feedback submitted to the website team.",
      actor: Object.hasOwn(names, input.submittedBy)
        ? names[input.submittedBy]
        : names.client,
      at: stamp(),
    });
    return snapshot(r);
  }
  function requirements(r) {
    const intake = suggest(r.raw);
    const rows = sourceRows(r.raw, "Original feedback");
    if (r.goalSource === "client") rows.push(...sourceRows(r.goal, "Requester correction"));
    if (r.answer) {
      rows.push(
        ...sourceRows(r.answer.choice, "Requester’s answer"),
        ...sourceRows(r.answer.note, "Answer details"),
      );
    }
    for (const adjustment of r.adjustments) {
      rows.push(
        ...sourceRows(adjustment.note, "V" + adjustment.round + " revision request"),
      );
    }

    let kind = intake.kind,
      target = null,
      priority = null,
      details = null,
      limit = null;
    for (const row of rows) {
      const choice = direction(row.text),
        cap = wordLimit(row.text),
        keep = detailsRequest(row.text);
      if (choice) priority = { ...row, value: choice };
      if (cap !== null) limit = { ...row, value: cap };
      if (keep !== null) details = { ...row, value: keep };
    }
    // An exact label may contain punctuation inside quotes; extract it from the whole input.
    const revisions = r.adjustments.map((a) =>
      source(a.note, "V" + a.round + " revision request"),
    );
    const fullTexts = [source(r.raw, "Original feedback")];
    if (r.goalSource === "client") fullTexts.push(source(r.goal, "Requester correction"));
    if (r.answer && r.answer.note)
      fullTexts.push(source(r.answer.note, "Answer details"));
    fullTexts.push(...revisions);
    for (const row of fullTexts) {
      const copy = replacement(row.text, kind === "button");
      if (copy) {
        kind = "button";
        target = { ...row, value: copy };
      }
    }
    if (
      intake.kind === "button" &&
      !target &&
      r.answer?.choice === "Other wording" &&
      r.answer.note
    ) {
      const answer = val(r.answer.note);
      const quoted = quotedLabel(answer);
      target = {
        ...source(answer, "Requester’s answer"),
        value: quoted || answer,
      };
    }
    const original = source(r.raw, "Original feedback");
    return {
      kind,
      target,
      priority,
      details,
      limit,
      original,
      last: revisions.at(-1),
    };
  }

  function assess(r, input) {
    const req = requirements(r),
      text = val(input),
      evidence = [];
    const add = (id, label, ref, status, result) =>
      evidence.push({
        id, label,
        ...(id === "entry-priority" ? {direction:req.priority?.value || null} : {}),
        ...(id === "customer-details" ? {keepDetails:req.details.value} : {}),
        ...(id === "word-limit" ? {limit:req.limit.value} : {}),
        sourceLabel: ref.label,
        source: ref.text,
        status,
        result,
      });
    if (req.kind === "button" && req.target) {
      const match = text === req.target.value;
      add(
        "button-label", "Button label: “" + req.target.value + "”",
        req.target,
        match ? "met" : "missing",
        match
          ? "The candidate matches the requested label."
          : "The candidate does not match the requested label.",
      );
    }
    if (req.kind === "entry") {
      const choice = req.priority?.value;
      const label =
        choice === "parallel"
          ? "Show both quote paths side by side"
          : choice === "first"
            ? "Recommend templates for standard quotes and start custom quotes from scratch"
            : "Make the two quote paths clear to new employees";
      // A keyword match cannot decide whether the explanation is understandable.
      const entryLines = text
        .split(/(?<=[.!?])\s+/)
        .filter(
          (line) =>
            /template|scratch|standard|custom/i.test(line) &&
            !detailsTerm.test(line),
        );
      add(
        "entry-priority", label,
        req.priority || req.original,
        "manual",
        entryLines.length
          ? "Check the order and purpose of the two paths: “" + entryLines.join(" ") + "”"
          : "Check whether the candidate explains both quote paths.",
      );
    }
    if (req.kind !== "button" && req.details) {
      const ref = req.details;
      const sentence = text
        .split(/(?<=[.!?。！？])\s*/)
        .find((line) => detailsTerm.test(line));
      const next = sentence && /next|下一步/i.test(sentence);
      const positive =
        next &&
        !/\b(?:no|not|never|don't|without)\b|无需|不用|不要/.test(
          sentence.toLowerCase(),
        );
      const met = ref.value ? positive : !sentence;
      const explicit = /保留|下一步|移除|删除|去掉|\b(?:keep|retain|next|add|remove|omit|include|drop|without)\b/i.test(ref.text);
      const state = met ? "met" : explicit ? "missing" : "manual";
      add(
        "customer-details", ref.value ? "Explain that customer details come next" : "Remove the customer details reminder",
        ref,
        state,
        sentence
          ? "Candidate excerpt: “" + sentence.trim() + "”"
          : ref.value
            ? "The candidate does not say that customer details come next."
            : "The candidate omits the customer details reminder.",
      );
    }
    if (req.limit) {
      const cap = req.limit.value,
        words = wordCount(text);
      add(
        "word-limit", "At most " + cap + " English words",
        req.limit,
        words > 0 && words <= cap ? "met" : "missing",
        "Measured " + words + " words against a limit of " + cap + " words.",
      );
    }
    const adjustedRound = r.adjustments.at(-1)?.round;
    const previous = r.rounds.find((rd) => rd.n === adjustedRound);
    if (previous && req.last && shortening(req.last.text)) {
      const before = wordCount(previous.text),
        after = wordCount(text);
      const measured = before > 0 && after > 0;
      add(
        "shorter", "Shorter than V" + previous.n,
        req.last,
        measured ? (after < before ? "met" : "missing") : "manual",
        measured
          ? "V" +
              previous.n +
              " had " +
              before +
              " words. This version has " +
              after +
              " words."
          : "Compare the length with the previous candidate.",
      );
    }
    if (
      req.last &&
      !evidence.some((row) => row.sourceLabel === req.last.label)
    ) {
      add(
        "revision", "Address the revision request",
        req.last,
        "manual",
        "The team and reviewer should compare this version with the revision request.",
      );
    }
    if (!evidence.length) {
      add(
        "scope", "Confirm the scope",
        req.original,
        "manual",
        "The website team checks the candidate against the original feedback. The reviewer decides whether to accept it.",
      );
    }
    return evidence;
  }

  const shortening = (s) =>
    /缩短|精简|简短|短一点|短一些|少一些|更短|shorten|shorter|more concise/i.test(
      s,
    );
  function unsupportedNote(s) {
    return clauses(s).some(
      (piece) =>
        !replacement(piece) &&
        !shortening(piece) &&
        !direction(piece) &&
        wordLimit(piece) === null &&
        detailsRequest(piece) === null &&
        !/保留(?:两种入口|入口区别|下一步提示)|(?:keep|retain|preserve|show).{0,20}(?:paths?|options?|distinction).{0,12}(?:clear|distinct|side by side)?/i.test(piece),
    );
  }

  function entryCopy(parallel, concise, details, limit) {
    const usual = parallel
      ? "Choose either path: use a template for a standard quote, or start from scratch for a custom quote."
      : "For a standard walk-in, start with a template. For a custom walk-in, start from scratch.";
    const short = parallel
      ? "Template: standard quote. From scratch: custom quote."
      : "Standard quote? Start with a template. Custom quote? Start from scratch.";
    const brief = parallel
      ? "Template: standard. From scratch: custom."
      : "Standard: template. Custom: from scratch.";
    const variants = [
      usual + (details ? " Add customer details in the next step." : ""),
      short + (details ? " Add customer details next." : ""),
      brief + (details ? " Add customer details next." : ""),
    ];
    if (limit !== null) {
      return (
        variants.find((v, i) => (!concise || i > 0) && wordCount(v) <= limit) ||
        variants[2]
      );
    }
    return variants[concise ? 1 : 0];
  }

  // When a team member has edited the actual delivered copy, revise that version.
  // Limit the local simulation to conservative substitutions; it cannot paraphrase arbitrary prose.
  function revisedEntryCopy(previous, req, proposed, concise) {
    if (!previous) return proposed;
    for (const parallel of [true, false]) {
      for (const details of [true, false]) {
        const known = [
          entryCopy(parallel, false, details, null),
          entryCopy(parallel, true, details, null),
          entryCopy(parallel, true, details, 1),
        ];
        if (known.includes(previous.text)) return proposed;
      }
    }
    let copy = previous.text;
    if (concise || req.limit) {
      copy = copy
        .replace(/in the next step/gi, "next")
        .replace(
          /For a standard (quote|walk-in), start with a template\b/gi,
          "Standard quote? Use a template",
        )
        .replace(
          /For a custom (quote|walk-in), start from scratch\b/gi,
          "Custom quote? Start from scratch",
        );
    }
    if (req.details?.value && !detailsTerm.test(copy))
      copy += " Add customer details next.";
    if (req.details?.value === false) {
      copy = copy
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => !detailsTerm.test(sentence))
        .join(" ");
    }
    return copy;
  }

  function draft(r) {
    const req = requirements(r),
      prev = r.rounds.at(-1),
      adj = req.last,
      answer = r.answer;
    const blank = {
      kind: req.kind,
      text: "",
      summary: "",
      checks: assess(r, "").map((e) => e.label),
    };
    if (
      r.blocked ||
      r.needsQuestion ||
      (prev && r.adjustments.at(-1)?.round !== prev.n)
    )
      return blank;
    if (answer?.choice === "Ask the team") return blank;
    if (
      r.goalSource === "client" &&
      r.goal !== suggest(r.raw).goal &&
      !direction(r.goal) &&
      !replacement(r.goal) &&
      r.goal !== r.raw
    )
      return blank;
    if (req.kind === "button" && req.target) {
      if (adj && unsupportedNote(adj.text) && !replacement(adj.text, true))
        return blank;
      return {
        ...blank,
        text: req.target.value,
        summary: "Follow " + req.target.label + " for the requested button wording.",
      };
    }
    if (req.kind !== "entry" || !req.priority) return blank;
    if (answer?.note && unsupportedNote(answer.note)) return blank;
    if (adj && unsupportedNote(adj.text)) return blank;
    const concise = !!adj && (shortening(adj.text) || !!req.limit);
    const parallel = req.priority.value === "parallel";
    const proposed = entryCopy(
      parallel,
      concise,
      !!req.details?.value,
      req.limit?.value ?? null,
    );
    const text = revisedEntryCopy(prev, req, proposed, concise);
    const summary =
      [
        adj ? "Update the copy using the V" + r.adjustments.at(-1).round + " revision request" : "",
        parallel ? "Show both quote paths side by side" : "Recommend templates first for standard quotes",
        req.details?.value ? "Keep the reminder to add customer details next" : "",
        req.limit ? "Current length: " + wordCount(text) + " English words" : "",
      ]
        .filter(Boolean)
        .join(", ") + ".";
    return { ...blank, text, summary };
  }

  function adjustmentSuggestion(r) {
    const req = requirements(r);
    if (req.kind === "button" && req.target) {
      const current = req.target.value;
      if (/^start (?:a |your )?quote$/i.test(current)) {
        return "Change the button label from “" + current + "” to “New quote”.";
      }
      return "";
    }
    if (req.kind === "entry") {
      const fragments = [
        "Shorten the copy",
        req.priority?.value === "parallel"
          ? "keep both quote paths side by side"
          : "keep the two quote paths distinct",
      ];
      if (req.details?.value) fragments.push("Keep the reminder to add customer details next");
      if (req.limit)
        fragments.push("use no more than " + req.limit.value + " English words");
      return fragments.join(", ");
    }
    return "";
  }

  function adjustmentPreview(r, note) {
    const simulated = {
      ...r,
      stage: "working",
      adjustments: [
        ...r.adjustments,
        { round: r.rounds.length, note: val(note) },
      ],
    };
    const candidate = draft(simulated);
    return { ...candidate, evidence: assess(simulated, candidate.text) };
  }
  function describe(r, role) {
    const reviewer = role === "client" || role === "combined",
      pub = role === "publisher" || role === "combined",
      n = r.rounds.length,
      team = role === "team";
    let v;
    switch (r.stage) {
      case "working": {
        let status = "In progress",
          action;
        if (r.blocked) {
          status = "Blocked";
          action = "resolve the blocker and record how work can resume";
        } else if (r.owner === UNASSIGNED) {
          status = "Waiting for the website team";
          action = "pick up this feedback";
        } else if (r.needsQuestion) {
          action = "ask the requester which direction to take";
        } else if (n && r.adjustments.at(-1)?.round === n) {
          status = "V" + n + " revision requested";
          action = "use the V" + n + " feedback to prepare V" + (n + 1);
        } else {
          if (!n && r.answer) status = "Answer received";
          action = "prepare candidate V" + (n + 1);
        }
        const next = team
          ? "Please " + action + "."
          : "Waiting for the website team to " + action + ".";
        v = [status, next, TEAM, "working"];
        break;
      }
      case "needs_info":
        v = [
          "Awaiting clarification",
          reviewer
            ? "Answer the question so the website team can continue."
            : "Waiting for the requester to answer.",
          "Reviewer",
          reviewer ? "needs_info" : "working",
        ];
        break;
      case "review":
        v = [
          "V" + n + " ready for review",
          reviewer
            ? "Review this version, then accept it or request changes."
            : "Waiting for the reviewer to check this version.",
          "Reviewer",
          reviewer ? "review" : "working",
        ];
        break;
      case "accepted":
        v = [
          "V" + n + " accepted",
          pub ? "Check the target and authorize this version for release." : "Waiting for the site owner to authorize the release.",
          "Site owner",
          "working",
        ];
        break;
      case "authorized":
        v = [
          "V" + n + " authorized for release",
          "The website team can start the simulated release.",
          TEAM,
          "working",
        ];
        break;
      case "publishing":
        v = [
          "V" + n + " publishing (simulated)",
          team ? "Record the outcome of the simulated release." : "Waiting for the simulated release result.",
          TEAM,
          "working",
        ];
        break;
      case "failed":
        v = [
          "V" + n + " release failed",
          "The website team can investigate and retry the same target.",
          TEAM,
          "working",
        ];
        break;
      case "published":
        v = [
          "V" + n + " published (simulated)",
          "The simulated release is complete. The receipt is ready.",
          "Complete",
          "done",
        ];
        break;
    }
    return {
      status: v[0],
      owner: r.owner,
      next: v[1],
      waiting: v[2],
      group: v[3],
    };
  }
  function change(record, role, action, payload, expectedRev) {
    insist(record.rev === expectedRev, "This record has changed. Review the current task and try again.");
    insist(Object.hasOwn(names, role), "This role cannot act on this record.");
    const r = snapshot(record),
      p = payload || {},
      t = stamp(),
      n = r.rounds.length,
      actor = names[role];
    const roleIs = (...roles) =>
      insist(roles.includes(role), "This role cannot perform that action.");
    const stage = (...ss) =>
      insist(ss.includes(r.stage), "That action is unavailable at the current stage.");
    const team = () => roleIs("team"),
      client = () => roleIs("client", "combined");
    const round = () =>
      insist(n > 0 && p.round === n, "This version is out of date. Open the current task.");
    const note = () => required(p.note, "Enter a note.");
    const claim = () => {
      r.owner = TEAM;
    };
    let msg;
    switch (action) {
      case "take":
        team();
        stage("working");
        insist(r.owner === UNASSIGNED, "The website team has already picked this up.");
        claim();
        msg = "The website team picked up this feedback.";
        break;
      case "ask":
        team();
        stage("working");
        required(p.prompt, "Enter a question.");
        insist(
          Array.isArray(p.options) &&
            p.options.every((x) => val(x)) &&
            new Set(p.options).size === p.options.length,
          "The answer options are invalid.",
        );
        claim();
        const generated = questionDraft(r);
        r.question = {
          prompt: p.prompt,
          options: [...new Set([...p.options, "Other wording", "Ask the team"])],
          ...(p.prompt === generated?.prompt
            ? { source: generated.source, reason: generated.reason }
            : {}),
        };
        r.answer = null;
        r.stage = "needs_info";
        r.needsQuestion = true;
        msg = "The website team asked: " + p.prompt;
        break;
      case "answer": {
        client();
        stage("needs_info");
        const choice = val(p.choice),
          options = r.question.options;
        insist(
          options.length ? options.includes(choice) : !!(choice || val(p.note)),
          "Enter an answer or choose a valid option.",
        );
        if (choice === "Other wording") note();
        r.answer = { choice, note: p.note || "" };
        r.stage = "working";
        r.needsQuestion = false;
        msg =
          "The requester answered: " +
          [choice, p.note].filter(Boolean).join(".") +
          (choice === "Ask the team" ? ". The website team will suggest an answer and explain its reasoning." : "");
        break;
      }
      case "progress":
        team();
        stage("working");
        claim();
        msg = "Team update: " + note();
        break;
      case "block":
        team();
        stage("working");
        claim();
        r.blocked = note();
        msg = "Blocked: " + r.blocked;
        break;
      case "resume":
        team();
        stage("working");
        insist(r.blocked, "There is no blocker to clear.");
        claim();
        msg = "Work resumed: " + note();
        r.blocked = "";
        break;
      case "deliver": {
        team();
        stage("working");
        insist(!r.blocked, "Record how the blocker was resolved before delivery.");
        insist(!r.needsQuestion, "Ask the requester for the missing information before delivery.");
        required(p.text, "Enter the candidate copy.");
        required(p.summary, "Describe what changed in this version.");
        insist(
          Array.isArray(p.checks) &&
            p.checks.length &&
            p.checks.every((x) => val(x)),
          "Add the review criteria.",
        );
        const evidence = assess(r, p.text);
        const unresolved = evidence.find((item) => item.status === "missing");
        insist(
          !unresolved,
          unresolved
            ? "First address “" + unresolved.label + "”. " + unresolved.result
            : "",
        );
        claim();
        r.rounds.push({
          n: n + 1,
          text: p.text,
          summary: p.summary,
          checks: [...p.checks],
          kind: requirements(r).kind,
          evidence,
        });
        r.stage = "review";
        r.needsQuestion = false;
        msg = "The website team delivered V" + (n + 1) + ".";
        break;
      }
      case "adjust":
        client();
        stage("review");
        round();
        r.adjustments.push({ round: n, note: note() });
        if (policy(p.note)) r.blocked = blockedReason;
        r.stage = "working";
        msg = "V" + n + " changes requested: " + p.note;
        break;
      case "accept":
        client();
        stage("review");
        round();
        r.acceptedRound = n;
        r.stage = "accepted";
        r.acceptance = { round: n, actor, at: t };
        r.decisions.push({ kind: "accept", ...r.acceptance });
        msg = "V" + n + " accepted.";
        break;
      case "authorize":
        roleIs("publisher", "combined");
        stage("accepted");
        round();
        insist(
          n === r.acceptedRound && p.target === r.release.target,
          "The accepted version or release target has changed.",
        );
        r.release.authorization = { round: n, target: p.target, actor, at: t };
        r.decisions.push({ kind: "authorize", ...r.release.authorization });
        r.stage = "authorized";
        msg = "Authorized V" + n + " for release to " + p.target + ".";
        break;
      case "start":
        team();
        stage("authorized", "failed");
        insist(
          r.release.authorization?.round === r.acceptedRound &&
            r.acceptedRound === n &&
            r.release.authorization?.target === r.release.target,
          "The release authorization is no longer valid.",
        );
        r.release.attempts.push({
          round: n,
          target: r.release.target,
          at: t,
          actor,
          result: "publishing",
        });
        r.release.receipt = null;
        r.stage = "publishing";
        msg = "V" + n + " started a simulated release to " + r.release.target + ".";
        break;
      case "fail":
      case "success": {
        team();
        stage("publishing");
        const ok = action === "success";
        const a = r.release.attempts[r.release.attempts.length - 1];
        Object.assign(a, {
          result: ok ? "success" : "failed",
          completedAt: t,
          note: ok ? "" : note(),
        });
        r.release.receipt = { ...a };
        r.stage = ok ? "published" : "failed";
        msg =
          "V" +
          n +
          " simulated release " +
          (ok ? "succeeded" : "failed: " + a.note) +
          " (" +
          a.target +
          ").";
        break;
      }
      case "reopen":
        team();
        stage("accepted", "authorized", "failed");
        msg = "Work reopened. Previous decisions are preserved: " + note();
        r.stage = "working";
        r.acceptedRound = null;
        r.acceptance = null;
        r.release.authorization = null;
        r.release.receipt = null;
        break;
      case "retarget":
        team();
        stage("accepted", "authorized", "failed");
        required(p.target, "Enter the new target.");
        insist(p.target !== r.release.target, "The target has not changed.");
        msg =
          "Release target changed from " +
          r.release.target +
          " to " +
          p.target +
          ". New authorization is required.";
        r.release.target = p.target;
        r.release.authorization = null;
        r.release.receipt = null;
        r.stage = "accepted";
        break;
      case "comment":
        msg = "Note: " + note();
        break;
      default:
        throw new Error("Unknown action.");
    }
    r.rev++;
    r.events.push({ text: msg, actor, at: t });
    return r;
  }
  const api = {
    create,
    suggest,
    draft,
    assess,
    clauses,
    isEntryConstraint,
    questionDraft,
    adjustmentPreview,
    adjustmentSuggestion,
    describe,
    change,
  };
  root.FlowModel = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis);
