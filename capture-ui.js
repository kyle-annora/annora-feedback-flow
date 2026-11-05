/* Pure capture surface. FlowCaptureUI renders HTML; the host owns all actions and state. */
(function(root){
'use strict';

const e=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paths={
  arrow:'<path d="m12 5-7 7 7 7M5 12h14"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  document:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  feedback:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8Z"/>',
  forward:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>'
};
const icon=name=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.document}</svg>`;
const action=(name,label,kind='secondary',extra='')=>`<button type="button" class="capture-button capture-button-${kind}" data-capture="${e(name)}" ${extra}>${e(label)}</button>`;
const whenOptions=[['just-now','Just now'],['earlier-today','Earlier today'],['yesterday','Yesterday'],['not-sure','Not sure']];

function samplePage(small=false){
  return `<div class="capture-paper${small?' capture-paper-small':''}" ${small?'aria-label="Sample page preview"':''}>
    <div class="capture-paper-top"><span class="capture-paper-brand"><span class="capture-w" aria-hidden="true">W</span> WinQuote</span><span>QUOTE</span></div>
    <div class="capture-paper-title"><span class="capture-quote-id">MW-1042</span><h3>Sample walk-in quote</h3></div>
    <div class="capture-paper-rule"></div>
    <div class="capture-paper-details"><span>Document</span><strong>Quote PDF</strong><span>Workspace</span><strong>Demo</strong></div>
    <div class="capture-paper-description"><span>Quote details</span><p>Configuration and pricing are omitted from this sample.</p></div>
    <div class="capture-paper-bottom"><span>Sample document</span><span>1 / 1</span></div>
  </div>`;
}

function updatesPanel(state){
  if(!state.updatesOpen)return '';
  const updates=Array.isArray(state.updates)?state.updates:[];
  return `<section id="capture-updates" class="capture-updates" aria-labelledby="capture-updates-title">
    <header><div><h2 id="capture-updates-title">Updates</h2><p>Demo updates · in this browser</p></div><button type="button" class="capture-icon-button" data-capture="updates" aria-label="Close updates">${icon('close')}</button></header>
    ${updates.length?`<ul>${updates.map(update=>`<li><button type="button" class="capture-update" data-capture="open-update" data-key="${e(update.key)}"><span class="capture-update-copy"><span class="capture-update-meta">${e(update.id)}${update.read?' · Read':' · New'}</span><strong>${e(update.title||'Feedback update')}</strong>${update.owner?`<span class="capture-update-owner">${e(update.owner)}</span>`:''}${update.next?`<span>${e(update.next)}</span>`:''}<span class="capture-update-action">${e(update.label||'Read update')}${icon('forward')}</span></span></button></li>`).join('')}</ul>`:'<div class="capture-updates-empty"><p>No updates yet</p><span>Feedback and review updates will appear here.</span></div>'}
  </section>`;
}

function context(state){
  return `<details class="capture-context" ${state.includePreview?'open':''}><summary><span>Included context</span>${icon('chevron')}</summary><div class="capture-context-body">
    <p>The source page and sample quote are included automatically.</p>
    <dl><div><dt>Source page</dt><dd>WinQuote · Make PDF</dd></div><div><dt>Sample quote</dt><dd>MW-1042</dd></div></dl>
    <label class="capture-preview-option" for="capture-preview"><input type="checkbox" id="capture-preview" name="includePreview" ${state.includePreview?'checked':''}><span>Include sample page preview <small>Optional</small></span></label>
    ${state.includePreview?`<div class="capture-context-preview">${samplePage(true)}</div>`:''}
    <p class="capture-help">All context is simulated. No actual screenshot or logs are captured.</p>
  </div></details>`;
}

function feedbackForm(state){
  const currentWhen=whenOptions.find(([value,label])=>state.when===value||state.when===label)?.[0]||'';
  return `<form id="capture-form" class="capture-form">
    <div class="capture-form-body">
      <p class="capture-panel-intro">Tell the website team what happened or what you’d like to change.</p>
      <div class="capture-field"><div class="capture-field-label"><label for="capture-text">Your feedback</label><button type="button" class="capture-text-button" data-capture="example">Use PDF example</button></div><textarea id="capture-text" name="feedback" rows="5" maxlength="2000" required placeholder="What happened, and what did you expect?">${e(state.text||'')}</textarea><span class="capture-help">Up to 2,000 characters</span></div>
      <div class="capture-field"><label for="capture-when">When did this happen? <span>Optional</span></label><select id="capture-when" name="when"><option value="" ${!currentWhen?'selected':''}>Choose a time</option>${whenOptions.map(([value,label])=>`<option value="${value}" ${currentWhen===value?'selected':''}>${label}</option>`).join('')}</select></div>
      ${context(state)}
    </div>
    <footer class="capture-panel-footer"><button type="submit" class="capture-button capture-button-primary">Submit feedback ${icon('forward')}</button><p>This feedback stays in the demo in this browser.</p></footer>
  </form>`;
}

function receipt(state){
  return `<div class="capture-receipt"><span class="capture-receipt-check">${icon('check')}</span><span class="capture-receipt-id">${e(state.receipt.id||'Feedback submitted')}</span><h3>Website team reviews it next</h3><p>You can keep working.</p><p class="capture-help">Look for demo updates here in this browser.</p><div class="capture-receipt-actions">${action('keep-working','Keep working','primary')}${action('view-feedback','View feedback')}</div><div class="capture-receipt-actions">${action('new-feedback','Report something else')}</div></div>`;
}

function drawer(state){
  if(!state.open)return '';
  return `<aside id="capture-drawer" class="capture-drawer" role="dialog" aria-modal="false" aria-labelledby="capture-drawer-title"><header class="capture-panel-heading"><h2 id="capture-drawer-title">${state.receipt?'Feedback received':'Send feedback'}</h2><button type="button" class="capture-icon-button" data-capture="close" aria-label="Close feedback">${icon('close')}</button></header>${state.receipt?receipt(state):feedbackForm(state)}</aside>`;
}

function render(input={}){
  const state=input||{};
  const count=Math.max(0,Math.floor(Number(state.updatesCount)||0));
  return `<section class="capture-surface${state.open?' capture-is-open':''}" aria-label="WinQuote demo workspace">
    <header class="capture-toolbar"><div class="capture-app-name"><span class="capture-w" aria-hidden="true">W</span><strong>WinQuote</strong><span class="capture-path-divider">/</span><span>Make PDF</span></div><div class="capture-toolbar-actions"><button type="button" class="capture-button capture-button-quiet" data-capture="workspace">${icon('arrow')}<span>Back to workspace</span></button><button type="button" class="capture-button capture-button-secondary capture-updates-launcher" data-capture="updates" aria-expanded="${Boolean(state.updatesOpen)}" ${state.updatesOpen?'aria-controls="capture-updates"':''} aria-label="Updates${count?', '+count+' new':''}">${icon('bell')}<span>Updates</span>${count?`<span class="capture-count" aria-hidden="true">${count>99?'99+':count}</span>`:''}</button></div>${updatesPanel(state)}</header>
    <div class="capture-demo-note">Demo workspace · No live quote</div>
    <div class="capture-layout"><article class="capture-business"><header class="capture-page-heading"><div><p class="capture-quote-id">MW-1042 · Sample walk-in quote</p><h1>Make PDF</h1><p>Prepare the quote document for this walk-in.</p></div><button type="button" class="capture-button capture-button-primary" data-capture="generate">${icon('document')}<span>Generate PDF</span></button></header>
      <section class="capture-document" aria-labelledby="capture-document-title"><header class="capture-document-toolbar"><div>${icon('document')}<h2 id="capture-document-title">Quote PDF</h2></div><span class="capture-document-status${state.generated?' is-ready':''}" role="status">${state.generated?icon('check')+' Sample PDF ready':'Sample document'}</span></header><div class="capture-document-canvas">${samplePage()}</div><footer class="capture-document-footer"><p>${state.generated?'The sample PDF is ready to review.':'Generate a sample PDF to try this step.'}<span>Simulated preview · no file is created</span></p></footer></section>
    </article>${drawer(state)}</div>
    ${!state.open?`<button type="button" class="capture-launcher" data-capture="open" aria-haspopup="dialog">${icon('feedback')}<span>Send feedback</span></button>`:''}
  </section>`;
}

root.FlowCaptureUI={render};
})(globalThis);
