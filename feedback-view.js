/* Customer workspace rendered from the shared CaseEngine record. */
(function (root) {
  'use strict';

  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const array = value => Array.isArray(value) ? value : [];
  const icon = (name, size = 16) => root.Glyph ? root.Glyph(name, size) : '';
  const lines = value => String(value || '').split('\n').map(line => line.trim()).filter(Boolean);
  const actorName = value => value === 'Reviewer' ? 'Requester' : value;
  const textOf = value => typeof value === 'string' ? value : value?.text || value?.summary || value?.label || '';
  const sameText = (a, b) => String(a ?? '').trim().replace(/\s+/g, ' ') === String(b ?? '').trim().replace(/\s+/g, ' ');
  const safeMedia = value => /^(blob:|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(String(value || '')) ? value : '';
  const orderTime = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  const phases = {
    draft: ['Requester', 'Ready to submit'],
    triage: ['Website team', 'Reviewing the scope'],
    'question-draft': ['Website team', 'Preparing questions'],
    'awaiting-answer': ['Requester', 'Needs your input'],
    'answer-review': ['Website team', 'Reviewing your answer'],
    'spec-review': ['Website team', 'Confirming the plan'],
    candidate: ['Website team', 'Preparing the result'],
    checking: ['Website team', 'Checking the result'],
    ready: ['Website team', 'Ready to send'],
    review: ['Requester', 'Ready for review'],
    accepted: ['Site owner', 'Awaiting release approval'],
    authorized: ['Website team', 'Approved for release'],
    published: ['Complete', 'Release simulated'],
    'release-failed': ['Website team', 'Release needs attention']
  };
  const legacyPhases = { draft: 'draft', clarify: 'awaiting-answer', processing: 'candidate', blocked: 'triage', release: 'accepted' };

  function displayTime(value) {
    if (value && typeof value === 'object') value = value.label || value.at || value.time || '';
    if (!value) return '';
    if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(date);
  }

  function fieldValue(vm, name, fallback) {
    return vm.formDraft?.fields?.[name] ?? fallback;
  }

  function delayNotice(status) {
    if (!status.overdue && !status.delayed) return '';
    return `<div class="fs-delay">${icon('clock', 16)}<div><strong>Update delayed</strong><p>The earlier update was due ${escape(displayTime(status.nextUpdate) || 'at the recorded time')}. ${escape(status.delayReason || 'The team has not set a revised time yet.')}</p></div></div>`;
  }

  function button(action, label, options = {}) {
    const value = options.value === undefined ? '' : ` data-value="${escape(options.value)}"`;
    const attributes = (options.disabled ? ' disabled' : '') + (options.controls ? ` aria-controls="${escape(options.controls)}" aria-expanded="${Boolean(options.expanded)}"` : '');
    const className = options.primary ? 'fs-button fs-primary' : options.quiet ? 'fs-button fs-quiet' : 'fs-button';
    return `<button type="button" class="${className}${options.className ? ' ' + escape(options.className) : ''}" data-wq="${escape(action)}"${value}${attributes}>${options.icon ? icon(options.icon, 15) : ''}<span>${escape(label)}</span>${options.arrow ? icon('send', 15) : ''}</button>`;
  }

  function statusFor(item, supplied) {
    const caseRecord = item?.c || {};
    const phase = caseRecord.reviewFlow?.phase || legacyPhases[caseRecord.stage] || caseRecord.stage || 'triage';
    const fallback = phases[phase] || [actorName(caseRecord.owner) || 'Website team', 'In progress'];
    return { owner: fallback[0], label: fallback[1], phase, ...item?.status, ...item?.presentation?.status, ...supplied };
  }

  function avatar(actor) {
    const normalized = actorName(actor) || 'Website team';
    const initials = { Requester: 'R', 'Website team': 'WT', 'Site owner': 'SO', Complete: '✓' }[normalized] || normalized.slice(0, 2);
    return `<span class="fs-avatar" aria-hidden="true">${normalized === 'Complete' ? icon('check', 13) : escape(initials)}</span>`;
  }

  function badge(status) {
    return `<span class="fs-status fs-status-${escape(status.phase || 'triage')}"><span class="fs-status-dot" aria-hidden="true"></span>${escape(status.label)}</span>`;
  }

  function scenarioFor(vm, item = vm.current) {
    const id = item?.c?.reviewFlow?.scenarioId;
    return array(vm.scenarios).find(scenario => scenario.id === id) || (id && vm.scenario?.id === id ? vm.scenario : undefined);
  }

  function titleFor(vm, item) {
    const scenario = scenarioFor(vm, item);
    const original = String(item?.c?.text || '').trim().split('\n')[0];
    const excerpt = original.length > 110 ? original.slice(0, 107).trimEnd() + '…' : original;
    return item?.title || item?.presentation?.title || (vm.current?.id === item?.id ? vm.presentation?.title : '') || item?.ux?.title || item?.c?.title || scenario?.title || item?.c?.reviewFlow?.title || excerpt || 'Your WinQuote feedback';
  }

  function notice(vm) {
    if (!vm.error && !vm.notice) return '';
    const text = vm.error || vm.notice;
    return `<div class="fs-message${vm.error ? ' fs-error' : ''}" role="${vm.error ? 'alert' : 'status'}">${icon(vm.error ? 'hold' : 'checks', 16)}<span>${escape(typeof text === 'string' ? text : text.message || text.text)}</span></div>`;
  }

  function navigation(vm) {
    const unread = array(vm.updates).filter(update => !update.read && !update.readAt).length;
    const active = vm.page === 'updates' ? 'updates' : 'inbox';
    return `<aside class="fs-navigation" aria-label="WinQuote feedback navigation">
      <button type="button" class="fs-brand" data-wq="nav-inbox" aria-label="WinQuote feedback home"><span class="winquote-symbol" aria-hidden="true"></span><span class="winquote-wordmark">WinQuote</span></button>
      <span class="fs-workspace-label">Customer workspace</span>
      <nav class="fs-navlinks">
        <button type="button" class="fs-navitem${active === 'inbox' ? ' fs-selected' : ''}" data-wq="nav-inbox"${active === 'inbox' ? ' aria-current="page"' : ''}>${icon('inbox')}<span>My feedback</span></button>
        <button type="button" class="fs-navitem${active === 'updates' ? ' fs-selected' : ''}" data-wq="nav-updates"${active === 'updates' ? ' aria-current="page"' : ''}>${icon('bell')}<span>Updates</span>${unread ? `<small>${unread}</small>` : ''}</button>
      </nav>
      <div class="fs-navbottom">
        <button type="button" class="fs-navitem" data-wq="open-console">${icon('play')}<span>Walkthrough</span>${icon('next', 13)}</button>
        <div class="fs-navuser">${avatar('Requester')}<span>WinQuote customer<small>Simulated workspace</small></span></div>
      </div>
    </aside>`;
  }

  function topbar(vm) {
    const isTicket = vm.page === 'ticket';
    const crumb = vm.page === 'updates' ? 'Updates' : vm.page === 'site' ? 'Sample quote' : 'My feedback';
    return `<header class="fs-topbar"><div class="fs-breadcrumb">${button(isTicket || vm.page === 'site' ? 'back' : 'nav-inbox', isTicket || vm.page === 'site' ? 'Back' : crumb, { quiet: true, icon: isTicket || vm.page === 'site' ? 'back' : 'inbox' })}${isTicket ? `<span class="fs-slash">/</span><span class="fs-ticket-id">${escape(vm.current?.id)}</span>` : ''}</div><div class="fs-top-actions">${isTicket ? button('toggle-context', 'Details', { quiet: true, icon: 'sidebar', controls: 'feedback-details', expanded: vm.contextOpen }) : ''}${vm.page === 'site' ? feedbackEntry() : button('open-console', 'Walkthrough', { quiet: true, icon: 'play' })}</div></header>`;
  }

  function feedbackEntry() {
    return `<div class="fs-feedback-entry" data-feedback-private><div class="fs-feedback-split">${button('open-composer', 'Feedback', {primary:true, icon:'feedback'})}<button type="button" class="fs-feedback-chevron" data-wq="feedback-context-menu" aria-label="Choose how to gather page context" aria-haspopup="menu" aria-controls="feedback-context-menu" aria-expanded="false">${icon('down',16)}</button></div><div id="feedback-context-menu" class="fs-capture-menu" popover="auto" role="menu" aria-label="Gather page context"><p>Add context to your feedback</p>${[['element','target','Select an element','Attach its location and available page state'],['area','crop','Capture an area','Choose a tab, then crop the screenshot'],['page','camera','Capture this page','Choose this WinQuote tab to capture its visible view']].map(([mode,glyph,label,hint])=>`<button type="button" role="menuitem" data-wq="gather-context" data-value="${mode}">${icon(glyph,18)}<span><strong>${label}</strong><small>${hint}</small></span></button>`).join('')}</div></div>`;
  }

  function sampleEntry(vm) {
    if (!array(vm.scenarios).length) return '';
    return `<aside class="fs-sample-entry"><span>${icon('play', 16)}<span><strong>Try the same flow with a sample ticket</strong><small>Start with feedback, follow the handoffs, and review the result.</small></span></span>${button('open-console', 'Choose a sample', { quiet: true, arrow: true })}</aside>`;
  }

  function entryStatus(item) {
    const status = statusFor(item);
    const ux = item.ux || {};
    const next = {
      triage: 'The website team is reviewing the request.',
      'question-draft': 'The team is preparing a focused question.',
      'awaiting-answer': 'Answer the team’s questions to move this forward.',
      'answer-review': 'Your answer is with the website team.',
      'spec-review': 'The team is confirming the approach and checks.',
      candidate: 'The team is preparing a result you can try.',
      checking: 'The team is checking the candidate.',
      ready: 'The team is checking the result before sending it.',
      review: 'Open version ' + (item.c?.rev || 1) + ' and accept it or request changes.',
      accepted: 'The site owner will review the accepted version for release.',
      authorized: 'The team can run the approved release.',
      'release-failed': 'The team is working on the release attempt.',
      published: 'The release is complete in this simulation.'
    }[status.phase];
    return { ...status, next: status.next || ux.next || ux.timing?.next || next || '', updatedAt: status.updatedAt || ux.timing?.updatedAt || ux.updatedAt || '', nextUpdate: status.nextUpdate || ux.timing?.nextUpdateAt || ux.timing?.nextUpdate || '', overdue: status.overdue || ux.timing?.overdue || false };
  }

  function inbox(vm) {
    const all = array(vm.items);
    const needsYou = item => ['draft', 'awaiting-answer', 'review'].includes(statusFor(item).phase);
    const complete = item => statusFor(item).phase === 'published';
    const filter = vm.filter || 'all';
    const query = String(vm.search || '').toLowerCase().trim();
    const filtered = all.filter(item => (filter === 'all' || filter === 'needs-you' && needsYou(item) || filter === 'with-team' && !needsYou(item) && !complete(item) || filter === 'complete' && complete(item)) && (!query || (titleFor(vm, item) + ' ' + item.id + ' ' + item.c?.text).toLowerCase().includes(query)));
    filtered.sort((a, b) => Number(needsYou(b)) - Number(needsYou(a)) || orderTime(entryStatus(b).updatedAt) - orderTime(entryStatus(a).updatedAt));
    const filters = [['all', 'All', all.length], ['needs-you', 'Needs you', all.filter(needsYou).length], ['with-team', 'With the team', all.filter(item => !needsYou(item) && !complete(item)).length], ['complete', 'Complete', all.filter(complete).length]];
    return `<section class="fs-inbox"><header class="fs-page-heading"><div><h1>My feedback</h1><p>One conversation from your first report to an accepted result.</p></div>${button('open-console', 'Walk through a ticket', { quiet: true, icon: 'play' })}</header>
      ${notice(vm)}
      ${vm.current && !all.some(item => item.id === vm.current.id) ? `<div class="fs-resume">${icon('history', 17)}<span>Continue your current walkthrough.</span>${button('resume', 'Resume', { quiet: true, arrow: true })}</div>` : ''}
      <div class="fs-list-toolbar"><div class="fs-filters" aria-label="Filter feedback">${filters.map(([id, label, count]) => `<button type="button" data-wq="filter-inbox" data-value="${id}" aria-pressed="${id === filter}">${label}<small>${count}</small></button>`).join('')}</div><label class="fs-search">${icon('search', 15)}<input type="search" data-wq="search-inbox" value="${escape(vm.search)}" placeholder="Search feedback" aria-label="Search feedback"></label></div>
      <div class="fs-ticket-list">${filtered.length ? filtered.map(item => {
        const status = entryStatus(item);
        return `<button type="button" class="fs-ticket-row" data-wq="open-ticket" data-value="${escape(item.id)}"><span class="fs-row-icon">${icon(needsYou(item) ? 'ask' : complete(item) ? 'checks' : 'feedback', 18)}</span><span class="fs-row-main"><strong>${escape(titleFor(vm, item))}</strong><span>${escape(status.next || item.ux?.summary || item.c?.text)}</span><small>${escape(item.id)} <span aria-hidden="true">·</span> ${escape(status.owner)}</small><span class="fs-row-timing">${status.updatedAt ? `<span>Updated ${escape(displayTime(status.updatedAt))}</span>` : ''}${status.nextUpdate && !complete(item) ? `<span${status.overdue ? ' class="fs-overdue"' : ''}>${status.overdue ? 'Update overdue · ' : 'Next update · '}${escape(displayTime(status.nextUpdate))}</span>` : ''}</span></span>${badge(status)}${icon('next', 14)}</button>`;
      }).join('') : `<div class="fs-empty">${icon(filter === 'all' ? 'feedback' : 'inbox', 24)}<h2>${filter === 'all' && !query ? 'Your feedback starts here' : 'Nothing in this view'}</h2><p>${filter === 'all' && !query ? 'Start from a sample quote, describe what gets in your way, and follow the same request through to a result.' : 'Try a different filter or search.'}</p></div>`}</div>
      ${sampleEntry(vm)}
    </section>`;
  }

  function updates(vm) {
    const list = array(vm.updates).slice().sort((a, b) => orderTime(b.createdAt || b.at) - orderTime(a.createdAt || a.at));
    const groups = new Map();
    list.forEach(update => {
      const id = update.ticketId || update.recordId || 'workspace';
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(update);
    });
    if (array(vm.updateGroups).length) {
      groups.clear();
      vm.updateGroups.forEach(group => groups.set(group.ticketId, array(group.events).length ? group.events : [group]));
    }
    const row = update => `<button type="button" class="fs-update${!update.read && !update.readAt ? ' fs-unread' : ''}" data-wq="open-update" data-value="${escape(update.id)}"><span class="fs-update-mark">${icon(update.kind === 'review' ? 'verify' : update.kind === 'question' ? 'ask' : 'bell', 17)}</span><span class="fs-row-main"><strong>${escape(update.title || update.label || 'Feedback updated')}</strong><span>${escape(update.body || update.summary || update.text || update.message || '')}</span><small>${escape(displayTime(update.createdAt || update.at) || 'Time not recorded')}</small></span>${icon('next', 14)}</button>`;
    return `<section class="fs-inbox fs-updates"><header class="fs-page-heading"><div><h1>Updates</h1><p>The latest handoff for each request, with earlier updates close by.</p></div>${list.length ? button('mark-read-all', 'Mark all as read', { quiet: true, icon: 'checks' }) : ''}</header>${notice(vm)}<div class="fs-update-list">${list.length ? [...groups].map(([id, entries]) => {
      const item = array(vm.items).find(item => item.id === id);
      return `<section class="fs-update-group"><header><h2>${escape(item ? titleFor(vm, item) : entries[0].ticketTitle || 'Feedback updates')}</h2><span>${escape(id === 'workspace' ? 'Workspace' : id)}</span></header>${row(entries[0])}${entries.length > 1 ? `<details class="fs-update-history"><summary>${entries.length - 1} earlier ${entries.length === 2 ? 'update' : 'updates'} ${icon('down', 13)}</summary>${entries.slice(1).map(row).join('')}</details>` : ''}</section>`;
    }).join('') : `<div class="fs-empty">${icon('bell', 24)}<h2>You’re all caught up</h2><p>Questions, review requests, and release updates will appear here.</p>${button('nav-inbox', 'Back to my feedback', { quiet: true, arrow: true })}</div>`}</div><p class="fs-footnote">Notifications in this workspace are simulated.</p></section>`;
  }

  function textField(name, label, value, options = {}) {
    return `<label class="fs-field"><span>${escape(label)}</span><textarea name="${escape(name)}" rows="${options.rows || 3}" maxlength="16000"${options.required ? ' required' : ''}>${escape(value)}</textarea>${options.hint ? `<small>${escape(options.hint)}</small>` : ''}</label>`;
  }

  function proseList(value, className = '') {
    const values = Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : item.label ? item.label + (item.value && !sameText(item.label, item.value) ? ' · ' + item.value : '') : textOf(item)) : lines(value);
    return `<ul class="fs-prose-list ${escape(className)}">${values.filter(Boolean).map(line => `<li>${escape(String(line).replace(/^[-•]\s*/, ''))}</li>`).join('')}</ul>`;
  }

  function actions(content, className = '') {
    return `<div class="fs-task-actions${className ? ' ' + escape(className) : ''}">${content}</div>`;
  }

  function questionRound(flow) {
    const rounds = array(flow.questionRounds);
    const draft = flow.phase === 'question-draft';
    const sentIndex = rounds.findIndex(round => (round.id || round.bundleId) === flow.sentBundle?.id);
    const ordinal = draft ? rounds.length + 1 : sentIndex >= 0 ? sentIndex + 1 : Math.max(1, rounds.length);
    return `<div class="fs-round"><span>${icon('ask', 14)}Question round ${ordinal}</span>${draft ? '<span>Draft · not sent</span>' : ''}${flow.journey?.scopeCycle > 1 ? `<span>Scope revision ${Number(flow.journey.scopeCycle)}</span>` : ''}</div>`;
  }

  function answerFields(questions, answers = {}, disabled = false, answerNotes = {}) {
    return array(questions).map((question, index) => {
      const current = answers[question.id];
      const selected = Array.isArray(current) ? current : [current];
      const type = question.type || 'text';
      const isChoice = ['single', 'yes_no', 'multi'].includes(type);
      const options = array(question.options).length ? question.options : ['Yes', 'No', 'Not sure'];
      const isMulti = type === 'multi';
      const exclusiveLabels = options.filter((option, choice) => array(question.exclusiveOptionIds).includes(question.optionIds?.[choice])).map(option => typeof option === 'string' ? option : option.label || option.text || '');
      const maxChoices = question.maxSelections ?? options.length;
      const minChoices = question.minSelections ?? (question.required ? 1 : 0);
      const choiceHint = maxChoices === 1 ? 'Choose one option.' : minChoices > 1 ? minChoices === maxChoices ? 'Choose ' + minChoices + ' options.' : 'Choose between ' + minChoices + ' and ' + maxChoices + ' options.' : maxChoices < options.length ? 'Choose up to ' + maxChoices + ' options.' : 'Select all that apply.';
      const exclusiveHint = exclusiveLabels.length ? ' Choose ' + exclusiveLabels.map(label => '“' + label + '”').join(' or ') + ' on its own.' : '';
      const fields = isChoice ? `<div class="fs-options">${options.map((option, choice) => {
        const value = typeof option === 'object' ? option.value || option.id || option.label : option;
        const label = typeof option === 'object' ? option.label || option.text || option.value : option;
        return `<label class="fs-option"><input type="${isMulti ? 'checkbox' : 'radio'}" name="answer-${escape(question.id)}" data-answer-id="${escape(question.id)}" value="${escape(value)}"${selected.includes(value) ? ' checked' : ''}${disabled ? ' disabled' : ''}><span>${escape(label)}</span></label>`;
      }).join('')}</div>${options.some(option => /^other\b/i.test(typeof option === 'string' ? option : option.label || '')) ? `<label class="fs-other-answer"><span>If you selected Other</span><textarea data-answer-other="${escape(question.id)}" rows="2"${disabled ? ' disabled' : ''} placeholder="Add a little context">${escape(answerNotes[question.id] || '')}</textarea></label>` : ''}` : `<textarea class="fs-answer-text" data-answer-id="${escape(question.id)}" rows="3" maxlength="6000"${disabled ? ' disabled' : ''} placeholder="Write your answer">${escape(current || '')}</textarea>`;
      return `<fieldset class="fs-question"${disabled ? ' disabled' : ''}><legend><span class="fs-question-number">${index + 1}</span><span class="fs-question-title">${escape(question.text)}</span>${question.required ? '<span class="fs-required">Required</span>' : ''}</legend>${question.reason ? `<p>${escape(question.reason)}</p>` : ''}${isMulti ? `<span class="fs-choice-hint">${escape(choiceHint + exclusiveHint)}</span>` : ''}${fields}</fieldset>`;
    }).join('');
  }

  function selectionRules(question) {
    const options = array(question.options).map(option => typeof option === 'string' ? option : option.label || option.text || '');
    const exclusive = options.filter((label, index) => array(question.exclusiveOptionIds).includes(question.optionIds?.[index]) || /^(none of these|not sure|i[’']m not sure)$/i.test(label.trim()));
    const multiple = question.type === 'multi';
    return `<details class="fs-selection-rules"><summary>Selection rules ${icon('down', 13)}</summary><p>For multiple-choice answers, set how many options can be chosen. An exclusive answer must be selected on its own.</p><div class="fs-field-pair"><label class="fs-field"><span>Minimum choices</span><input type="number" data-field="minSelections" min="0" max="30" value="${escape(question.minSelections ?? (multiple ? question.required ? 1 : 0 : ''))}" placeholder="Use required setting"></label><label class="fs-field"><span>Maximum choices</span><input type="number" data-field="maxSelections" min="0" max="30" value="${escape(question.maxSelections ?? (multiple ? options.length : ''))}" placeholder="All options"></label></div><label class="fs-field"><span>Exclusive answers</span><textarea data-field="exclusiveOptions" rows="2">${escape(exclusive.join('\n'))}</textarea><small>One exact option label per line. “None of these” and uncertainty answers are exclusive by default.</small></label></details>`;
  }

  function questionEditor(flow, vm) {
    const questions = Array.isArray(vm.formDraft?.questions) ? vm.formDraft.questions : array(flow.questionDraft);
    const customerQuestions = questions.filter(question => question.disposition === 'ask');
    const returnLabel = flow.evidenceFirst && !flow.planPrepared ? 'Back to evidence' : 'Back to scope';
    const followup = flow.reopenedFor?.scopeCycle === flow.journey?.scopeCycle ? flow.reopenedFor : null;
    return `${questionRound(flow)}<h2>Ask only what the requester can answer</h2><p class="fs-task-intro">Review the wording, answer format, and reason for each question. Keep known facts and technical decisions with the team.</p>${followup ? `<blockquote class="fs-request-quote"><span>Follow-up on changes requested to V${escape(followup.rev)}</span><p>${escape(followup.reason)}</p></blockquote>` : ''}
      <div class="fs-question-editors">${questions.map((question, index) => `<details class="fs-question-editor" data-question-id="${escape(question.id)}"${question.disposition === 'ask' ? ' open' : ''}><summary><span class="fs-question-number">${index + 1}</span><span>${escape(question.text)}</span><small>${escape({ ask: 'Ask requester', records: 'From records', team: 'Team decision', omit: 'Omitted' }[question.disposition] || 'Draft')}</small>${icon('down', 14)}</summary><div class="fs-question-fields"><label class="fs-field"><span>Question</span><textarea data-field="text" rows="2">${escape(question.text)}</textarea></label><div class="fs-field-pair"><label class="fs-field"><span>Answer type</span><select data-field="type">${[['single', 'Single choice'], ['multi', 'Multiple choice'], ['yes_no', 'Yes / No'], ['text', 'Written answer']].map(([id, label]) => `<option value="${id}"${question.type === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label><label class="fs-field"><span>Resolve with</span><select data-field="disposition">${[['ask', 'Ask requester'], ['records', 'Existing records'], ['team', 'Website team'], ['omit', 'Omit this question']].map(([id, label]) => `<option value="${id}"${question.disposition === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div><label class="fs-field"><span>Options</span><textarea data-field="options" rows="3">${escape(array(question.options).map(option => typeof option === 'string' ? option : option.label || option.text).join('\n'))}</textarea><small>One option per line, for choice questions.</small></label>${selectionRules(question)}<label class="fs-field"><span>Why this answer is needed</span><textarea data-field="reason" rows="2">${escape(question.reason)}</textarea></label><label class="fs-checkbox"><input type="checkbox" data-field="required"${question.required ? ' checked' : ''}>Answer required</label></div></details>`).join('')}</div>
      ${!customerQuestions.length ? '<p class="fs-soft-note">No customer questions are selected. Keep recorded facts and team decisions internal, then return to the review to continue.</p>' : ''}
      ${flow.questionPreview ? `<section class="fs-question-preview"><div class="fs-section-heading"><h3>What the requester will see</h3><span>Preview · not sent</span></div>${answerFields(flow.questionPreview.questions, {}, true)}</section>` : ''}
      ${actions(button('close-questions', returnLabel, { quiet: Boolean(customerQuestions.length), primary: !customerQuestions.length }) + button('add-question', 'Add a question', {quiet: true, icon: 'plus'}) + button('save-questions', 'Save draft') + (flow.questionPreview ? button('send-questions', 'Send questions', { primary: true, arrow: true }) : button('preview-questions', 'Preview questions', { primary: true, disabled: !customerQuestions.length })))}
      <p class="fs-footnote">Questions are private until the team sends them.</p>`;
  }

  function currentResult(vm, caseRecord) {
    const flow = caseRecord.reviewFlow;
    const version = array(caseRecord.versions).at(-1);
    const frozen = ['review', 'accepted', 'authorized', 'published', 'release-failed'].includes(flow.phase);
    const result = frozen ? version?.result || flow.result : flow.result;
    const proposal = frozen ? version?.candidate : flow.candidateDraft?.approach;
    const checks = result?.checks || (frozen ? version?.reviewFlow?.candidateDraft?.checks : flow.candidateDraft?.checks);
    const available = Boolean(vm.preview?.interactive);
    return `<section class="fs-result"><div class="fs-result-heading"><span class="fs-result-icon">${icon('file', 22)}</span><div><h3>Version ${Number(caseRecord.rev) || 1}</h3><p>${escape(vm.scenario?.title || titleFor(vm, vm.current))}</p></div><span class="fs-version-tag">Simulation</span></div><div class="fs-result-summary">${proseList(proposal)}</div>${available ? button('open-result', 'Open result', { primary: true, icon: 'external' }) : `<p class="fs-soft-note">${escape(vm.preview?.reason || 'Prepare this version to open its result.')}</p>`}<details class="fs-result-checks" open><summary>What to check ${icon('down', 14)}</summary>${proseList(checks)}</details>${frozen ? versionBasis(panelPresentation(vm), version?.rev) : ''}</section>`;
  }

  function waiting(vm, caseRecord) {
    const flow = caseRecord.reviewFlow;
    const status = statusFor(vm.current, vm.status);
    const summary = flow.sharedUnderstanding;
    const freshAnswer = flow.phase === 'answer-review';
    const artifact = vm.presentation?.preparation;
    const preparationStage = artifact?.stage;
    const preparationLabel = {
      'context-ready': 'Context saved',
      'draft-ready': 'Simulated preparation ready',
      'team-review-pending': 'Ready for the team to review'
    }[preparationStage];
    const preparationNote = flow.phase === 'triage' && (preparationLabel || artifact) ? `<section class="fs-preparation" aria-label="Simulated preparation">${icon('checks', 15)}<div><span>Simulated preparation</span><strong>${escape(artifact?.title || preparationLabel)}</strong>${artifact?.summary ? `<p>${escape(artifact.summary)}</p>` : ''}${array(artifact?.facts).length ? `<ul>${artifact.facts.map(fact => `<li>${fact.label ? `<strong>${escape(fact.label)}</strong> ` : ''}${escape(textOf(fact))}${fact.source ? `<small>${escape(textOf(fact.source))}</small>` : ''}</li>`).join('')}</ul>` : ''}${array(artifact?.questions).length ? `<p class="fs-preparation-label">For the team to review</p><ul>${artifact.questions.map(question => `<li>${escape(textOf(question))}</li>`).join('')}</ul>` : ''}${array(artifact?.limitations).map(value => `<p class="fs-footnote">${escape(textOf(value))}</p>`).join('')}<p class="fs-footnote">No question or decision has been sent automatically.</p>${(preparationStage === 'context-ready' || preparationStage === 'draft-ready' && (artifact?.paused === true || vm.preparationPaused === true)) ? button('resume-preparation', 'Continue simulated preparation', { quiet: true, icon: 'next' }) : ''}</div></section>` : '';
    return `<div class="fs-waiting"><span class="fs-waiting-mark">${icon(freshAnswer ? 'checks' : 'clock', 22)}</span><h2>${freshAnswer ? 'Your answer is with the team' : flow.phase === 'awaiting-answer' ? 'Waiting for the customer’s answer' : status.owner === 'Site owner' ? 'Your accepted version is awaiting release approval' : status.owner === 'Requester' ? 'The requester is reviewing this step' : status.owner === 'Complete' ? 'This request is complete' : 'The website team has your request'}</h2><p class="fs-task-intro">${escape(status.next || (freshAnswer ? 'The team will review how your answer changes the plan and acceptance checks.' : 'You can keep working. We’ll show the next question or result in Updates.'))}</p>
      ${preparationNote}${delayNotice(status)}
      ${freshAnswer && (flow.detailedAnswerText || caseRecord.answer) ? `<blockquote class="fs-request-quote"><span>Your answer</span><p>${escape(flow.sentBundle?.round === 'detailed' ? flow.detailedAnswerText : caseRecord.answer)}</p></blockquote>` : ''}
      ${summary ? `<div class="fs-shared-summary"><h3>${freshAnswer ? 'Current confirmed understanding' : 'Our understanding'}</h3><p>${escape(summary.text)}</p>${freshAnswer ? '<span class="fs-footnote">Your new answer is under review. The team will confirm the updated plan before preparing the result.</span>' : ''}${summary.needsRevision ? `<span class="fs-footnote">${flow.reopenedFor?.scopeCycle === flow.journey?.scopeCycle ? 'The team is reviewing your requested change before updating this plan.' : 'Your correction is awaiting team review.'}</span>` : vm.actor === 'Requester' && ['spec-review', 'candidate', 'checking', 'ready'].includes(flow.phase) ? button('correct-understanding', 'Correct our understanding', { quiet: true, icon: 'edit' }) : ''}</div>` : ''}
      <dl class="fs-waiting-details"><div><dt>With</dt><dd>${avatar(status.owner)}${escape(status.owner)}</dd></div><div><dt>Last update</dt><dd>${escape(displayTime(status.updatedAt) || 'Request received')}</dd></div><div><dt>Next update</dt><dd>${escape(displayTime(status.nextUpdate) || 'The team will set an update after reviewing the request.')}</dd></div></dl>
      ${['review', 'accepted', 'authorized', 'release-failed'].includes(flow.phase) ? currentResult(vm, caseRecord) : ''}
      ${actions(button('keep-working', 'Keep working', { icon: 'back' }) + button('nav-updates', 'View updates', { quiet: true, icon: 'bell' }))}</div>`;
  }

  function teamPreparation(vm) {
    if (vm.actor !== 'Website team' || vm.historyVersion || vm.walkHistory?.active) return '';
    const preparation = vm.presentation?.preparation;
    if (!preparation || !['draft-ready', 'team-review-pending'].includes(preparation.stage)) return '';
    const draft = preparation.teamDraft || preparation.draftPlan;
    const facts = array(preparation.facts);
    const brief = `<details class="fs-team-preparation"${draft ? '' : ' open'}><summary><span>${icon('file', 15)}Context brief</span><small>Saved material · simulation</small>${icon('down', 13)}</summary><div class="fs-team-preparation-body">${preparation.summary ? `<p>${escape(preparation.summary)}</p>` : ''}<dl>${facts.map(fact => `<div><dt>${escape(fact.label || 'Context')}</dt><dd>${escape(textOf(fact))}${fact.source ? `<small>${escape(textOf(fact.source))}</small>` : ''}</dd></div>`).join('')}</dl>${array(preparation.limitations).map(note => `<p class="fs-footnote">${escape(textOf(note))}</p>`).join('')}</div></details>`;
    if (!draft) return brief;
    return `${brief}<details class="fs-team-preparation fs-private-preparation" open><summary><span>${icon('branch', 15)}Private AI draft</span><small>Simulated · pending your review</small>${icon('down', 13)}</summary><div class="fs-team-preparation-body"><p class="fs-private-boundary">Only the website team can see this draft. Review and edit the scope below before sharing it or sending questions.</p>${draft.approach ? `<h3>Proposed approach</h3>${proseList(draft.approach)}` : ''}${array(draft.checks).length || typeof draft.checks === 'string' && draft.checks ? `<h3>Suggested acceptance checks</h3>${proseList(draft.checks)}` : ''}${array(draft.questions).length ? `<h3>Questions to review</h3>${proseList(draft.questions)}` : ''}${draft.note ? `<p>${escape(draft.note)}</p>` : ''}${draft.source ? `<p class="fs-footnote">Source: ${escape(textOf(draft.source))}</p>` : ''}<p class="fs-footnote">The draft has not been applied to the scope or sent to the requester.</p></div></details>`;
  }

  function sourceReference(source) {
    if (!source) return '';
    const value = typeof source === 'string' ? { label: source } : source;
    const label = value.label || value.text || value.type || value.kind || 'Recorded source';
    return `<details class="fs-source-detail"><summary>${icon('file', 11)}${escape(label)}</summary><p>${escape(value.text || label)}${value.id ? `<small>${escape(value.id)}</small>` : ''}</p></details>`;
  }

  function reasoningRecords(reasoning = {}, collapsed = false, label = 'Records behind this plan') {
    const facts = array(reasoning.facts), decisions = array(reasoning.decisions);
    const row = record => `<li><p>${escape(textOf(record))}</p><div class="fs-reasoning-meta">${record.status ? `<span>${escape(String(record.status).replace(/[-_]/g, ' '))}</span>` : ''}${sourceReference(record.source)}</div></li>`;
    const visibleFacts = collapsed ? facts : facts.slice(0, 3);
    const content = `${facts.length ? `<ul class="fs-reasoning-records">${visibleFacts.map(row).join('')}</ul>${!collapsed && facts.length > 3 ? `<details class="fs-recorded-decisions"><summary>${facts.length - 3} more records ${icon('down', 13)}</summary><ul class="fs-reasoning-records">${facts.slice(3).map(row).join('')}</ul></details>` : ''}` : '<p class="fs-footnote">The original feedback is available. No additional evidence has been organized yet.</p>'}${decisions.length ? `<details class="fs-recorded-decisions"><summary>Recorded decisions <small>${decisions.length}</small>${icon('down', 13)}</summary><ul class="fs-reasoning-records">${decisions.map(row).join('')}</ul></details>` : ''}`;
    return collapsed ? `<details class="fs-plan-sources"><summary>${icon('file', 15)}${escape(label)} <small>${facts.length + decisions.length}</small>${icon('down', 13)}</summary>${content}</details>` : `<section class="fs-reasoning" aria-label="Organized evidence"><header><h3>What the records tell us</h3><span>AI organized · for team review</span></header>${content}</section>`;
  }

  function answerImplications(reasoning = {}, { compact = false, answer = '' } = {}) {
    const impacts = array(reasoning.implications).filter(impact => array(impact.behavior).length || array(impact.checks).length || impact.note || impact.conflict);
    if (!impacts.length) return '';
    const supported = impacts.some(impact => array(impact.behavior).length || array(impact.checks).length);
    // A pending adjustment is context, not a second adopted answer. Keep real
    // consequences, unsupported-answer notes and conflicts in the visible review.
    const contextOnly = compact ? impacts.filter(impact => impact.source?.type === 'revision-request' && !array(impact.behavior).length && !array(impact.checks).length && !impact.conflict) : [];
    const visible = impacts.filter(impact => !contextOnly.includes(impact));
    const sources = compact ? impacts.filter(impact => impact.source).map(impact => {
      const source = typeof impact.source === 'string' ? { label: impact.source } : impact.source;
      const label = source.label || source.text || source.type || 'Recorded source';
      const answerText = textOf(impact.answer), sourceText = source.text || '';
      return `<section class="fs-answer-context-item"><h4>${escape(label)}</h4>${answerText ? `<p>${escape(answerText)}</p>` : ''}${sourceText && !sameText(sourceText, answerText) ? `<p>${escape(sourceText)}</p>` : ''}${source.id ? `<small>${escape(source.id)}</small>` : ''}${contextOnly.includes(impact) && impact.note ? `<p class="fs-footnote">${escape(impact.note)}</p>` : ''}</section>`;
    }).join('') : '';
    return `<section class="fs-answer-implications" aria-label="How the answer changes the plan"><h3>${supported ? 'What this answer changes' : 'The answer needs a team decision'}</h3>${visible.map(impact => `<div class="fs-answer-impact">${impact.answer && (compact ? !sameText(textOf(impact.answer), answer) : impacts.length > 1) ? `<p class="fs-impact-answer">${escape(textOf(impact.answer))}</p>` : ''}<dl>${array(impact.behavior).length ? `<div><dt>Behavior</dt><dd>${proseList(impact.behavior)}</dd></div>` : ''}${array(impact.checks).length ? `<div><dt>Review checks</dt><dd>${proseList(impact.checks)}</dd></div>` : ''}</dl>${impact.note ? `<p class="fs-impact-note">${escape(impact.note)}</p>` : ''}${impact.conflict ? `<p class="fs-conflict">${escape(impact.conflict)}</p>` : ''}${compact ? '' : sourceReference(impact.source)}</div>`).join('')}${supported ? '<p class="fs-footnote">Proposed implications · confirm them before sharing the plan.</p>' : ''}</section>${sources ? `<details class="fs-answer-context"><summary>Answer &amp; adjustment context ${icon('down', 13)}</summary><div>${sources}</div></details>` : ''}`;
  }

  function teamJudgment(reasoning = {}) {
    const shown = array(reasoning.implications).flatMap(impact => [impact.note, impact.conflict]).filter(Boolean);
    const notes = array(reasoning.teamConsiderations).filter(note => !shown.includes(textOf(note)));
    return notes.length ? `<section class="fs-team-judgment"><h3>For the team to decide</h3>${notes.map(note => `<p>${escape(textOf(note))}</p>`).join('')}</section>` : '';
  }

  function versionBasis(presentation, rev) {
    const reasoning = presentation?.reasoning;
    if (reasoning?.state !== 'submitted' || !rev || Number(reasoning.sourceVersion) !== Number(rev)) return '';
    const links = array(reasoning.implications).filter(impact => impact.answer);
    if (!links.length) return '';
    return `<details class="fs-version-basis"><summary><span>Why this version</span><small>Version ${escape(rev)} basis</small>${icon('down', 13)}</summary><div>${links.map(impact => `<section class="fs-version-relation"><blockquote class="fs-request-quote"><span>${impact.source?.type === 'revision-request' ? 'Requested change' : 'Requester answer'}</span><p>${escape(textOf(impact.answer))}</p></blockquote><dl>${array(impact.behavior).length ? `<div><dt>In this version</dt><dd>${proseList(impact.behavior)}</dd></div>` : ''}${array(impact.checks).length ? `<div><dt>Acceptance basis</dt><dd>${proseList(impact.checks)}</dd></div>` : ''}</dl>${impact.note ? `<p class="fs-impact-note">${escape(impact.note)}</p>` : ''}${sourceReference(impact.source)}</section>`).join('')}<p class="fs-footnote">Saved with version ${escape(rev)}. Later answers do not change this record.</p></div></details>`;
  }

  function evidenceReview(vm, presentation) {
    const flow = vm.current.c.reviewFlow;
    const reasoning = presentation.reasoning || {};
    const answering = flow.phase === 'answer-review';
    const answer = flow.sentBundle?.round === 'detailed' ? flow.detailedAnswerText : vm.current.c.answer;
    const draftLabel = flow.needsMaterialReview ? 'Start a team draft' : 'Use existing evidence';
    const outstanding = array(reasoning.outstanding).filter(item => !['answered', 'resolved', 'omitted'].includes(item.status));
    if (answering) return `<div class="fs-answer-review"><header class="fs-answer-review-header"><div><h2>Review what the answer changes</h2><p class="fs-task-intro">Review the reply and its implications, then prepare a private draft.</p></div><div class="fs-answer-next">${button('draft-plan', 'Draft an updated plan', { primary: true, icon: 'branch' })}<span>Private until you confirm and share.</span></div></header>
      <blockquote class="fs-request-quote"><span>Latest requester answer</span><p>${escape(answer || 'No answer text was recorded.')}</p></blockquote>
      ${answerImplications(reasoning, { compact: true, answer })}${teamJudgment(reasoning)}
      ${outstanding.length ? `<div class="fs-open-decisions"><h3>Still to decide</h3><ul>${outstanding.map(item => `<li><p>${escape(textOf(item))}</p>${item.reason ? `<small>${escape(item.reason)}</small>` : ''}</li>`).join('')}</ul></div>` : ''}
      ${reasoningRecords(reasoning, true, 'Records reviewed with this answer')}</div>`;
    return `<h2>${answering ? 'Review what the answer changes' : 'Start with the evidence'}</h2><p class="fs-task-intro">${answering ? 'Review the requester’s reply before updating the plan.' : 'Check the recorded context, then decide whether you have enough to draft a plan.'}</p>
      <blockquote class="fs-request-quote"><span>${answering ? 'Latest requester answer' : 'Reported problem'}</span><p>${escape(answering ? answer || 'No answer text was recorded.' : presentation.request?.text || vm.current.c.text || textOf(reasoning.problem))}</p>${!answering && reasoning.problem?.source?.type === 'spec-reconstruction' ? '<small class="fs-footnote">Reconstructed from the ticket-linked specification.</small>' : ''}</blockquote>
      ${answering ? answerImplications(reasoning) : ''}${reasoningRecords(reasoning, answering, 'Records reviewed with this answer')}${teamJudgment(reasoning)}
      ${outstanding.length ? `<div class="fs-open-decisions"><h3>Still to decide</h3><ul>${outstanding.map(item => `<li><p>${escape(textOf(item))}</p>${item.reason ? `<small>${escape(item.reason)}</small>` : ''}</li>`).join('')}</ul></div>` : ''}
      ${actions(button('draft-plan', answering ? 'Draft an updated plan' : draftLabel, { primary: true, icon: 'branch' }) + (answering ? '' : button('draft-questions', 'Confirm with the customer', { quiet: true, icon: 'ask' })), answering ? '' : 'fs-review-choices')}<p class="fs-footnote">${answering ? 'The draft stays with the website team until you confirm and share it.' : flow.needsMaterialReview ? 'The supplied material needs team review. Start a private draft, or review and edit customer questions before sending.' : 'The plan draft stays private. Customer questions are reviewed and previewed before sending.'}</p>`;
  }

  function task(vm) {
    const caseRecord = vm.current?.c;
    const flow = caseRecord?.reviewFlow;
    if (!caseRecord) return '';
    const presentation = panelPresentation(vm);
    if (vm.historyVersion || presentation.historical || vm.walkHistory?.active) {
      const replay = Boolean(vm.walkHistory?.active);
      const version = presentation.viewedRev || vm.historyVersion?.rev || vm.historyVersion;
      return `<div class="fs-readonly-banner">${icon('history', 16)}<span><strong>${replay ? 'Walkthrough replay' : 'Saved version'} · Read-only</strong><small>${replay ? 'Your current request is unchanged.' : 'The request and acceptance basis below belong to this delivery.'}</small></span></div><h2>${escape(replay ? vm.walkHistory.label || 'Earlier step' : 'Version ' + version)}</h2>${textOf(presentation.understanding) && !sameText(textOf(presentation.understanding), presentation.candidate) ? `<p class="fs-task-intro">${escape(textOf(presentation.understanding))}</p>` : ''}${presentation.candidate ? `<div class="fs-frozen-copy">${proseList(presentation.candidate)}</div>` : `<p class="fs-task-intro">${escape(textOf(presentation.why) || 'No candidate was saved at this step.')}</p>`}${array(presentation.checks).length || typeof presentation.checks === 'string' && presentation.checks ? `<h3>Saved acceptance checks</h3>${proseList(presentation.checks)}` : ''}${versionBasis(presentation, version)}${actions(button(replay ? 'walk-current' : 'current-version', 'Return to current step', { primary: true, arrow: true }))}`;
    }
    if (!flow) return legacyTask(vm, presentation);
    const status = statusFor(vm.current, vm.status);
    const owns = vm.actor === actorName(status.owner);
    const phase = flow.phase;
    const team = vm.actor === 'Website team';
    if (phase === 'published') return `<div class="fs-complete"><span class="fs-complete-mark">${icon('checks', 26)}</span><h2>Version ${Number(caseRecord.rev)} is released in the simulation</h2><p>No further action is needed. You can reopen the result whenever you need it.</p>${actions(button('open-result', 'View result', { primary: true, icon: 'external' }) + button('nav-inbox', 'Back to my feedback', { quiet: true }))}</div>`;
    if (!owns || !team && ['triage', 'question-draft', 'answer-review', 'spec-review', 'candidate', 'checking', 'ready'].includes(phase)) return waiting(vm, caseRecord);
    if (phase === 'question-draft') return questionEditor(flow, vm);
    if (phase === 'awaiting-answer') return `${questionRound(flow)}<h2>${flow.sentBundle?.round === 'detailed' ? 'One detail before we prepare the result' : 'A little context will help'}</h2><p class="fs-task-intro">Your answer helps the team choose the right behavior and the checks used to review it.</p><div class="fs-answer-form">${answerFields(flow.sentBundle?.questions, vm.formDraft?.bundleId === flow.sentBundle?.id ? vm.formDraft.answers || {} : {}, false, vm.formDraft?.bundleId === flow.sentBundle?.id ? vm.formDraft.answerNotes || vm.answerNotes || {} : {})}${actions(button('answer', 'Send answer to the team', { primary: true, arrow: true }))}</div>`;
    if (phase === 'triage' || phase === 'answer-review') {
      if (flow.evidenceFirst && !flow.planPrepared) return evidenceReview(vm, presentation);
      const scope = flow.suggestedScope || flow.scope || {};
      const answer = flow.sentBundle?.round === 'detailed' ? flow.detailedAnswerText : caseRecord.answer;
      if (flow.evidenceFirst) return `<h2>${phase === 'answer-review' ? 'Review the updated plan' : 'Review the draft plan'}</h2><p class="fs-task-intro">Edit the proposed behavior and checks, then share the plan with the requester.</p>${phase === 'answer-review' ? `<blockquote class="fs-request-quote"><span>Latest requester answer</span><p>${escape(answer)}</p></blockquote>${answerImplications(presentation.reasoning, { compact: true, answer })}` : ''}${reasoningRecords(presentation.reasoning, true)}${teamJudgment(presentation.reasoning)}${scope.conflict && !array(presentation.reasoning?.implications).some(impact => impact.conflict === scope.conflict) ? `<p class="fs-conflict">${icon('hold', 16)}${escape(scope.conflict)}</p>` : ''}${array(flow.understandingCorrections).length ? `<blockquote class="fs-request-quote"><span>Requester’s correction</span><p>${escape(flow.understandingCorrections.at(-1).text)}</p></blockquote>` : ''}<div class="fs-scope-form">${textField('approach', 'Proposed behavior', fieldValue(vm, 'approach', scope.approach))}${textField('checks', 'Acceptance checks', fieldValue(vm, 'checks', scope.checks))}<details class="fs-share-message"><summary>Message to the requester ${icon('down', 14)}</summary>${textField('understanding', 'What we’ll share when you confirm', fieldValue(vm, 'understanding', scope.understanding || scope.approach), { rows: 2 })}</details>${actions((phase === 'answer-review' ? '' : button('draft-questions', 'Ask the requester', { quiet: true, icon: 'ask' })) + button('confirm-scope', 'Confirm & share plan', { primary: true, arrow: true }))}</div>`;
      return `<h2>${phase === 'answer-review' ? 'Turn the answer into a clear plan' : 'Review the request and its scope'}</h2><p class="fs-task-intro">${phase === 'answer-review' ? 'The answer may change the approach and acceptance checks. Confirm what applies before sharing the plan.' : 'Check the customer’s request against the available records. Ask only about a decision the requester can make.'}</p>
        ${phase === 'answer-review' ? `<blockquote class="fs-request-quote"><span>Latest requester answer</span><p>${escape(answer)}</p></blockquote>${scope.reason ? `<p class="fs-because">${icon('branch', 14)}${escape(scope.reason)}</p>` : ''}` : `<blockquote class="fs-request-quote"><span>Original request</span><p>${escape(caseRecord.text)}</p></blockquote>`}
        ${scope.conflict ? `<p class="fs-conflict">${icon('hold', 16)}${escape(scope.conflict)}</p>` : ''}
        ${phase === 'triage' ? teamPreparation(vm) : ''}
        ${array(flow.understandingCorrections).length ? `<blockquote class="fs-request-quote"><span>Requester’s correction</span><p>${escape(flow.understandingCorrections.at(-1).text)}</p></blockquote>` : ''}
        <div class="fs-scope-form">${textField('understanding', 'What we’ll share with the requester', fieldValue(vm, 'understanding', scope.understanding || scope.approach), { rows: 2 })}${textField('approach', 'Proposed approach', fieldValue(vm, 'approach', scope.approach))}${textField('checks', 'Acceptance checks', fieldValue(vm, 'checks', scope.checks))}${actions((phase === 'answer-review' ? '' : button('draft-questions', 'Review questions', { quiet: true, icon: 'ask' })) + button('confirm-scope', 'Confirm scope & continue', { primary: true, arrow: true }))}</div>`;
    }
    if (phase === 'spec-review') return `<h2>Confirm the plan is ready</h2><p class="fs-task-intro">This understanding has been shared with the requester. Resolve any remaining business decision before preparing the result.</p><div class="fs-shared-summary"><h3>Shared understanding</h3><p>${escape(flow.sharedUnderstanding?.text)}</p></div><details class="fs-scope-details"><summary>Approach and acceptance checks ${icon('down', 14)}</summary><h3>Proposed approach</h3>${proseList(flow.confirmedScope?.approach || flow.scope?.approach)}<h3>Acceptance checks</h3>${proseList(flow.confirmedScope?.checks || flow.scope?.checks)}</details>${actions(button('begin-detailed-questions', 'Review detailed questions', { quiet: true, icon: 'ask', disabled: array(flow.journey?.detailedSentCycles).includes(flow.journey?.scopeCycle) }) + button('finish-spec', 'Prepare version ' + caseRecord.rev, { primary: true, arrow: true }))}`;
    if (phase === 'candidate' || phase === 'checking' || phase === 'ready') {
      const draft = flow.candidateDraft || {};
      const variants = array(vm.scenario?.variants);
      const authored = vm.scenario?.id && root.FlowScenarios?.preview(vm.scenario.id, { approach: fieldValue(vm, 'approach', draft.approach), checks: fieldValue(vm, 'checks', draft.checks) });
      const selectedVariant = vm.preview?.variantId || authored?.variantId || '';
      const adjustment = array(caseRecord.adjustments).at(-1);
      const canFollowUp = phase === 'candidate' && flow.journey?.enabled && flow.sharedUnderstanding && caseRecord.adjustment && array(caseRecord.versions).at(-1)?.rev === caseRecord.rev - 1 && adjustment?.rev === caseRecord.rev - 1 && adjustment?.text === caseRecord.adjustment;
      return `<h2>${phase === 'ready' ? 'Version ' + caseRecord.rev + ' is ready to review' : 'Prepare version ' + caseRecord.rev}</h2><p class="fs-task-intro">${phase === 'ready' ? 'Open the result, check the behavior, and send this exact version to the requester.' : 'Write the intended behavior and how you’ll check it. Then prepare a result the requester can try.'}</p>${caseRecord.adjustment ? `<blockquote class="fs-request-quote"><span>Changes requested to version ${caseRecord.rev - 1}</span><p>${escape(caseRecord.adjustment)}</p></blockquote>` : ''}
        ${canFollowUp ? `<div class="fs-followup-choice">${button('reopen-clarification', 'Ask a follow-up', { quiet: true, icon: 'ask' })}<p>Need a customer decision? Review and preview a question before sending it.</p></div>` : ''}${phase !== 'ready' ? `${variants.length > 1 ? `<label class="fs-field fs-variant"><span>Supported result</span><select data-wq="select-variant" aria-label="Supported result">${!selectedVariant ? '<option value="" disabled selected>Edited behavior · choose a supported result</option>' : ''}${variants.map(variant => `<option value="${escape(variant.id)}"${selectedVariant === variant.id ? ' selected' : ''}>${escape(variant.title)}</option>`).join('')}</select><small>Choosing another result updates its behavior and checks.</small></label>` : ''}${textField('approach', 'Proposed behavior', fieldValue(vm, 'approach', draft.approach))}${textField('checks', 'Acceptance checks', fieldValue(vm, 'checks', draft.checks))}${actions(button('edit-candidate', 'Save draft') + button('prepare-result', 'Prepare simulated result', { primary: true, arrow: true }))}` : currentResult(vm, caseRecord) + actions(button('edit-candidate', 'Edit candidate', { quiet: true, icon: 'edit' }) + button('deliver', 'Send version ' + caseRecord.rev + ' for review', { primary: true, arrow: true }))}`;
    }
    if (phase === 'review') return `<h2>Does version ${Number(caseRecord.rev)} resolve your feedback?</h2><p class="fs-task-intro">Open the result and try the behavior you asked for. Tell the team if anything still needs to change.</p>${currentResult(vm, caseRecord)}${actions(button('adjust', 'Request changes') + button('accept', 'Accept version ' + caseRecord.rev, { primary: true, icon: 'check' }))}<p class="fs-footnote">Release authorization follows acceptance.</p>`;
    if (phase === 'accepted') return `<h2>Approve version ${Number(caseRecord.rev)} for release</h2><p class="fs-task-intro">The requester accepted this exact version. Review the destination and authorize its simulated release.</p><div class="fs-destination"><span>Release destination</span><strong>${escape(flow.target || 'WinQuote')}</strong></div>${currentResult(vm, caseRecord)}${actions(button('request-release-changes', 'Request a change') + button('authorize', 'Approve simulated release', { primary: true, icon: 'verify' }))}`;
    if (phase === 'authorized') return `<h2>Run the approved release</h2><p class="fs-task-intro">Version ${Number(caseRecord.rev)} has been accepted by the requester and authorized by the site owner.</p><div class="fs-destination"><span>Release destination</span><strong>${escape(flow.target || 'WinQuote')}</strong></div>${actions(button('publish', 'Simulate release', { primary: true, icon: 'release' }) + button('publish-failed', 'Simulate a release failure', { quiet: true }))}`;
    if (phase === 'release-failed') return `<h2>The release needs another attempt</h2><p class="fs-task-intro">${escape(caseRecord.releaseError || flow.releaseError || 'The simulated release could not complete. The accepted version and authorization are still available.')}</p>${actions(button('retry-publish', 'Retry simulated release', { primary: true, icon: 'replay' }) + button('open-result', 'View accepted result', { quiet: true }))}`;
    return waiting(vm, caseRecord);
  }

  function legacyTask(vm, p) {
    const c = vm.current.c;
    const derived = root.CaseEngine?.derive(c) || {};
    const status = statusFor(vm.current, vm.status);
    const owns = vm.actor === actorName(status.owner);
    const quote = `<blockquote class="fs-request-quote"><span>Original feedback</span><p>${escape(c.text)}</p></blockquote>`;
    const checks = p.checks || derived.checks;
    const candidate = p.candidate !== undefined ? p.candidate : derived.candidate;
    const result = candidate ? `<section class="fs-result"><div class="fs-result-heading"><div><h3>Version ${escape(c.rev)}</h3><p>Proposed homepage copy</p></div><span class="fs-version-tag">Simulation</span></div><div class="fs-frozen-copy">${proseList(candidate)}</div><h3>Acceptance checks</h3>${proseList(checks)}</section>` : '';
    if (c.stage === 'published') return `<div class="fs-complete"><span class="fs-complete-mark">${icon('checks', 24)}</span><h2>Version ${escape(c.rev)} is released in the simulation</h2>${result}${actions(button('nav-inbox', 'Back to my feedback', { primary: true }))}</div>`;
    if (!owns) return `<div class="fs-waiting"><span class="fs-waiting-mark">${icon('clock', 22)}</span><h2>${escape(status.label)}</h2><p class="fs-task-intro">${escape(status.next || 'The next step is with ' + actorName(status.owner) + '.')}</p>${result}${delayNotice(status)}<dl class="fs-waiting-details"><div><dt>With</dt><dd>${escape(actorName(status.owner))}</dd></div><div><dt>Last update</dt><dd>${escape(displayTime(status.updatedAt) || 'Time not recorded')}</dd></div><div><dt>Next update</dt><dd>${escape(displayTime(status.nextUpdate) || 'No update time has been set.')}</dd></div></dl>${actions(button('keep-working', 'Keep working') + button('nav-updates', 'View updates', { quiet: true }))}</div>`;
    if (c.stage === 'draft') return `<h2>Submit your feedback</h2>${quote}${actions(button('legacy-submit', 'Submit feedback', { primary: true, arrow: true }))}`;
    if (c.stage === 'clarify') {
      const question = derived.question || p.question || {};
      return `<h2>A little context will help</h2><p class="fs-task-intro">${escape(question.reason || textOf(p.why))}</p><fieldset class="fs-question"><legend>${escape(question.text || 'What would you like the team to change?')}</legend>${array(question.options).length ? `<div class="fs-options">${question.options.map(value => `<label class="fs-option"><input type="radio" name="answer" value="${escape(typeof value === 'string' ? value : value.label)}"><span>${escape(typeof value === 'string' ? value : value.label)}</span></label>`).join('')}</div>` : ''}${textField('answer', 'Your answer', fieldValue(vm, 'answer', ''), { rows: 2 })}</fieldset>${actions(button('legacy-answer', 'Send answer to the team', { primary: true, arrow: true }))}`;
    }
    if (['processing', 'blocked'].includes(c.stage)) return `<h2>Prepare version ${escape(c.rev)}</h2><p class="fs-task-intro">Review the copy and its acceptance checks before sending it.</p>${derived.reason ? `<p class="fs-soft-note">${escape(derived.reason)}</p>` : ''}${quote}${textField('candidate', 'Proposed copy', fieldValue(vm, 'candidate', candidate || ''))}<h3>Acceptance checks</h3>${proseList(checks)}${actions(button('legacy-prepare', 'Save draft & check') + button('legacy-deliver', 'Send version ' + c.rev + ' for review', { primary: true, disabled: Boolean(derived.blocked || !candidate), arrow: true }))}`;
    if (c.stage === 'review') return `<h2>Does version ${escape(c.rev)} resolve your feedback?</h2><p class="fs-task-intro">Review the proposed copy against your request and the acceptance checks.</p>${result}${actions(button('legacy-adjust', 'Request changes') + button('legacy-accept', 'Accept version ' + c.rev, { primary: true, icon: 'check' }))}<p class="fs-footnote">Release authorization follows acceptance.</p>`;
    if (c.stage === 'release') return `<h2>Approve version ${escape(c.rev)} for release</h2><p class="fs-task-intro">The requester accepted this exact version. Authorize its simulated release to ${escape(p.target || 'WinQuote homepage')}.</p>${result}${actions(button('legacy-authorize', 'Approve simulated release', { primary: true, icon: 'verify' }))}`;
    if (c.stage === 'authorized') return `<h2>Run the approved release</h2><p class="fs-task-intro">Version ${escape(c.rev)} has been accepted and authorized for ${escape(p.target || 'WinQuote homepage')}.</p>${result}${actions(button('legacy-publish', 'Simulate release', { primary: true, icon: 'release' }))}`;
    return `<h2>${escape(status.label)}</h2><p class="fs-task-intro">${escape(textOf(p.why) || 'Review the recorded request and its current basis.')}</p>${quote}`;
  }

  function adjustmentEvidence(caseRecord) {
    const evidence = caseRecord.reviewFlow?.adjustmentEvidence;
    if (!evidence) return '';
    const context = evidence.context || {};
    const owner = actorName(evidence.actor) || 'Requester';
    const values = [
      ['Page', context.page || context.route || context.path],
      ['Quote', context.quote || context.quoteId],
      ['Compartment', context.compartment || context.compartmentId],
      ['Reported', displayTime(context.occurredAt)],
      ['Selected area', context.element || context.selection?.label]
    ].filter(([, value]) => value);
    return `<section class="fs-adjustment-basis"><h3>Adjustment to V${escape(evidence.rev)}</h3><span class="fs-owner">${avatar(owner)}${escape(owner)}</span>${caseRecord.adjustment ? `<p>${escape(caseRecord.adjustment)}</p>` : ''}${values.length ? `<dl class="fs-context-values">${values.map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(typeof value === 'object' ? value.label || value.name || '' : value)}</dd></div>`).join('')}</dl>` : ''}${array(evidence.attachments).length ? attachmentRows(evidence.attachments) : ''}<span class="fs-footnote">This evidence belongs to the adjustment.</span></section>`;
  }

  function panelPresentation(vm) {
    if (vm.presentation) return vm.presentation;
    if (root.FeedbackPresentation?.describe) return root.FeedbackPresentation.describe(vm.current, { rev: vm.historyVersion?.rev || vm.historyVersion, actor: vm.actor });
    const c = vm.current?.c || {}, f = c.reviewFlow || {};
    if (vm.historyVersion) return { historical: true, viewedRev: vm.historyVersion.rev || vm.historyVersion, basis: [], request: {}, versions: [] };
    const understanding = f.sharedUnderstanding;
    return { request: { text: c.text, context: vm.current?.ux?.context || f.context, attachments: vm.current?.ux?.attachments }, understanding,
      basis: understanding?.text ? [{ text: understanding.text, status: understanding.needsRevision ? 'Awaiting team review' : 'Shared by the team', source: 'Shared understanding' }] : [],
      answers: array(f.questionRounds), versions: array(c.versions).map(v => ({ rev: v.rev, status: 'Submitted', at: v.at })),
      recordedDecisions: array(f.source?.history), activity: array(c.trail).filter(event => vm.actor === 'Website team' || ['submit', 'send-questions', 'answer', 'confirm-scope', 'correct-understanding', 'deliver', 'adjust', 'accept', 'authorize', 'publish', 'publish-failed', 'retry-publish'].includes(event.action)) };
  }

  function contextRows(context) {
    const rows = Array.isArray(context) ? context.map(row => [row.label, row.value]) : [
      ['Page', context?.page || context?.route || context?.path], ['Quote', context?.quote || context?.quoteId],
      ['Compartment', context?.compartment || context?.compartmentId], ['Selected area', context?.element || context?.selection?.label],
      ['Reported', displayTime(context?.occurredAt)], ['Source', context?.source]
    ];
    return `<dl class="fs-context-values">${rows.filter(([, value]) => value).map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(typeof value === 'object' ? textOf(value) || value.name : value)}</dd></div>`).join('')}</dl>`;
  }

  function attachmentRows(items) {
    return `<div class="fs-evidence-list">${array(items).map(file => {
      const type = file.kind || file.mime || file.type || '';
      const audio = /audio|recording/.test(type);
      const thumbnail = safeMedia(file.thumbnailUrl || (/image/.test(type) ? file.blobUrl : ''));
      const size = Number(file.size || file.bytes);
      const duration = Number(file.duration || file.durationSeconds);
      const meta = [audio ? 'Audio recording' : /image/.test(type) ? 'Image' : file.mime || 'Attachment', size > 0 ? size >= 1048576 ? (size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(size / 1024)) + ' KB' : '', duration > 0 ? Math.floor(duration / 60) + ':' + String(Math.floor(duration % 60)).padStart(2, '0') : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="fs-evidence-row" data-wq="open-attachment" data-value="${escape(file.id || file.attachmentId)}"><span class="fs-evidence-thumb">${thumbnail ? `<img src="${escape(thumbnail)}" alt="" loading="lazy">` : icon(audio ? 'play' : 'attach', 18)}</span><span><strong>${escape(file.name || file.filename || (audio ? 'Audio recording' : 'Attached file'))}</strong><small>${escape(meta)}</small></span>${icon('external', 13)}</button>`;
    }).join('')}</div>`;
  }

  function panelFold(label, count, contents, options = {}) {
    return `<details class="fs-side-fold"${options.open ? ' open' : ''}><summary><span>${escape(label)}</span>${count !== undefined ? `<small class="fs-side-count">${escape(count)}</small>` : ''}${options.hint ? `<small class="fs-side-hint">${escape(options.hint)}</small>` : ''}${icon('down', 13)}</summary><div class="fs-fold-content">${contents}</div></details>`;
  }

  function basisContents(p) {
    const groups = [];
    for (const fact of array(p.basis)) {
      const source = typeof fact.source === 'string' ? { label: fact.source } : fact.source || {};
      const key = JSON.stringify({ source, status: fact.status || '' });
      if (groups.at(-1)?.key === key) groups.at(-1).facts.push(fact);
      else groups.push({ key, source, status: fact.status || '', facts: [fact] });
    }
    if (!groups.length) return `<p class="fs-inspector-empty">${p.historical ? 'No basis was saved with this version.' : 'The team has not confirmed an approach yet.'}</p>`;
    const statusLabels = { 'submitted-snapshot': 'Saved at submission', 'pending-team-review': 'Awaiting team review', 'team-draft': 'Team draft', 'team-confirmed': 'Team confirmed', unconfirmed: 'Not yet confirmed' };
    return groups.map(({ source, status, facts }) => {
      const label = source.label || '';
      const sourceText = source.text && !sameText(source.text, label) && !facts.some(fact => sameText(source.text, textOf(fact))) ? source.text : '';
      const idShown = source.id && [label, sourceText].some(text => String(text).split(/\s+/).includes(String(source.id)));
      const meta = [label, statusLabels[status] || String(status).replace(/[-_]/g, ' ')].filter(Boolean);
      return `<section class="fs-basis-group">${meta.length ? `<div class="fs-basis-provenance">${meta.map(text => `<span>${escape(text)}</span>`).join('')}</div>` : ''}${source.id && !idShown ? `<small class="fs-basis-reference">Reference ${escape(source.id)}</small>` : ''}<ul class="fs-basis-facts">${facts.map(fact => `<li><p>${escape(textOf(fact))}</p></li>`).join('')}</ul>${sourceText ? `<p class="fs-basis-source-text">${escape(sourceText)}</p>` : ''}</section>`;
    }).join('');
  }

  function basisRows(p) {
    return panelFold(p.historical ? 'Version ' + p.viewedRev + ' basis' : 'Current basis', undefined, basisContents(p), { hint: p.historical ? 'Read-only' : '' });
  }

  // The summary is a view of a submitted snapshot, never the latest live answer.
  function versionDecision(p) {
    const reasoning = p.reasoning;
    if (reasoning?.state !== 'submitted' || !p.viewedRev || Number(reasoning.sourceVersion) !== Number(p.viewedRev)) return null;
    const links = array(reasoning.implications).filter(impact => impact.answer);
    const answer = links.find(impact => impact.source?.type !== 'revision-request');
    const change = links.find(impact => impact.source?.type === 'revision-request' && impact.supported && array(impact.behavior).length);
    const impact = answer && answer.supported !== false && !answer.note ? answer : change || answer;
    if (!impact) return null;
    const linked = impact.supported !== false && !impact.note && array(impact.behavior).length > 0;
    // Revision rows describe saved changed lines; their explanatory note is not a mismatch.
    const changeLinked = impact.source?.type === 'revision-request' && impact.supported === true;
    return { impact, linked: linked || changeLinked, rev: p.viewedRev, questionId: linked && impact.source?.type !== 'revision-request' ? impact.source?.id : null };
  }

  function versionFocus(p, full = false) {
    const decision = versionDecision(p);
    if (!decision) return '';
    const { impact, linked, rev } = decision;
    const requestedChange = impact.source?.type === 'revision-request';
    const group = questionGroups(p).find(r => (r.id || r.bundleId) === impact.source?.id);
    const linkedEntry = group?.entries.find(entry => entry.id === impact.source?.answerId);
    const aggregate = !requestedChange && group?.entries.length > 1 && !linkedEntry;
    const answerSummary = aggregate ? group.entries.filter(e=>answeredValue(e.answer)).length + ' answers recorded in Round ' + group.number : full ? textOf(impact.answer) : shortText(textOf(impact.answer),180);
    const sourceLink = linkedEntry ? sourceRecordButton('question',linkedEntry.id,'View source answer') : group ? `<button type="button" class="fs-source-link" data-wq="inspector-list" data-value="questions">View clarification history${icon('next',12)}</button>` : '';
    const points = values => full ? proseList(values) : proseList(array(values).slice(0,1).map(value=>shortText(value,150))) + (array(values).length>1?`<span class="fs-basis-more">${values.length-1} more saved ${values.length===2?'item':'items'}</span>`:'');
    return `<section class="fs-version-focus" aria-label="Version ${escape(rev)} decision basis"><header><h3>Version ${escape(rev)} basis</h3><small>${p.historical ? 'Read-only' : 'Saved at submission'}</small></header>${impact.source?.label ? `<p class="fs-focus-source">${escape(impact.source.label)}</p>` : ''}<dl><div><dt>${requestedChange ? 'Requested change' : linked ? 'Answer used' : 'Recorded answer'}</dt><dd class="fs-focus-answer">${escape(answerSummary)}${sourceLink}</dd></div>${linked ? `<div><dt>Impact</dt><dd>${points(impact.behavior)}</dd></div><div><dt>Acceptance ${array(impact.checks).length === 1 ? 'check' : 'checks'}</dt><dd>${array(impact.checks).length ? points(impact.checks) : '<p>No matching check was saved with this version.</p>'}</dd></div>` : '<div><dt>Relationship needs review</dt><dd>The saved plan is available below. Its effect cannot be attributed to this answer automatically.</dd></div>'}</dl>${!full?sourceRecordButton('basis','version','View full basis'):''}</section>`;
  }

  function activityRows(entries) {
    const sorted = array(entries).slice().sort((a, b) => orderTime(b.at || b.createdAt) - orderTime(a.at || a.createdAt));
    return `<section class="fs-activity" aria-label="Activity history">${sorted.length ? `<ol>${sorted.map(event => {
      const message = event.text || event.message || event.label || event.action;
      const detail = textOf(event.detail);
      return `<li><div>${avatar(event.actor)}<strong>${escape(actorName(event.actor) || 'Website team')}</strong>${event.rev ? `<span class="fs-event-version">V${escape(event.rev)}</span>` : ''}</div><p>${escape(message)}</p>${detail && !sameText(detail, message) ? `<p class="fs-event-detail">${escape(detail)}</p>` : ''}<small>${escape(displayTime(event.at || event.createdAt) || 'Time not recorded')}${event.simulated ? ' · Simulated' : ''}</small></li>`;
    }).join('')}</ol>` : '<p class="fs-inspector-empty">No shared activity has been recorded.</p>'}</section>`;
  }

  const answeredValue = value => Array.isArray(value) ? value.some(answeredValue) : value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '');
  const answerText = value => Array.isArray(value) ? value.map(answerText).join(' · ') : typeof value === 'object' ? textOf(value) : String(value ?? '');
  const shortText = (value, limit = 150) => { const text = String(value || '').replace(/\s+/g, ' ').trim(); return text.length > limit ? text.slice(0, limit - 1) + '…' : text; };
  const answerStatus = entry => entry.status || (answeredValue(entry.answer) ? 'answered' : 'awaiting-answer');
  const statusText = status => ({answered:'Answered',skipped:'Skipped · optional','awaiting-answer':'Awaiting answer','not-recorded':'Answer not recorded'}[status] || 'Answer not recorded');
  function questionGroups(p) {
    const groups = new Map();
    array(p.questionRounds).forEach((round, index) => groups.set(round.id || round.bundleId || 'round-' + index, { ...round, number:index + 1, entries:[] }));
    for (const answer of array(p.answers)) {
      const key = answer.bundleId || answer.id || answer.round || 'initial';
      if (!groups.has(key)) groups.set(key, {id:key,number:groups.size + 1,entries:[]});
    }
    for (const [key, group] of groups) {
      const saved = array(p.answers).filter(answer => (answer.bundleId || answer.id || answer.round || 'initial') === key);
      if (Array.isArray(group.entries) && array(p.questionRounds).find(r => (r.id || r.bundleId) === key)?.entries) {
        group.entries = array(p.questionRounds).find(r => (r.id || r.bundleId) === key).entries.map(entry => ({...entry}));
      } else if (array(group.questions).length) {
        const matched = new Set();
        group.entries = group.questions.map((q, index) => {
          const direct = saved.filter(a => q.id != null && (a.questionId === q.id || a.id === key + ':' + q.id));
          const sameQuestion = saved.filter(a => !matched.has(a) && a.questionId == null && !group.questions.some(other=>other.id != null && a.id === key+':'+other.id) && sameText(textOf(a.question) || a.text, q.text));
          const previous = direct.length === 1 ? direct[0] : sameQuestion.length === 1 && group.questions.filter(other=>sameText(other.text,q.text)).length === 1 ? sameQuestion[0] : {};
          if (saved.includes(previous)) matched.add(previous);
          const answer = Object.prototype.hasOwnProperty.call(previous,'answer') ? previous.answer : group.answers?.[q.id];
          return {...previous,id:key + ':' + (q.id || index),bundleId:key,questionId:q.id || null,question:q.text,type:q.type,required:q.required,answer,note:previous.note || group.answerNotes?.[q.id] || '',status:answeredValue(answer)?'answered':group.answered?(q.required===false?'skipped':'not-recorded'):'awaiting-answer',at:previous.at || group.answeredAt || null,sentAt:group.sentAt || group.at,simulated:previous.simulated ?? group.simulated};
        });
        // Keep ambiguous legacy evidence readable without inventing a question link.
        saved.filter(entry=>!matched.has(entry)).forEach((entry,index)=>group.entries.push({...entry,id:key+':unlinked-'+index,questionId:null,question:entry.question || entry.text || 'Saved answer',unlinked:true,status:answeredValue(entry.answer)?'answered':'not-recorded'}));
      } else group.entries = saved.map((entry,index) => ({...entry,id:entry.id || key + ':' + index}));
      group.entries = group.entries.map(entry => ({...entry,bundleId:key,roundNumber:group.number}));
    }
    return [...groups.values()].filter(group => group.entries.length);
  }
  function linkedImpacts(p, entry) {
    if (p.reasoning?.state !== 'submitted' || Number(p.reasoning.sourceVersion) !== Number(p.viewedRev)) return [];
    if (entry.unlinked) return [];
    return array(p.reasoning.implications).filter(impact => impact.source?.answerId === entry.id && impact.supported && !impact.note && array(impact.behavior).length);
  }
  function sourceRecordButton(kind, id, label, className = '') {
    return `<button type="button" class="fs-source-link ${className}" data-wq="inspector-open" data-kind="${kind}" data-value="${escape(id)}">${escape(label)}${icon('next',12)}</button>`;
  }
  function inspectorSection(title, count, contents, extra = '') {
    return `<section class="fs-index-section"><header><h3>${escape(title)}</h3>${count ? `<span>${escape(count)}</span>` : ''}</header>${extra}${contents}</section>`;
  }
  function viewAll(section, count, label) { return `<button type="button" class="fs-index-more" data-wq="inspector-list" data-value="${section}">View all ${count} ${label}${icon('next',13)}</button>`; }
  function answerContent(entry) {
    if (!answeredValue(entry.answer)) return `<p class="fs-record-empty">${escape(statusText(answerStatus(entry)))}</p>`;
    return Array.isArray(entry.answer) ? `<ul class="fs-record-answers">${entry.answer.map(value=>`<li>${escape(answerText(value))}</li>`).join('')}</ul>` : `<p class="fs-record-answer">${escape(answerText(entry.answer))}</p>`;
  }
  function questionHistory(p, vm, all = false) {
    const groups = questionGroups(p), total = groups.reduce((sum,r)=>sum+r.entries.length,0);
    if (!total) return all ? '<p class="fs-inspector-empty">No clarification questions were saved.</p>' : '';
    if (total === 1 && !all) {
      const entry = groups[0].entries[0], long = answerText(entry.answer).length > 180 || String(entry.question).length > 180 || Boolean(entry.note);
      return inspectorSection('Clarification',answeredValue(entry.answer)?'Answered':'',`<div class="fs-single-answer"><p class="fs-record-question">${escape(shortText(textOf(entry.question) || entry.text,200))}</p>${long ? `<p class="fs-record-answer">${escape(shortText(answerText(entry.answer),180) || statusText(answerStatus(entry)))}</p>` : answerContent(entry)}${sourceRecordButton('question',entry.id,long?'Read full answer':'View record')}</div>`);
    }
    const search = all ? String(vm.inspector?.view?.query || '').toLowerCase().trim() : '';
    let budget = all ? Infinity : 4, shown = 0;
    const content = groups.slice().reverse().map(group => {
      const entries = group.entries.filter(e=>!search || [e.question,e.text,answerText(e.answer),e.note].join(' ').toLowerCase().includes(search)).slice(0,budget);
      budget -= entries.length; shown += entries.length;
      if (!entries.length) return '';
      const answered = group.entries.filter(e=>answeredValue(e.answer)).length, pending = group.entries.filter(e=>answerStatus(e)==='awaiting-answer').length;
      const decision = versionDecision(p), batchUsed = decision?.questionId === (group.id || group.bundleId) && !array(p.reasoning?.implications).some(i=>i.source?.id===(group.id || group.bundleId)&&i.source?.answerId);
      return `<div class="fs-question-group" data-round="${escape(group.id || group.bundleId)}"><header><h4>Round ${group.number}</h4><span>${pending ? pending + ' awaiting answer' : answered + ' answered'}</span></header>${batchUsed?`<small class="fs-batch-relation">Contains an answer used in V${escape(p.viewedRev)}</small>`:''}<ul class="fs-question-index">${entries.map(entry=>`<li><button type="button" class="fs-question-row" data-wq="inspector-open" data-kind="question" data-value="${escape(entry.id)}"><span><strong>${escape(shortText(textOf(entry.question) || entry.text,150))}</strong><span>${escape(shortText(answerText(entry.answer) || statusText(answerStatus(entry)),110))}</span>${entry.unlinked?'<small>Question link unavailable</small>':''}${linkedImpacts(p,entry).length?`<small class="fs-entry-used">Used in V${escape(p.viewedRev)}</small>`:''}</span>${icon('next',13)}</button></li>`).join('')}</ul></div>`;
    }).join('');
    const searchField = all && total > 8 ? `<label class="fs-index-search"><span>Find a question or answer</span><input type="search" data-wq="inspector-search" value="${escape(vm.inspector?.view?.query || '')}" placeholder="Search clarifications"></label>` : '';
    return inspectorSection('Clarifications',total+(groups.some(g=>g.entries.some(e=>e.unlinked))?' records · ':' questions · ')+groups.length+' rounds',`${searchField}${content || '<p class="fs-inspector-empty">No matching questions. Try another word.</p>'}${!all&&total>shown?viewAll('questions',total,'questions'):''}`,all&&p.historical?`<p class="fs-panel-note">Saved with V${escape(p.viewedRev)}. Later answers are not included.</p>`:'');
  }
  function questionDetail(p, id) {
    const group = questionGroups(p).find(round=>round.entries.some(entry=>entry.id===id)),entry=group?.entries.find(entry=>entry.id===id);
    if (!entry) return '<p class="fs-inspector-empty">This question is not part of the selected version.</p>';
    const impacts=linkedImpacts(p,entry),at=entry.answeredAt||entry.at;
    return `<article class="fs-source-record" data-record-id="${escape(entry.id)}"><div class="fs-record-meta"><span>Round ${group.number} · ${escape(statusText(answerStatus(entry)))}</span>${p.historical?`<span>Saved with V${escape(p.viewedRev)}</span>`:''}</div><h3 tabindex="-1" class="fs-record-title">${escape(textOf(entry.question)||entry.text)}</h3><section><h4>Customer’s answer</h4>${entry.unlinked?'<p class="fs-panel-note">This saved answer could not be linked to a specific question. Its original wording is preserved below.</p>':''}${answerContent(entry)}${entry.note?`<h4>Additional detail</h4><p class="fs-record-answer">${escape(entry.note)}</p>`:''}</section>${impacts.map(impact=>`<section class="fs-answer-impact"><h4>Used in V${escape(p.viewedRev)}</h4><dl><div><dt>Impact</dt><dd>${proseList(impact.behavior)}</dd></div><div><dt>Acceptance checks</dt><dd>${array(impact.checks).length?proseList(impact.checks):'No matching check was saved.'}</dd></div></dl></section>`).join('')}${entry.effect?`<section><h4>Recorded impact</h4><p>${escape(textOf(entry.effect))}</p></section>`:''}<dl class="fs-record-provenance"><div><dt>Source</dt><dd>${escape(group.id||entry.bundleId)}${entry.questionId?' / '+escape(entry.questionId):''}</dd></div>${group.scopeCycle?`<div><dt>Scope revision</dt><dd>${escape(group.scopeCycle)}</dd></div>`:''}<div><dt>${answerStatus(entry)==='awaiting-answer'?'Sent':answerStatus(entry)==='answered'?'Answered':'Batch submitted'}</dt><dd>${escape(displayTime(answerStatus(entry)==='awaiting-answer'?entry.sentAt||group.at:at)||'Time not recorded')}</dd></div>${entry.simulated?'<div><dt>Answer type</dt><dd>Simulated answer</dd></div>':''}</dl></article>`;
  }
  function changeRecords(p) {
    const records=array(p.corrections).map((entry,index)=>({...entry,key:'correction:'+entry.id+':'+index,label:'Understanding correction',scope:entry.scopeCycle?'Scope revision '+entry.scopeCycle:'',attachments:array(entry.evidence?.attachments)}));
    if(p.adjustment||p.adjustmentEvidence)records.push({key:'adjustment:'+ (p.adjustmentEvidence?.rev || Number(p.viewedRev||1)-1),label:'Changes requested',text:p.adjustment || 'See the attached adjustment evidence.',scope:p.adjustmentEvidence?.rev?'To V'+p.adjustmentEvidence.rev:'Saved adjustment',evidence:p.adjustmentEvidence,attachments:array(p.adjustmentEvidence?.attachments)});
    return records.reverse();
  }
  function changesIndex(p, all=false) {
    const records=changeRecords(p);if(!records.length)return '';
    return inspectorSection('Changes & corrections',records.length,`<ul class="fs-change-index">${records.slice(0,all?Infinity:3).map(record=>`<li><button type="button" class="fs-question-row" data-wq="inspector-open" data-kind="change" data-value="${escape(record.key)}"><span><strong>${escape(shortText(record.text,130))}</strong><span>${escape([record.label,record.scope].filter(Boolean).join(' · '))}${record.attachments.length?' · '+record.attachments.length+' attachments':''}</span></span>${icon('next',13)}</button></li>`).join('')}</ul>${!all&&records.length>3?viewAll('changes',records.length,'changes'):''}`);
  }
  function changeDetail(p,id) {
    const record=changeRecords(p).find(r=>r.key===id);if(!record)return '<p class="fs-inspector-empty">This update is not part of the selected version.</p>';
    return `<article class="fs-source-record"><div class="fs-record-meta">${escape(record.scope)}${p.historical?' · Saved with V'+escape(p.viewedRev):''}</div><h3 class="fs-record-title" tabindex="-1">${escape(record.label)}</h3><p class="fs-record-answer">${escape(record.text)}</p>${record.evidence?.actor?`<p class="fs-record-meta">${escape(actorName(record.evidence.actor))}</p>`:''}${record.attachments.length?`<section><h4>Attached to this update</h4>${attachmentRows(record.attachments)}</section>`:''}${contextRows(record.evidence?.context)}${record.id?`<p class="fs-record-meta">Source ${escape(record.id)}</p>`:''}</article>`;
  }
  function attachmentsIndex(p,all=false) {
    const files=array(p.request?.attachments);if(!files.length)return '';
    return inspectorSection('Attachments',files.length,`${attachmentRows(files.slice(0,all?Infinity:3))}${!all&&files.length>3?viewAll('attachments',files.length,'attachments'):''}`);
  }
  function versionsIndex(p,all=false) {
    const versions=array(p.versions).slice().sort((a,b)=>Number(b.rev)-Number(a.rev));
    return inspectorSection('Versions',versions.length,`${versionList(versions.slice(0,all?Infinity:4),p)}${!all&&versions.length>4?viewAll('versions',versions.length,'versions'):''}`);
  }
  function inspectorDrill(p,vm) {
    const view=vm.inspector?.view;if(!view)return '';
    const names={questions:'Clarifications',changes:'Changes & corrections',attachments:'Attachments',versions:'Versions'};
    const backLabel=vm.inspector?.backLabel||'Details';
    const back=`<button type="button" class="fs-inspector-back" data-wq="inspector-back">${icon('back',14)}Back to ${escape(backLabel)}</button>`;
    if(view.kind==='basis')return back+versionFocus(p,true);
    if(view.kind==='plan')return back+inspectorSection('Saved plan','V'+p.viewedRev,basisContents(p));
    if(view.kind==='question')return back+questionDetail(p,view.id);
    if(view.kind==='change')return back+changeDetail(p,view.id);
    return back+({questions:()=>questionHistory(p,vm,true),changes:()=>changesIndex(p,true),attachments:()=>attachmentsIndex(p,true),versions:()=>versionsIndex(p,true)}[view.section]?.()||`<p class="fs-inspector-empty">${escape(names[view.section]||'This record')} is unavailable.</p>`);
  }

  function versionList(versions, p) {
    if (!versions.length) return '<p class="fs-inspector-empty">No version has been sent for review.</p>';
    const milestoneLabels = { accepted: 'Accepted', authorized: 'Release approved', released: 'Released' };
    return `${p.historical ? '<p class="fs-panel-note">Statuses below reflect current progress. Each version opens its saved content.</p>' : ''}<div class="fs-version-list">${versions.map(version => {
      const viewing = Number(p.viewedRev) === Number(version.rev) && p.historical;
      const milestones = array(version.statuses).filter(status => milestoneLabels[status]);
      const primary = version.statusKey || milestones.at(-1);
      const earlier = milestones.filter(status => status !== primary);
      return `<button type="button" class="fs-version-row${viewing ? ' fs-version-viewed' : ''}" data-wq="${version.readOnly === false ? 'current-version' : 'view-version'}" data-value="${escape(version.rev)}"${viewing ? ' aria-current="true"' : ''}><span class="fs-version-icon">${icon('file', 15)}</span><span><strong>Version ${escape(version.rev)}${viewing ? '<small>Viewing</small>' : version.current ? '<small>Current</small>' : ''}</strong><span>${escape(version.status || 'Submitted')}</span>${earlier.length ? `<small>${earlier.map(status => milestoneLabels[status]).join(' · ')}</small>` : ''}${version.at ? `<small>${escape(displayTime(version.at))}</small>` : ''}</span>${icon('next', 12)}</button>`;
    }).join('')}</div>`;
  }

  function details(vm) {
    const p = panelPresentation(vm), c = vm.current.c;
    const tab = vm.contextTab === 'activity' ? 'activity' : 'details';
    const request = p.request || {};
    const attachments = array(request.attachments);
    const decisions = array(p.recordedDecisions);
    const evidenceFirst = c.reviewFlow?.evidenceFirst && !p.historical && !vm.historyVersion && !vm.walkHistory?.active;
    const planPending = evidenceFirst && !c.reviewFlow.planPrepared && ['triage', 'question-draft', 'awaiting-answer', 'answer-review'].includes(c.reviewFlow.phase);
    const phase = c.reviewFlow?.phase;
    const liveClarification = !p.historical && !vm.historyVersion && !vm.walkHistory?.active && ['question-draft', 'awaiting-answer', 'answer-review'].includes(phase);
    const shared = Boolean(textOf(p.understanding) || c.reviewFlow?.sharedUnderstanding?.text);
    const requester = vm.actor === 'Requester';
    const reviewState = phase === 'awaiting-answer' ? [requester ? 'Awaiting your answer' : 'Awaiting the customer’s answer', shared ? 'The team will review the answer and revise the shared plan before preparing the result.' : 'The team will use the answer to prepare the plan and review checks.'] : phase === 'question-draft' ? ['Questions under review', requester ? 'The team is reviewing the questions. Nothing has been sent yet.' : 'Review and preview these private questions before sending them.'] : phase === 'answer-review' ? [c.reviewFlow.planPrepared ? 'Updated plan in review' : 'Answer received', c.reviewFlow.planPrepared ? 'The team is checking the updated draft before sharing it.' : 'The team is reviewing how the answer changes the plan and checks.'] : shared ? ['Reviewing the shared plan', 'The shared plan remains on record while the team reviews the new information.'] : ['Evidence for this request', 'The team is reviewing these records before drafting a plan.'];
    const versions = array(p.versions).slice().sort((a, b) => Number(b.rev) - Number(a.rev));
    const heading = `<div class="fs-details-heading"><div class="fs-detail-tabs" role="tablist" aria-label="Feedback context">${['details', 'activity'].map(name => `<button type="button" role="tab" id="fs-tab-${name}" data-wq="context-tab" data-value="${name}" aria-selected="${tab === name}" aria-controls="fs-inspector-content" tabindex="${tab === name ? '0' : '-1'}">${name === 'details' ? 'Details' : 'Activity'}</button>`).join('')}</div>${button('toggle-context', 'Close', { quiet: true, icon: 'cross', className: 'fs-close-details' })}</div>`;
    const focus = versionFocus(p);
    const currentBasis = planPending || liveClarification ? `<section class="fs-basis"><div class="fs-inspector-heading"><h3>${escape(reviewState[0])}</h3></div><p class="fs-inspector-empty">${escape(reviewState[1])}</p></section>${shared && array(p.basis).length ? panelFold('Shared plan so far', p.basis.length, basisContents(p)) : ''}` : focus ? focus + sourceRecordButton('plan','saved','Full saved plan') : basisRows(p);
    const sourceNote = request.source?.note || request.sourceNote;
    const content = tab === 'details' && vm.inspector?.view ? inspectorDrill(p,vm) : tab === 'activity' ? `${p.historical ? `<p class="fs-panel-note">Recorded through version ${escape(p.viewedRev)} submission.</p>` : ''}${activityRows(p.activity)}` : `${currentBasis}${questionHistory(p,vm)}${changesIndex(p)}
      ${panelFold('Original feedback', undefined, `${request.text ? `<blockquote class="fs-original-quote">${escape(request.text)}</blockquote>` : '<p class="fs-inspector-empty">Original feedback was not saved with this version.</p>'}${contextRows(request.context)}${request.source?.id ? contextRows([{label:'Source record',value:request.source.id}]) : ''}${sourceNote ? `<p class="fs-panel-note">${escape(sourceNote)}</p>` : ''}`)}
      ${attachmentsIndex(p)}
      ${decisions.length ? panelFold('Earlier decisions', decisions.length, decisions.map(decision => `<div class="fs-history-event"><span>${escape(displayTime(decision.date || decision.at))}${decision.superseded ? ' · Superseded' : ''}</span><p>${escape(decision.decision || decision.text || decision.summary)}</p>${decision.source ? `<small>${escape(textOf(decision.source))}</small>` : ''}</div>`).join('')) : ''}
      ${versionsIndex(p)}`;
    return `<aside class="fs-details${vm.contextOpen ? ' fs-details-open' : ''}" id="feedback-details" tabindex="-1" aria-label="Feedback ${tab}">${heading}<div id="fs-inspector-content" role="tabpanel" aria-labelledby="fs-tab-${tab}" tabindex="0" class="fs-inspector-panel">${content}</div></aside>`;
  }

  function ticket(vm) {
    const item = vm.current;
    if (!item) return `<div class="fs-empty"><h1>This feedback could not be found</h1><p>Return to your requests to pick up a current conversation.</p>${button('nav-inbox', 'My feedback', { primary: true })}</div>`;
    const status = statusFor(item, vm.status);
    const p = panelPresentation(vm);
    const readonly = p.historical || vm.historyVersion || vm.walkHistory?.active;
    const heading = readonly ? 'Feedback · ' + item.id : titleFor(vm, item);
    const returned = !readonly && (p.returnSummary || vm.returnSummary || item.ux?.sinceLastVisit);
    const stage = {draft:'Report',triage:'Understand','question-draft':'Clarify','awaiting-answer':'Clarify','answer-review':'Understand','spec-review':'Plan',candidate:'Prepare',checking:'Prepare',ready:'Prepare',review:'Review',accepted:'Release',authorized:'Release',published:'Complete','release-failed':'Release'}[status.phase] || 'In progress';
    return `<div class="fs-ticket-layout"><article class="fs-ticket-document"><header class="fs-record-heading">${!readonly ? `<div class="fs-journey-label"><span>Feedback</span>${icon('next', 11)}<span>${escape(stage)}</span></div>` : ''}<h1>${escape(heading)}</h1><div class="fs-record-properties">${readonly ? '<span class="fs-status">Read-only</span>' : badge(status) + '<span class="fs-property-divider"></span><span class="fs-owner">' + avatar(status.owner) + escape(status.owner) + '</span>'}<span class="fs-record-id">${escape(item.id)}</span></div></header>${notice(vm)}${returned ? `<div class="fs-return-summary">${icon('history', 15)}<span><strong>Since your last visit</strong> ${escape(textOf(returned))}</span>${button('dismiss-return-summary', 'Dismiss', { quiet: true, icon: 'cross' })}</div>` : ''}<section class="fs-task" aria-label="${readonly ? 'Saved task' : 'Current task'}">${task(vm)}</section>${!readonly ? `<footer class="fs-record-footer"><span>${icon('clock', 13)}${escape(displayTime(status.updatedAt) || 'Saved on this device')}</span>${status.nextUpdate ? `<span>${status.overdue ? 'Update overdue' : 'Next update'} · ${escape(displayTime(status.nextUpdate))}</span>` : ''}</footer>` : ''}</article>${details(vm)}</div>`;
  }

  function siteKind(vm) {
    const identifier = vm.scenario?.ticketId || vm.scenario?.id || '';
    if (/07-11_001|compartment|panels/.test(identifier)) return 'compartment';
    if (/09-23_001|refrigeration/.test(identifier)) return 'refrigeration';
    return 'pdf';
  }

  function sampleSite(vm) {
    const site = vm.site || {};
    const kind = siteKind(vm);
    const compartment = String(site.compartment || '1');
    const second = compartment === '2';
    const title = site.title || (second ? 'Freezer' : 'Cooler');
    const section = site.section || (kind === 'pdf' ? 'make-pdf' : kind === 'compartment' ? 'panels' : 'refrigeration');
    const pageTitle = section === 'workflow' ? 'Quote workflow' : kind === 'pdf' ? 'Make PDF' : kind === 'compartment' ? 'Configure panels' : 'Refrigeration';
    let content;
    if (section === 'workflow') {
      content = `<div class="fs-site-section"><h2>Your quote is ready for the next step</h2><p>Quote MW-1042 · Walk-in cooler</p><div class="fs-workflow-rows"><div>${icon('checks', 17)}<span>Quote created</span><small>Complete</small></div><div>${icon('file', 17)}<span>Customer PDF</span><small>Generated</small></div><div>${icon('send', 17)}<span>Send quote to customer</span><small>Next</small></div></div>${button('site-back', 'Back to Make PDF', { icon: 'back' })}</div>`;
    } else if (kind === 'pdf') {
      content = `<section class="fs-site-section" data-capture-region="PDF generation"><h2>Customer quote</h2><p>Generate a PDF of this quote to share with your customer.</p><div class="fs-pdf-document"><span class="winquote-symbol" aria-hidden="true"></span><div><h3>Walk-in cooler</h3><p>Customer quote · MW-1042</p><div class="fs-document-lines" aria-hidden="true"><i></i><i></i><i></i></div></div><span class="fs-pdf-label">PDF</span></div>${actions(button('site-make-pdf', 'Generate PDF', { primary: true, icon: 'file' }) + button('site-workflow', 'Go to Workflow', { quiet: true, arrow: true }))}${site.pdfGenerated ? `<p class="fs-site-saved">${icon('check', 15)}PDF saved. You can find it in Workflow.</p>` : ''}</section>`;
    } else if (kind === 'compartment') {
      content = `<section class="fs-site-section" data-capture-region="Compartment panel editor"><div class="fs-site-section-heading"><div><h2>Panel configuration</h2><p>Set up the wall and ceiling panels for each compartment.</p></div><span class="fs-small-status">2 compartments</span></div><div class="fs-compartment-picker" aria-label="Select compartment">${['1', '2'].map(value => `<button type="button" data-wq="site-select-compartment" data-value="${value}" aria-pressed="${value === compartment}">Compartment ${value}<small>${value === '1' ? 'Cooler' : 'Freezer'}</small></button>`).join('')}</div><label class="fs-field"><span>Panel title</span><input data-wq="site-title" name="site-title" value="${escape(title)}"></label><div class="fs-config-table"><div><span>Wall panels</span><strong>${second ? '5' : '4'} in.</strong></div><div><span>Finish</span><strong>White stucco</strong></div><div><span>Ceiling panels</span><strong>${second ? '5' : '4'} in.</strong></div><div><span>Floor</span><strong>${second ? 'Insulated' : 'No floor'}</strong></div></div>${actions(button('site-save', 'Save panels', { primary: true }))}</section>`;
    } else {
      const equipment = site.equipment || 'Rooftop refrigeration unit';
      const cost = site.cost !== undefined && Number.isFinite(Number(site.cost)) ? Number(site.cost) : second ? 3200 : 2400;
      content = `<section class="fs-site-section" data-capture-region="Refrigeration options"><div class="fs-site-section-heading"><div><h2>Refrigeration equipment</h2><p>Compartment ${escape(compartment)} · ${second ? 'Freezer' : 'Cooler'}</p></div><span class="fs-small-status">Demo prices</span></div><label class="fs-refrigeration-option"><input type="checkbox" data-wq="site-no-refrigeration"${site.noRefrigeration ? ' checked' : ''}><span><strong>No Refrigeration Required</strong><small>The customer will supply their own refrigeration.</small></span></label><div class="fs-config-table"><div><span>Selected equipment</span><strong>${escape(equipment)}</strong></div><div><span>Equipment cost</span><strong>$${escape(cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</strong></div></div>${actions(button('site-save', 'Save refrigeration', { primary: true }))}<p class="fs-footnote">Sample quote values are used for this walkthrough.</p></section>`;
    }
    return `<section class="fs-site" data-feedback-surface><div class="fs-site-heading"><div><span class="fs-quote-id">Quote MW-1042</span><h1>${pageTitle}</h1></div><span class="fs-small-status">Simulation</span></div><div class="fs-site-tabs"><span>Quote details</span><span>Compartments</span><span class="fs-site-tab-active">${pageTitle}</span><span>Workflow</span></div>${notice(vm)}${site.notice ? `<p class="fs-site-saved" role="status">${icon('check', 15)}${escape(site.notice)}</p>` : ''}${content}</section>`;
  }

  function demoConsole(vm) {
    const open = vm.console?.open;
    const status = statusFor(vm.current, vm.status);
    const scenario = vm.scenario || scenarioFor(vm);
    const currentRecordChoice = Boolean(vm.current && !vm.current.c?.reviewFlow?.scenarioId);
    const history = vm.walkHistory || {};
    const replay = Boolean(history.active);
    const why = textOf(history.why || vm.presentation?.why || status.why);
    if (!open) {
      const onSite = vm.page === 'site';
      const headline = replay ? 'Replay · Read-only' : !onSite && vm.current ? vm.current.id + ' · ' + actorName(status.owner) : 'Walkthrough';
      const next = replay ? history.label || 'Return to the current step' : onSite ? 'Start with this page' : vm.current ? status.label : '';
      return `<button type="button" class="fs-console-launcher" data-wq="open-console" aria-label="Open walkthrough controls" title="Walkthrough">${icon('play', 14)}<span class="fs-launcher-copy"><strong>${escape(headline)}</strong>${next ? `<small>${escape(next)}</small>` : ''}</span>${vm.console?.playing ? '<small>Playing</small>' : ''}</button>`;
    }
    const playback = replay ? button('walk-current', 'Return to current step', { primary: true, icon: 'next' }) : vm.console?.mode === 'watch' ? button('watch-toggle', vm.console.playing ? 'Pause' : 'Play', { primary: true, icon: vm.console.playing ? 'pause' : 'play' }) + button('watch-next', 'Next', { icon: 'next' }) : button(vm.page === 'site' ? 'open-composer' : 'resume', vm.page === 'site' ? 'Give feedback' : 'Resume task', { primary: true, icon: vm.page === 'site' ? 'plus' : 'next' });
    return `<aside class="fs-console" aria-label="Walkthrough controls"><header><span>${icon('play', 15)}Walkthrough</span>${button('close-console', 'Close', { quiet: true, icon: 'cross' })}</header><div class="fs-console-body">${replay ? `<div class="fs-console-replay"><strong>Read-only replay</strong><span>${escape(history.label || 'Earlier step')}${history.total ? ' · ' + (Number(history.index) + 1) + ' of ' + Number(history.total) : ''}</span></div>` : ''}<label class="fs-console-field"><span>Sample ticket</span><select data-wq="start-scenario" aria-label="Sample ticket"${replay ? ' disabled' : ''}>${currentRecordChoice ? `<option value="" selected disabled>Current feedback · ${escape(vm.presentation?.title || titleFor(vm, vm.current))}</option>` : ''}${array(vm.scenarios).slice(0, 3).map(item => `<option value="${escape(item.id)}"${!currentRecordChoice && item.id === scenario?.id ? ' selected' : ''}>${escape(item.title)}</option>`).join('')}</select></label><div class="fs-console-selects"><label class="fs-console-field"><span>View as</span><select data-wq="change-role" aria-label="View as"${replay ? ' disabled' : ''}>${['Requester', 'Website team', 'Site owner'].map(actor => `<option${actor === vm.actor ? ' selected' : ''}>${actor}</option>`).join('')}</select></label><label class="fs-console-field"><span>Mode</span><select data-wq="change-mode" aria-label="Mode"${replay ? ' disabled' : ''}><option value="practice"${vm.console?.mode !== 'watch' ? ' selected' : ''}>Practice</option><option value="watch"${vm.console?.mode === 'watch' ? ' selected' : ''}>Watch</option></select></label></div><div class="fs-console-progress"><span>${avatar(status.owner)}${escape(status.owner)}</span><strong>${escape(replay ? history.label || status.label : vm.page === 'site' ? 'Report this problem to start the feedback flow.' : status.next || status.label)}</strong></div><p class="fs-console-note">${replay ? 'Earlier steps cannot change the current request.' : vm.console?.mode === 'watch' ? 'Scripted roles · simulated decisions' : 'Practice · you make each decision'}</p><details class="fs-console-why" open><summary>Why this step? ${icon('down', 13)}</summary><p>${escape(why || (vm.page === 'site' ? 'The sample ticket supplies the page context. Every ticket follows the same feedback flow.' : 'The current owner must complete this handoff before the next person can act.'))}</p></details><div class="fs-console-playback">${button('walk-back', 'Back', { icon: 'back', disabled: !history.canBack })}${playback}</div><div class="fs-console-history-controls">${!replay && history.total > 1 ? `<span>${Number(history.total)} saved steps</span>` : ''}${button('walk-restart', 'Restart walkthrough', { quiet: true, icon: 'replay' })}</div><details class="fs-console-tools"><summary>Simulation tools ${icon('down', 13)}</summary>${button('advance-time', 'Advance time', { quiet: true, icon: 'clock', disabled: replay })}${button('simulate-email', 'Preview email update', { quiet: true, icon: 'send', disabled: replay })}${button('set-next-update', 'Set next update', { quiet: true, icon: 'edit', disabled: replay })}${button('legacy-links', 'Earlier demo paths', { quiet: true, icon: 'folder' })}</details></div></aside>`;
  }

  function render(vm) {
    const content = vm.page === 'ticket' ? ticket(vm) : vm.page === 'updates' ? updates(vm) : vm.page === 'site' ? sampleSite(vm) : inbox(vm);
    return `<div class="fs-app">${navigation(vm)}<section class="fs-main">${topbar(vm)}<main class="fs-content" id="feedback-main" tabindex="-1">${content}</main></section>${demoConsole(vm)}</div>`;
  }

  root.FeedbackView = { render, task, questionGroups };
})(globalThis);
