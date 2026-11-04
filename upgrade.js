/* Old workspaces used translated display strings as identifiers. Keep the records,
   rounds, decisions, and exact user writing when opening them in the English app. */
(function (root) {
  'use strict';
  const roles = {
    '反馈提交人': 'Requester', '网站团队': 'Website team', '指定验收人': 'Reviewer',
    '站点负责人': 'Site owner', '已完成': 'Complete'
  };
  const samples = new Map([
    ['把 WinQuote 首页的「Create」按钮改成「Start a quote」。','Change the WinQuote homepage button label from “Create” to “Start a quote”.'],
    ['新员工看不懂首页报价按钮的用词。','New employees find the homepage quote button label confusing.'],
    ['修改首页的报价折扣规则，让内部人员可以改价格。','Change the homepage discount rules so staff can edit quote prices.'],
    ['我在 WinQuote 首页看不懂「Create」按钮的用词，希望改一下。','The "Create" button label on the WinQuote homepage is unclear.']
  ]);
  const cannedNotes = new Map([
    ['请缩短到 10 个英文词以内，保留入口区别。','Shorten the copy to no more than 10 words and keep both quote paths clear.'],
    ['保留下一步填写客户信息的提示。','Keep the reminder to add customer details next.'],
    ['去掉下一步填写客户信息的提示。','Remove the reminder to add customer details next.']
  ]);
  const answerOptions = {
    '标准报价优先推荐模板':'Recommend templates first for standard quotes',
    '两个入口并列介绍':'Show both paths side by side',
    '请团队建议':'Ask the team'
  };
  const legacyDefault = /^标准报价优先推荐模板，定制报价从头新建。保留下一步填写客户信息的提示。首页文案不超过 (\d+) 个英文词。$/;
  function sourceText(text) {
    const match = legacyDefault.exec(text);
    return match ? root.CaseEngine.initialFeedback.replace('18', match[1]) : samples.get(text) ?? text;
  }
  function noteText(text) {
    if (cannedNotes.has(text)) return cannedNotes.get(text);
    const label = /^(?:请把按钮文字改为|把按钮文字改成)「(Build my quote|Start a quote)」。$/.exec(text);
    return label ? 'Change the button label to "' + label[1] + '".' : text;
  }

  const sourceLabels = {'客户原话':'Original feedback','反馈原话':'Original feedback','客户修正':'Requester correction','客户回答':'Requester’s answer','回答补充':'Answer details'};
  const frozenRows = [
    [/^按钮显示「([\s\S]+)」$/, 'button-label', m=>'Button label: “'+m[1]+'”'],
    [/^标准报价优先推荐模板，定制报价从头新建$/, 'entry-priority', ()=>'Standard quotes start with a template'],
    [/^并列说明模板与从头新建$/, 'entry-priority', ()=>'Show both quote paths side by side'],
    [/^新员工能分清两个报价入口$/, 'entry-priority', ()=>'Distinguish the two quote paths'],
    [/^说明客户信息在下一步填写$/, 'customer-details', ()=>'Add customer details next'],
    [/^移除客户信息提示$/, 'customer-details', ()=>'Remove the customer details reminder'],
    [/^不超过 (\d+) 个英文词$/, 'word-limit', m=>'No more than '+m[1]+' words'],
    [/^比 V(\d+) 更简短$/, 'shorter', m=>'Shorter than V'+m[1]],
    [/^回应本轮调整$/, 'revision', ()=>'Address the revision request'],
    [/^核对反馈范围$|^团队核实反馈范围$/, 'scope', ()=>'Confirm the scope'],
    [/^候选文案$/, 'candidate', ()=>'Candidate copy']
  ];
  const frozenValues = new Map([
    ['候选用词与指定文字一致。','The candidate matches the requested label.'],
    ['请核对按钮文字，当前候选与指定文字不一致。','The candidate does not match the requested label.'],
    ['请人工核对候选是否说明了两个入口。','Check that the candidate explains both quote paths.'],
    ['候选中未找到下一步填写客户信息的说明。','The candidate does not say when to add customer details.'],
    ['候选不含客户信息提示。','The candidate omits the customer details reminder.'],
    ['请对照上轮候选复核长度。','Compare the length with the previous version.'],
    ['请团队与验收人对照本轮原话判断。','Compare the candidate with the revision request.'],
    ['由网站团队核对原话和候选，交付后由客户决定。','The website team checks the candidate against the feedback. The reviewer decides whether to accept it.']
  ]);
  function checkValue(value) {
    if (frozenValues.has(value)) return frozenValues.get(value);
    return value.replace(/^实测 (\d+) 词，上限 (\d+) 词。$/, '$1 words with a limit of $2.')
      .replace(/^V(\d+) 为 (\d+) 词，本轮为 (\d+) 词。$/, 'V$1 had $2 words. This version has $3.')
      .replace(/^请核对入口顺序与用途：/, 'Check the order and purpose of the quote paths: ')
      .replace(/^候选片段：/, 'Candidate excerpt: ');
  }
  // Only translate excerpts of known example input. Free-form sources are evidence.
  function sourceExcerpt(source, snapshot, demoNote) {
    if (source === snapshot.source) return sourceText(source);
    if (source === snapshot.adjustment) return demoNote ? noteText(source) : source;
    if (source === snapshot.answer) return answerOptions[source] ?? source;
    if (legacyDefault.test(snapshot.source)) {
      if (source === '标准报价优先推荐模板') return 'Recommend templates first for standard quotes';
      if (source === '保留下一步填写客户信息的提示') return 'Keep the reminder to add customer details next';
      if (/^首页文案不超过 \d+ 个英文词$/.test(source)) return 'Use no more than '+source.match(/\d+/)[0]+' words';
    }
    if (demoNote && cannedNotes.has(snapshot.adjustment) && source === '请缩短到 10 个英文词以内') return 'Shorten the copy to no more than 10 words';
    if (samples.has(snapshot.source) && snapshot.source.replace(/[。.]$/, '') === source) return sourceText(snapshot.source);
    return source;
  }
  function frozenCheck(row, snapshot, demoNote) {
    const result = {...row, source:sourceExcerpt(row.source, snapshot, demoNote),
      sourceLabel:sourceLabels[row.sourceLabel] ?? row.sourceLabel.replace(/^第 (\d+) 轮调整$/, 'V$1 revision request'),
      value:checkValue(row.value)};
    for (const [pattern, id, label] of frozenRows) {
      const match = pattern.exec(row.label);
      if (!match) continue;
      Object.assign(result, {id, label:label(match)});
      if (id === 'word-limit') result.limit = Number(match[1]);
      if (id === 'entry-priority') result.direction = row.label.startsWith('标准') ? 'first' : row.label.startsWith('并列') ? 'parallel' : null;
      if (id === 'customer-details') result.keepDetails = row.label.startsWith('说明');
      break;
    }
    return result;
  }
  function version(snapshot, demoNote) {
    const checks = snapshot.checks.map(row => frozenCheck(row, snapshot, demoNote));
    return {...snapshot, source:sourceText(snapshot.source), answer:answerOptions[snapshot.answer] ?? snapshot.answer,
      adjustment:demoNote ? noteText(snapshot.adjustment) : snapshot.adjustment, checks, view:{...snapshot.view, checks}};
  }
  function eventText(event, scripted) {
    const {text,rev}=event;
    switch (event.action) {
      case 'submit': return text.includes('补充') ? 'Feedback submitted. A clarification is needed.' : 'Feedback submitted to the website team.';
      case 'answer': {
        const answer=text.replace(/^回答问题：/, '');
        return 'Answered: '+(answerOptions[answer] ?? answer);
      }
      case 'deliver': return 'Sent V'+rev+' to the reviewer.';
      case 'adjust': {
        const match=/^V(\d+) 要求调整：([\s\S]*)$/.exec(text);
        return match ? 'Requested changes to V'+match[1]+': '+(scripted || event.simulated ? noteText(match[2]) : match[2]) : text;
      }
      case 'reviseAdjustment': return 'Updated the revision request for V'+rev+': '+text.replace(/^修正 V\d+ 的调整意见：/, '');
      case 'accept': return 'Accepted V'+rev+'. Site owner approval is pending.';
      case 'authorize': return 'Approved the simulated release of V'+rev+' to the WinQuote homepage.';
      case 'publish': return 'Simulated publication of V'+rev+' completed. The receipt is ready.';
      default:return text;
    }
  }
  function decision(value) {
    if (!value) return value;
    const copy={...value};
    if ('actor' in copy) copy.actor=roles[copy.actor] ?? copy.actor;
    if (copy.target==='WinQuote 首页') copy.target='WinQuote homepage';
    return copy;
  }
  function upgradeCase(record, scripted=false) {
    if (!roles[record.owner]) return record;
    const text=sourceText(record.text);
    const demoNote = rev => {
      const change = record.trail.findLast(e=>e.rev===rev && ['adjust','reviseAdjustment'].includes(e.action));
      return scripted || change?.simulated === true;
    };
    const question=record.answerKey && root.FlowModel.suggest(text).question;
    return {...record, text, owner:roles[record.owner], answer:answerOptions[record.answer] ?? record.answer,
      answerKey:question ? JSON.stringify([question.prompt,question.source,question.options]) : '',
      adjustment:demoNote(record.rev) ? noteText(record.adjustment) : record.adjustment,
      adjustments:record.adjustments.map(a=>({...a,text:demoNote(a.rev+1) ? noteText(a.text) : a.text})),
      versions:record.versions.map(v=>version(v, demoNote(v.rev))),
      trail:record.trail.map(e=>({...e,actor:roles[e.actor] ?? e.actor,text:eventText(e, scripted)})),
      accepted:decision(record.accepted),authorization:decision(record.authorization),receipt:decision(record.receipt)};
  }
  function workspace(data) {
    if (!data.items.some(item=>roles[item.c.owner])) return data;
    return {...data, items:data.items.map(item=>({...item,c:upgradeCase(item.c)}))};
  }
  function walkthrough(tour) {
    if (!tour?.frames?.some(frame=>roles[frame.case.owner])) return tour;
    let reference=tour.type==='mine' ? null : root.CasePersonas.start(tour.type);
    const frames=tour.frames.map((frame,index)=>{
      const record=upgradeCase(frame.case, tour.type!=='mine');
      if (reference) {
        const {title,description}=reference;
        if (!reference.done) reference=root.CasePersonas.next(reference);
        return {...frame,title,description,case:record};
      }
      const title=index===0?'Review your feedback':record.trail.at(-1)?.text ?? 'Review feedback';
      return {...frame,title,case:record};
    });
    return {...tour,frames};
  }
  root.CaseUpgrade={workspace,walkthrough};
})(globalThis);
