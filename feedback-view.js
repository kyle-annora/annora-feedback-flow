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
  const phases = {
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
    const phase = caseRecord.reviewFlow?.phase || caseRecord.stage || 'triage';
    const fallback = phases[phase] || [actorName(caseRecord.owner) || 'Website team', 'In progress'];
    return { owner: fallback[0], label: fallback[1], phase, ...supplied };
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
    return item?.title || item?.ux?.title || item?.c?.title || scenario?.title || item?.c?.reviewFlow?.title || excerpt || 'Your WinQuote feedback';
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
    return `<header class="fs-topbar"><div class="fs-breadcrumb">${button(isTicket || vm.page === 'site' ? 'back' : 'nav-inbox', isTicket || vm.page === 'site' ? 'Back' : crumb, { quiet: true, icon: isTicket || vm.page === 'site' ? 'back' : 'inbox' })}${isTicket ? `<span class="fs-slash">/</span><span class="fs-ticket-id">${escape(vm.current?.id)}</span>` : ''}</div><div class="fs-top-actions">${isTicket ? button('toggle-context', 'Details', { quiet: true, icon: 'sidebar', controls: 'feedback-details', expanded: vm.contextOpen }) : ''}${button('open-console', 'Walkthrough', { quiet: true, icon: 'play' })}</div></header>`;
  }

  function scenarioCards(vm) {
    return `<section class="fs-scenarios" aria-labelledby="fs-scenario-title"><div class="fs-section-heading"><h2 id="fs-scenario-title">Explore a feedback journey</h2><span>Three real WinQuote cases</span></div><div class="fs-scenario-grid">${array(vm.scenarios).slice(0, 3).map((scenario, index) => `<button type="button" class="fs-scenario" data-wq="start-scenario" data-value="${escape(scenario.id)}"><span class="fs-scenario-icon">${icon(['file', 'folder', 'rulers'][index], 19)}</span><h3>${escape(scenario.title)}</h3><p>${escape(scenario.summary)}</p><span class="fs-scenario-go">Open sample quote ${icon('send', 14)}</span></button>`).join('')}</div></section>`;
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
    return { ...status, next: ux.next || ux.timing?.next || next || '', updatedAt: ux.timing?.updatedAt || ux.updatedAt || '' };
  }

  function inbox(vm) {
    const all = array(vm.items);
    const needsYou = item => ['awaiting-answer', 'review'].includes(item.c?.reviewFlow?.phase);
    const complete = item => item.c?.reviewFlow?.phase === 'published';
    const filter = vm.filter || 'all';
    const query = String(vm.search || '').toLowerCase().trim();
    const filtered = all.filter(item => (filter === 'all' || filter === 'needs-you' && needsYou(item) || filter === 'with-team' && !needsYou(item) && !complete(item) || filter === 'complete' && complete(item)) && (!query || (titleFor(vm, item) + ' ' + item.id + ' ' + item.c?.text).toLowerCase().includes(query)));
    filtered.sort((a, b) => Number(needsYou(b)) - Number(needsYou(a)));
    const filters = [['all', 'All', all.length], ['needs-you', 'Needs you', all.filter(needsYou).length], ['with-team', 'With the team', all.filter(item => !needsYou(item) && !complete(item)).length], ['complete', 'Complete', all.filter(complete).length]];
    return `<section class="fs-inbox"><header class="fs-page-heading"><div><h1>My feedback</h1><p>Your requests, next steps, and the people moving them forward.</p></div>${button('start-scenario', 'Start walkthrough', { value: vm.scenarios?.[0]?.id || 'pdf-open', primary: true, icon: 'play' })}</header>
      ${notice(vm)}
      ${vm.current && !all.some(item => item.id === vm.current.id) ? `<div class="fs-resume">${icon('history', 17)}<span>Continue your current walkthrough.</span>${button('resume', 'Resume', { quiet: true, arrow: true })}</div>` : ''}
      <div class="fs-list-toolbar"><div class="fs-filters" aria-label="Filter feedback">${filters.map(([id, label, count]) => `<button type="button" data-wq="filter-inbox" data-value="${id}" aria-pressed="${id === filter}">${label}<small>${count}</small></button>`).join('')}</div><label class="fs-search">${icon('search', 15)}<input type="search" data-wq="search-inbox" value="${escape(vm.search)}" placeholder="Search feedback" aria-label="Search feedback"></label></div>
      <div class="fs-ticket-list">${filtered.length ? filtered.map(item => {
        const status = entryStatus(item);
        return `<button type="button" class="fs-ticket-row" data-wq="open-ticket" data-value="${escape(item.id)}"><span class="fs-row-icon">${icon(needsYou(item) ? 'ask' : complete(item) ? 'checks' : 'feedback', 18)}</span><span class="fs-row-main"><strong>${escape(titleFor(vm, item))}</strong><span>${escape(status.next || item.ux?.summary || item.c?.text)}</span><small>${escape(item.id)} <span aria-hidden="true">·</span> ${escape(status.owner)}${status.updatedAt ? ' · ' + escape(displayTime(status.updatedAt)) : ''}</small></span>${badge(status)}${icon('next', 14)}</button>`;
      }).join('') : `<div class="fs-empty">${icon(filter === 'all' ? 'feedback' : 'inbox', 24)}<h2>${filter === 'all' && !query ? 'Your feedback starts here' : 'Nothing in this view'}</h2><p>${filter === 'all' && !query ? 'Start from a sample quote, describe what gets in your way, and follow the same request through to a result.' : 'Try a different filter or search.'}</p></div>`}</div>
      ${scenarioCards(vm)}
    </section>`;
  }

  function updates(vm) {
    const list = array(vm.updates);
    return `<section class="fs-inbox fs-updates"><header class="fs-page-heading"><div><h1>Updates</h1><p>Return to the next useful step in each request.</p></div>${list.length ? button('mark-read-all', 'Mark all as read', { quiet: true, icon: 'checks' }) : ''}</header>${notice(vm)}<div class="fs-update-list">${list.length ? list.slice().reverse().map(update => `<button type="button" class="fs-update${!update.read && !update.readAt ? ' fs-unread' : ''}" data-wq="open-update" data-value="${escape(update.id)}"><span class="fs-update-mark">${icon(update.kind === 'review' ? 'verify' : update.kind === 'question' ? 'ask' : 'bell', 17)}</span><span class="fs-row-main"><strong>${escape(update.title || update.label || 'Feedback updated')}</strong><span>${escape(update.body || update.summary || update.text || update.message || '')}</span><small>${escape(update.ticketId || update.recordId || '')}${update.createdAt || update.at ? ' · ' + escape(displayTime(update.createdAt || update.at)) : ''}</small></span>${icon('next', 14)}</button>`).join('') : `<div class="fs-empty">${icon('bell', 24)}<h2>You’re all caught up</h2><p>We’ll show questions, review requests, and release updates here.</p>${button('nav-inbox', 'Back to my feedback', { quiet: true, arrow: true })}</div>`}</div><p class="fs-footnote">Notifications in this workspace are simulated.</p></section>`;
  }

  function textField(name, label, value, options = {}) {
    return `<label class="fs-field"><span>${escape(label)}</span><textarea name="${escape(name)}" rows="${options.rows || 3}" maxlength="16000"${options.required ? ' required' : ''}>${escape(value)}</textarea>${options.hint ? `<small>${escape(options.hint)}</small>` : ''}</label>`;
  }

  function proseList(value, className = '') {
    return `<ul class="fs-prose-list ${escape(className)}">${lines(value).map(line => `<li>${escape(line.replace(/^[-•]\s*/, ''))}</li>`).join('')}</ul>`;
  }

  function actions(content) {
    return `<div class="fs-task-actions">${content}</div>`;
  }

  function questionRound(flow) {
    const detailed = (flow.sentBundle?.round || flow.journey?.activeRound) === 'detailed';
    return `<div class="fs-round"><span>${icon('ask', 14)}${detailed ? 'Detailed decisions' : 'Initial clarification'}</span>${flow.sentBundle?.id ? `<span>${escape(flow.sentBundle.id)}</span>` : ''}${flow.journey?.scopeCycle > 1 ? `<span>Scope revision ${Number(flow.journey.scopeCycle)}</span>` : ''}</div>`;
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
    return `${questionRound(flow)}<h2>Ask only what the requester can answer</h2><p class="fs-task-intro">Review the wording, answer format, and reason for each question. Keep known facts and technical decisions with the team.</p>
      <div class="fs-question-editors">${questions.map((question, index) => `<details class="fs-question-editor" data-question-id="${escape(question.id)}"${question.disposition === 'ask' ? ' open' : ''}><summary><span class="fs-question-number">${index + 1}</span><span>${escape(question.text)}</span><small>${escape({ ask: 'Ask requester', records: 'From records', team: 'Team decision', omit: 'Omitted' }[question.disposition] || 'Draft')}</small>${icon('down', 14)}</summary><div class="fs-question-fields"><label class="fs-field"><span>Question</span><textarea data-field="text" rows="2">${escape(question.text)}</textarea></label><div class="fs-field-pair"><label class="fs-field"><span>Answer type</span><select data-field="type">${[['single', 'Single choice'], ['multi', 'Multiple choice'], ['yes_no', 'Yes / No'], ['text', 'Written answer']].map(([id, label]) => `<option value="${id}"${question.type === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label><label class="fs-field"><span>Resolve with</span><select data-field="disposition">${[['ask', 'Ask requester'], ['records', 'Existing records'], ['team', 'Website team'], ['omit', 'Omit this question']].map(([id, label]) => `<option value="${id}"${question.disposition === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div><label class="fs-field"><span>Options</span><textarea data-field="options" rows="3">${escape(array(question.options).map(option => typeof option === 'string' ? option : option.label || option.text).join('\n'))}</textarea><small>One option per line, for choice questions.</small></label>${selectionRules(question)}<label class="fs-field"><span>Why this answer is needed</span><textarea data-field="reason" rows="2">${escape(question.reason)}</textarea></label><label class="fs-checkbox"><input type="checkbox" data-field="required"${question.required ? ' checked' : ''}>Answer required</label></div></details>`).join('')}</div>
      ${!customerQuestions.length ? '<p class="fs-soft-note">No customer questions are selected. Keep recorded facts and team decisions internal, then return to the scope to continue.</p>' : ''}
      ${flow.questionPreview ? `<section class="fs-question-preview"><div class="fs-section-heading"><h3>What the requester will see</h3><span>Preview · not sent</span></div>${answerFields(flow.questionPreview.questions, {}, true)}</section>` : ''}
      ${actions(button('close-questions', 'Back to scope', { quiet: Boolean(customerQuestions.length), primary: !customerQuestions.length }) + button('add-question', 'Add a question', {quiet: true, icon: 'plus'}) + button('save-questions', 'Save draft') + (flow.questionPreview ? button('send-questions', 'Send questions', { primary: true, arrow: true }) : button('preview-questions', 'Preview questions', { primary: true, disabled: !customerQuestions.length })))}
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
    return `<section class="fs-result"><div class="fs-result-heading"><span class="fs-result-icon">${icon('file', 22)}</span><div><h3>Version ${Number(caseRecord.rev) || 1}</h3><p>${escape(vm.scenario?.title || titleFor(vm, vm.current))}</p></div><span class="fs-version-tag">Simulation</span></div><div class="fs-result-summary">${proseList(proposal)}</div>${available ? button('open-result', 'Open result', { primary: true, icon: 'external' }) : `<p class="fs-soft-note">${escape(vm.preview?.reason || 'Prepare this version to open its result.')}</p>`}<details class="fs-result-checks" open><summary>What to check ${icon('down', 14)}</summary>${proseList(checks)}</details></section>`;
  }

  function waiting(vm, caseRecord) {
    const flow = caseRecord.reviewFlow;
    const status = statusFor(vm.current, vm.status);
    const summary = flow.sharedUnderstanding;
    const freshAnswer = flow.phase === 'answer-review';
    const preparation = vm.current?.ux?.preparation;
    const preparationStage = typeof preparation === 'string' ? preparation : preparation?.stage;
    const preparationLabel = {
      'context-ready': 'Context saved',
      'draft-ready': 'Simulated preparation ready',
      'team-review-pending': 'Ready for the team to review'
    }[preparationStage];
    const preparationNote = flow.phase === 'triage' && preparationLabel ? `<div class="fs-preparation" role="status">${icon('checks', 15)}<div><span>Simulated preparation</span><strong>${escape(preparationLabel)}</strong><p>No question or decision has been sent automatically.</p></div></div>` : '';
    return `<div class="fs-waiting"><span class="fs-waiting-mark">${icon(freshAnswer ? 'checks' : 'clock', 22)}</span><h2>${freshAnswer ? 'Your answer is with the team' : status.owner === 'Site owner' ? 'Your accepted version is awaiting release approval' : status.owner === 'Requester' ? 'The requester is reviewing this step' : status.owner === 'Complete' ? 'This request is complete' : 'The website team has your request'}</h2><p class="fs-task-intro">${escape(status.next || (freshAnswer ? 'The team will review how your answer changes the plan and acceptance checks.' : 'You can keep working. We’ll show the next question or result in Updates.'))}</p>
      ${preparationNote}${delayNotice(status)}
      ${freshAnswer && (flow.detailedAnswerText || caseRecord.answer) ? `<blockquote class="fs-request-quote"><span>Your answer</span><p>${escape(flow.sentBundle?.round === 'detailed' ? flow.detailedAnswerText : caseRecord.answer)}</p></blockquote>` : ''}
      ${summary ? `<div class="fs-shared-summary"><h3>${freshAnswer ? 'Current confirmed understanding' : 'Our understanding'}</h3><p>${escape(summary.text)}</p>${freshAnswer ? '<span class="fs-footnote">Your new answer is under review. The team will confirm the updated plan before preparing the result.</span>' : ''}${summary.needsRevision ? '<span class="fs-footnote">Your correction is awaiting team review.</span>' : vm.actor === 'Requester' && ['spec-review', 'candidate', 'checking', 'ready'].includes(flow.phase) ? button('correct-understanding', 'Correct our understanding', { quiet: true, icon: 'edit' }) : ''}</div>` : ''}
      <dl class="fs-waiting-details"><div><dt>With</dt><dd>${avatar(status.owner)}${escape(status.owner)}</dd></div><div><dt>Last update</dt><dd>${escape(displayTime(status.updatedAt) || 'Request received')}</dd></div><div><dt>Next update</dt><dd>${escape(displayTime(status.nextUpdate) || 'The team will set an update after reviewing the request.')}</dd></div></dl>
      ${['review', 'accepted', 'authorized', 'release-failed'].includes(flow.phase) ? currentResult(vm, caseRecord) : ''}
      ${actions(button('keep-working', 'Keep working', { icon: 'back' }) + button('nav-updates', 'View updates', { quiet: true, icon: 'bell' }))}</div>`;
  }

  function task(vm) {
    const caseRecord = vm.current?.c;
    const flow = caseRecord?.reviewFlow;
    if (!caseRecord || !flow) return `<div class="fs-empty"><h2>This feedback needs a different view</h2><p>Open the earlier demo paths to continue this existing request.</p>${button('legacy-links', 'Open earlier paths', { primary: true })}</div>`;
    const status = statusFor(vm.current, vm.status);
    const owns = vm.actor === actorName(status.owner);
    const phase = flow.phase;
    const team = vm.actor === 'Website team';
    if (vm.historyVersion) {
      const version = typeof vm.historyVersion === 'object' ? vm.historyVersion : array(caseRecord.versions).find(item => item.rev === Number(vm.historyVersion));
      return `<h2>Version ${escape(version?.rev || vm.historyVersion)}</h2><p class="fs-task-intro">A saved delivery and its acceptance criteria.</p><div class="fs-frozen-copy">${proseList(version?.candidate)}</div><h3>Acceptance checks</h3>${proseList(version?.result?.checks || version?.reviewFlow?.candidateDraft?.checks)}${actions(button('current-version', 'Return to current version', { primary: true, arrow: true }))}`;
    }
    if (phase === 'published') return `<div class="fs-complete"><span class="fs-complete-mark">${icon('checks', 26)}</span><h2>Version ${Number(caseRecord.rev)} is released in the simulation</h2><p>No further action is needed. You can reopen the result whenever you need it.</p>${actions(button('open-result', 'View result', { primary: true, icon: 'external' }) + button('nav-inbox', 'Back to my feedback', { quiet: true }))}</div>`;
    if (!owns || !team && ['triage', 'question-draft', 'answer-review', 'spec-review', 'candidate', 'checking', 'ready'].includes(phase)) return waiting(vm, caseRecord);
    if (phase === 'question-draft') return questionEditor(flow, vm);
    if (phase === 'awaiting-answer') return `${questionRound(flow)}<h2>${flow.sentBundle?.round === 'detailed' ? 'One detail before we prepare the result' : 'A little context will help'}</h2><p class="fs-task-intro">Your answer helps the team choose the right behavior and the checks used to review it.</p><div class="fs-answer-form">${answerFields(flow.sentBundle?.questions, vm.formDraft?.bundleId === flow.sentBundle?.id ? vm.formDraft.answers || {} : {}, false, vm.formDraft?.bundleId === flow.sentBundle?.id ? vm.formDraft.answerNotes || vm.answerNotes || {} : {})}${actions(button('answer', 'Send answer to the team', { primary: true, arrow: true }))}</div>`;
    if (phase === 'triage' || phase === 'answer-review') {
      const scope = flow.suggestedScope || flow.scope || {};
      const answer = flow.sentBundle?.round === 'detailed' ? flow.detailedAnswerText : caseRecord.answer;
      return `<h2>${phase === 'answer-review' ? 'Turn the answer into a clear plan' : 'Review the request and its scope'}</h2><p class="fs-task-intro">${phase === 'answer-review' ? 'The answer may change the approach and acceptance checks. Confirm what applies before sharing the plan.' : 'Check the customer’s request against the available records. Ask only about a decision the requester can make.'}</p>
        ${phase === 'answer-review' ? `<blockquote class="fs-request-quote"><span>Latest requester answer</span><p>${escape(answer)}</p></blockquote>${scope.reason ? `<p class="fs-because">${icon('branch', 14)}${escape(scope.reason)}</p>` : ''}` : `<blockquote class="fs-request-quote"><span>Original request</span><p>${escape(caseRecord.text)}</p></blockquote>`}
        ${scope.conflict ? `<p class="fs-conflict">${icon('hold', 16)}${escape(scope.conflict)}</p>` : ''}
        ${array(flow.understandingCorrections).length ? `<blockquote class="fs-request-quote"><span>Requester’s correction</span><p>${escape(flow.understandingCorrections.at(-1).text)}</p></blockquote>` : ''}
        <div class="fs-scope-form">${textField('understanding', 'What we’ll share with the requester', fieldValue(vm, 'understanding', scope.understanding || scope.approach), { rows: 2 })}${textField('approach', 'Proposed approach', fieldValue(vm, 'approach', scope.approach))}${textField('checks', 'Acceptance checks', fieldValue(vm, 'checks', scope.checks))}${actions(button('draft-questions', 'Review questions', { quiet: true, icon: 'ask' }) + button('confirm-scope', 'Confirm scope & continue', { primary: true, arrow: true }))}</div>`;
    }
    if (phase === 'spec-review') return `<h2>Confirm the plan is ready</h2><p class="fs-task-intro">This understanding has been shared with the requester. Resolve any remaining business decision before preparing the result.</p><div class="fs-shared-summary"><h3>Shared understanding</h3><p>${escape(flow.sharedUnderstanding?.text)}</p></div><details class="fs-scope-details"><summary>Approach and acceptance checks ${icon('down', 14)}</summary><h3>Proposed approach</h3>${proseList(flow.confirmedScope?.approach || flow.scope?.approach)}<h3>Acceptance checks</h3>${proseList(flow.confirmedScope?.checks || flow.scope?.checks)}</details>${actions(button('begin-detailed-questions', 'Review detailed questions', { quiet: true, icon: 'ask', disabled: array(flow.journey?.detailedSentCycles).includes(flow.journey?.scopeCycle) }) + button('finish-spec', 'Prepare version ' + caseRecord.rev, { primary: true, arrow: true }))}`;
    if (phase === 'candidate' || phase === 'checking' || phase === 'ready') {
      const draft = flow.candidateDraft || {};
      const variants = array(vm.scenario?.variants);
      const authored = vm.scenario?.id && root.FlowScenarios?.preview(vm.scenario.id, { approach: fieldValue(vm, 'approach', draft.approach), checks: fieldValue(vm, 'checks', draft.checks) });
      const selectedVariant = vm.preview?.variantId || authored?.variantId || '';
      return `<h2>${phase === 'ready' ? 'Version ' + caseRecord.rev + ' is ready to review' : 'Prepare version ' + caseRecord.rev}</h2><p class="fs-task-intro">${phase === 'ready' ? 'Open the result, check the behavior, and send this exact version to the requester.' : 'Write the intended behavior and how you’ll check it. Then prepare a result the requester can try.'}</p>${caseRecord.adjustment ? `<blockquote class="fs-request-quote"><span>Changes requested to version ${caseRecord.rev - 1}</span><p>${escape(caseRecord.adjustment)}</p></blockquote>` : ''}
        ${phase !== 'ready' ? `${variants.length > 1 ? `<label class="fs-field fs-variant"><span>Supported result</span><select data-wq="select-variant" aria-label="Supported result">${!selectedVariant ? '<option value="" disabled selected>Edited behavior · choose a supported result</option>' : ''}${variants.map(variant => `<option value="${escape(variant.id)}"${selectedVariant === variant.id ? ' selected' : ''}>${escape(variant.title)}</option>`).join('')}</select><small>Choosing another result updates its behavior and checks.</small></label>` : ''}${textField('approach', 'Proposed behavior', fieldValue(vm, 'approach', draft.approach))}${textField('checks', 'Acceptance checks', fieldValue(vm, 'checks', draft.checks))}${actions(button('edit-candidate', 'Save draft') + button('prepare-result', 'Prepare simulated result', { primary: true, arrow: true }))}` : currentResult(vm, caseRecord) + actions(button('edit-candidate', 'Edit candidate', { quiet: true, icon: 'edit' }) + button('deliver', 'Send version ' + caseRecord.rev + ' for review', { primary: true, arrow: true }))}`;
    }
    if (phase === 'review') return `<h2>Does version ${Number(caseRecord.rev)} resolve your feedback?</h2><p class="fs-task-intro">Open the result and try the behavior you asked for. Tell the team if anything still needs to change.</p>${currentResult(vm, caseRecord)}${actions(button('adjust', 'Request changes') + button('accept', 'Accept version ' + caseRecord.rev, { primary: true, icon: 'check' }))}<p class="fs-footnote">Release authorization follows acceptance.</p>`;
    if (phase === 'accepted') return `<h2>Approve version ${Number(caseRecord.rev)} for release</h2><p class="fs-task-intro">The requester accepted this exact version. Review the destination and authorize its simulated release.</p><div class="fs-destination"><span>Release destination</span><strong>${escape(flow.target || 'WinQuote')}</strong></div>${currentResult(vm, caseRecord)}${actions(button('request-release-changes', 'Request a change') + button('authorize', 'Approve simulated release', { primary: true, icon: 'verify' }))}`;
    if (phase === 'authorized') return `<h2>Run the approved release</h2><p class="fs-task-intro">Version ${Number(caseRecord.rev)} has been accepted by the requester and authorized by the site owner.</p><div class="fs-destination"><span>Release destination</span><strong>${escape(flow.target || 'WinQuote')}</strong></div>${actions(button('publish', 'Simulate release', { primary: true, icon: 'release' }) + button('publish-failed', 'Simulate a release failure', { quiet: true }))}`;
    if (phase === 'release-failed') return `<h2>The release needs another attempt</h2><p class="fs-task-intro">${escape(caseRecord.releaseError || flow.releaseError || 'The simulated release could not complete. The accepted version and authorization are still available.')}</p>${actions(button('retry-publish', 'Retry simulated release', { primary: true, icon: 'replay' }) + button('open-result', 'View accepted result', { quiet: true }))}`;
    return waiting(vm, caseRecord);
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
    return `<section class="fs-adjustment-basis"><h3>Adjustment to V${escape(evidence.rev)}</h3><span class="fs-owner">${avatar(owner)}${escape(owner)}</span>${caseRecord.adjustment ? `<p>${escape(caseRecord.adjustment)}</p>` : ''}${values.length ? `<dl class="fs-context-values">${values.map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(typeof value === 'object' ? value.label || value.name || '' : value)}</dd></div>`).join('')}</dl>` : ''}${array(evidence.attachments).length ? `<div class="fs-attached-files">${evidence.attachments.map(attachment => `<button type="button" data-wq="open-attachment" data-value="${escape(attachment.id || attachment.attachmentId)}">${icon(attachment.kind === 'audio' ? 'play' : 'attach', 13)}${escape(attachment.name || attachment.filename || 'Attachment')}</button>`).join('')}</div>` : ''}<span class="fs-footnote">This evidence belongs to the adjustment.</span></section>`;
  }

  function details(vm) {
    const item = vm.current;
    const caseRecord = item.c;
    const flow = caseRecord.reviewFlow || {};
    const team = vm.actor === 'Website team';
    const scope = team ? flow.suggestedScope || flow.confirmedScope || flow.scope : flow.sharedUnderstanding;
    const context = item.ux?.context || flow.context || {};
    const attachments = array(item.ux?.attachments);
    const trail = array(caseRecord.trail).filter(entry => team || ['submit', 'send-questions', 'answer', 'confirm-scope', 'correct-understanding', 'deliver', 'adjust', 'accept', 'authorize', 'publish', 'publish-failed', 'retry-publish'].includes(entry.action));
    const activity = `<section class="fs-activity"><h3>Activity</h3>${trail.length ? `<ol>${trail.slice().reverse().map(entry => `<li><div>${avatar(entry.actor)}<strong>${escape(actorName(entry.actor))}</strong></div><p>${escape(entry.text)}</p>${entry.simulated ? '<small>Simulated action</small>' : ''}</li>`).join('')}</ol>` : '<p class="fs-footnote">No activity yet.</p>'}</section>`;
    const tab = vm.contextTab === 'activity' || vm.activityOpen ? 'activity' : 'details';
    const heading = `<div class="fs-details-heading"><div class="fs-detail-tabs"><button type="button" data-wq="details-tab" aria-pressed="${tab === 'details'}">Details</button><button type="button" data-wq="activity" aria-pressed="${tab === 'activity'}">Activity</button></div>${button('toggle-context', 'Close', { quiet: true, icon: 'cross', className: 'fs-close-details' })}</div>`;
    if (tab === 'activity') return `<aside class="fs-details${vm.contextOpen ? ' fs-details-open' : ''}" id="feedback-details" tabindex="-1" aria-label="Feedback activity">${heading}${activity}</aside>`;
    return `<aside class="fs-details${vm.contextOpen ? ' fs-details-open' : ''}" id="feedback-details" tabindex="-1" aria-label="Feedback details">${heading}
      <section class="fs-basis"><h3>Current basis</h3>${flow.sharedUnderstanding?.needsRevision ? '<p class="fs-footnote">A correction is awaiting team review.</p>' : ''}${scope ? `<p>${escape(scope.text || scope.understanding || scope.approach)}</p>${team && scope.reason ? `<p class="fs-basis-reason">${escape(scope.reason)}</p>` : ''}<span class="fs-footnote">${team && flow.suggestedScope ? 'Pending team review' : !team && flow.phase === 'answer-review' ? 'Confirmed basis · new answer under team review' : flow.confirmedScope ? 'Confirmed by the website team' : team ? 'Pending team review' : 'Shared by the website team'}</span>` : `<p>The team is reviewing the original request and the attached context.</p>`}${caseRecord.answer ? `<details class="fs-side-fold"><summary>Latest answer ${icon('down', 13)}</summary><p>${escape(caseRecord.answer)}</p></details>` : ''}</section>
      ${adjustmentEvidence(caseRecord)}
      <details class="fs-side-fold"><summary>Original request ${icon('down', 13)}</summary><p>${escape(caseRecord.text)}</p>${flow.source?.id ? `<span class="fs-footnote">${escape(flow.source.id)}</span>` : ''}${vm.scenario?.sourceNote ? `<p class="fs-footnote">${escape(vm.scenario.sourceNote)}</p>` : ''}${Object.keys(context).length ? `<dl class="fs-context-values">${[['Page', context.page || context.route || context.path], ['Quote', context.quote || context.quoteId], ['Compartment', context.compartment || context.compartmentId], ['Reported', context.occurredAt || item.ux?.timing?.occurredAt], ['Selected area', context.element || context.selection?.label]].filter(([, value]) => value).map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(typeof value === 'object' ? value.label || value.name || '' : value)}</dd></div>`).join('')}</dl>` : ''}${attachments.length ? `<div class="fs-attached-files">${attachments.map(attachment => `<button type="button" data-wq="open-attachment" data-value="${escape(attachment.id)}">${icon(attachment.kind === 'audio' ? 'play' : 'attach', 13)}${escape(attachment.name || attachment.filename || 'Attachment')}</button>`).join('')}</div>` : ''}</details>
      <details class="fs-side-fold"><summary>Versions <span class="fs-side-count">${array(caseRecord.versions).length}</span>${icon('down', 13)}</summary>${array(caseRecord.versions).length ? caseRecord.versions.map(version => button('view-version', 'Version ' + version.rev + ' · submitted', { value: version.rev, quiet: true, icon: 'file' })).join('') : '<p class="fs-footnote">No version has been sent for review yet.</p>'}</details>
      ${array(flow.questionRounds).length ? `<details class="fs-side-fold"><summary>Question rounds ${icon('down', 13)}</summary>${flow.questionRounds.map(round => `<details class="fs-question-history"><summary>${escape(round.round === 'detailed' ? 'Detailed decisions' : 'Initial clarification')} <span>${escape(round.answered ? 'Answered' : 'Sent')}</span></summary>${array(round.questions).map(question => `<p>${escape(question.text)}</p>`).join('')}${round.answerText ? `<blockquote>${escape(round.answerText)}</blockquote>` : ''}</details>`).join('')}</details>` : ''}
      ${team && array(flow.source?.history).length ? `<details class="fs-side-fold"><summary>Recorded decisions ${icon('down', 13)}</summary>${flow.source.history.map(entry => `<div class="fs-history-event"><span>${escape(entry.date)}</span><p>${escape(entry.decision)}</p></div>`).join('')}</details>` : ''}

    </aside>`;
  }

  function ticket(vm) {
    const item = vm.current;
    if (!item) return `<div class="fs-empty"><h1>This feedback could not be found</h1><p>Return to your requests to pick up a current conversation.</p>${button('nav-inbox', 'My feedback', { primary: true })}</div>`;
    const status = statusFor(item, vm.status);
    return `<div class="fs-ticket-layout"><article class="fs-ticket-document"><header class="fs-record-heading"><h1>${escape(titleFor(vm, item))}</h1><div class="fs-record-properties">${badge(status)}<span class="fs-property-divider"></span><span class="fs-owner">${avatar(status.owner)}${escape(status.owner)}</span><span class="fs-record-id">${escape(item.id)}</span></div></header>${notice(vm)}${vm.current.ux?.sinceLastVisit ? `<p class="fs-return-summary">${icon('history', 15)}<span><strong>Since your last visit</strong> ${escape(vm.current.ux.sinceLastVisit)}</span></p>` : ''}<section class="fs-task" aria-label="Current task">${task(vm)}</section><footer class="fs-record-footer"><span>${icon('clock', 13)}${escape(displayTime(status.updatedAt) || 'Saved on this device')}</span>${status.nextUpdate ? `<span>Next update · ${escape(displayTime(status.nextUpdate))}</span>` : ''}</footer></article>${details(vm)}</div>`;
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
    const title = site.title || (second ? 'Section 2' : 'Section 1');
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
    return `<section class="fs-site" data-feedback-surface><div class="fs-site-heading"><div><span class="fs-quote-id">Quote MW-1042</span><h1>${pageTitle}</h1></div><span class="fs-small-status">Simulation</span></div><div class="fs-site-tabs"><span>Quote details</span><span>Compartments</span><span class="fs-site-tab-active">${pageTitle}</span><span>Workflow</span></div>${notice(vm)}${site.notice ? `<p class="fs-site-saved" role="status">${icon('check', 15)}${escape(site.notice)}</p>` : ''}${content}<div class="fs-site-report"><div>${icon('feedback', 19)}<span><strong>Something getting in your way?</strong><small>Send feedback from this page.</small></span></div>${button('open-composer', 'Give feedback', { primary: true, icon: 'plus' })}</div></section>`;
  }

  function demoConsole(vm) {
    const open = vm.console?.open;
    const status = statusFor(vm.current, vm.status);
    const scenario = vm.scenario || scenarioFor(vm);
    if (!open) {
      const onSite = vm.page === 'site';
      const headline = !onSite && vm.current ? vm.current.id + ' · ' + actorName(status.owner) : 'Walkthrough';
      const next = onSite ? 'Start with this page' : vm.current ? status.label : '';
      return `<button type="button" class="fs-console-launcher" data-wq="open-console" aria-label="Open walkthrough controls" title="Walkthrough">${icon('play', 14)}<span class="fs-launcher-copy"><strong>${escape(headline)}</strong>${next ? `<small>${escape(next)}</small>` : ''}</span>${vm.console?.playing ? '<small>Playing</small>' : ''}</button>`;
    }
    return `<aside class="fs-console" aria-label="Walkthrough controls"><header><span>${icon('play', 15)}Walkthrough</span>${button('close-console', 'Close', { quiet: true, icon: 'cross' })}</header><div class="fs-console-body"><label class="fs-console-field"><span>Workflow</span><select data-wq="start-scenario" aria-label="Workflow">${array(vm.scenarios).slice(0, 3).map(item => `<option value="${escape(item.id)}"${item.id === scenario?.id ? ' selected' : ''}>${escape(item.title)}</option>`).join('')}</select></label><div class="fs-console-selects"><label class="fs-console-field"><span>View as</span><select data-wq="change-role" aria-label="View as">${['Requester', 'Website team', 'Site owner'].map(actor => `<option${actor === vm.actor ? ' selected' : ''}>${actor}</option>`).join('')}</select></label><label class="fs-console-field"><span>Mode</span><select data-wq="change-mode" aria-label="Mode"><option value="practice"${vm.console?.mode !== 'watch' ? ' selected' : ''}>Practice</option><option value="watch"${vm.console?.mode === 'watch' ? ' selected' : ''}>Watch</option></select></label></div><div class="fs-console-progress"><span>${avatar(status.owner)}${escape(status.owner)}</span><strong>${escape(vm.page === 'site' ? 'Describe what gets in your way.' : status.next || status.label)}</strong></div><p class="fs-console-note">${vm.console?.mode === 'watch' ? 'Scripted roles · simulated decisions' : 'Practice · you make each decision'}</p><details class="fs-console-why" open><summary>Why this step? ${icon('down', 13)}</summary><p>${escape(status.why || 'Follow the current owner and review what changes before handing the request to the next person.')}</p></details><div class="fs-console-playback">${vm.console?.mode === 'watch' ? button('watch-toggle', vm.console.playing ? 'Pause' : 'Play', { primary: true, icon: vm.console.playing ? 'pause' : 'play' }) : button(vm.page === 'site' ? 'open-composer' : 'resume', vm.page === 'site' ? 'Give feedback' : 'Resume task', { primary: true, icon: vm.page === 'site' ? 'plus' : 'next' })}${vm.console?.mode === 'watch' ? button('watch-next', 'Next', { icon: 'next' }) : ''}</div><details class="fs-console-tools"><summary>Simulation tools ${icon('down', 13)}</summary>${button('advance-time', 'Advance time', { quiet: true, icon: 'clock' })}${button('simulate-email', 'Preview email update', { quiet: true, icon: 'send' })}${button('set-next-update', 'Set next update', { quiet: true, icon: 'edit' })}${button('legacy-links', 'Earlier demo paths', { quiet: true, icon: 'folder' })}</details></div></aside>`;
  }

  function render(vm) {
    const content = vm.page === 'ticket' ? ticket(vm) : vm.page === 'updates' ? updates(vm) : vm.page === 'site' ? sampleSite(vm) : inbox(vm);
    return `<div class="fs-app">${navigation(vm)}<section class="fs-main">${topbar(vm)}<main class="fs-content" id="feedback-main" tabindex="-1">${content}</main></section>${demoConsole(vm)}</div>`;
  }

  root.FeedbackView = { render, task };
})(globalThis);
