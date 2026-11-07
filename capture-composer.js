/* Resumable, nonmodal feedback composer. The host owns the original ticket and submission boundary. */
(function(root){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const whenLabels={'just-now':'Just now','earlier-today':'Earlier today','not-sure':'Not sure'};
 const paths={image:'M4 4h16v16H4zM4 15l5-5 5 5 3-3 3 3M15.5 8h.01',mic:'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM6 10v1a6 6 0 0 0 12 0v-1M12 17v5m-4 0h8',close:'m6 6 12 12M18 6 6 18',minimize:'M5 12h14',back:'M20 12H5m6-6-6 6 6 6',expand:'M14 4h6v6m-9 3 9-9M11 6H4v14h14v-7',shrink:'M4 14h6v6m-6 0 7-7M14 4h6v6',down:'m7 10 5 5 5-5',camera:'M3 7h4l2-3h6l2 3h4v13H3zM12 9a4 4 0 1 0 .01 0z',crop:'M7 3v14h14M3 7h14v14',feedback:'M4 4h16v12h-9l-5 4v-4H4zM8 8h8m-8 4h5',target:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M12 8a4 4 0 1 0 .1 0z',send:'M4 12h15m-6-6 6 6-6 6'};
 const icon=name=>'<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[name]+'"/></svg>';
 let active=null;
 function contextForAttachments(context={},attachments=[]){
  const result=copy(context),ids=new Set(attachments.filter(a=>a.kind==='image').map(a=>a.id));
  // Capture claims are evidence about a particular attached file, never an unbound page flag.
  delete result.screenCapture;
  const captures=Object.fromEntries(Object.entries(result.screenCaptures||{}).filter(([id,value])=>ids.has(id)&&value&&typeof value==='object'&&!Array.isArray(value)));
  if(Object.keys(captures).length)result.screenCaptures=captures;else delete result.screenCaptures;
  return result;
 }
 function mergePageContext(previous,next){
  if(!next)return copy(previous);
  const result={...copy(next)};
  for(const key of ['ticket','ticketId','revision','scenarioId','selection','screenCaptures'])if(previous[key]!==undefined)result[key]=copy(previous[key]);
  return result;
 }
 function payload(draft){
  const text=String(draft.text||'').trim(),attachments=copy(draft.attachments||[]);
  if(text.length>2000)throw new Error('Keep feedback to 2,000 characters.');
  if(!text&&!attachments.length)throw new Error('Describe the issue, add an image, or record a voice note.');
  return {captureId:draft.captureId,text,occurredAt:whenLabels[draft.when]||'',context:contextForAttachments(draft.context||{},attachments),attachments,...(draft.transcript?.trim()?{transcript:{text:draft.transcript.trim(),source:'requester-written',generated:false}}:{})};
 }
 function canAdd(attachments,kind){if(kind==='image'&&attachments.filter(a=>a.kind==='image').length>=3)throw new Error('You can attach up to 3 images. Remove one before adding another.');}
 function legacyDraftMatches(saved,initial){
  if(saved?.schema!==1||saved.scenarioId!==initial.scenarioId)return false;
  const a=saved.context||{},b=initial.context||{};
  const value=(context,primary,alias)=>String(context[primary]??context[alias]??'').trim();
  // Unbound old drafts are never silently adopted into a named source object.
  if(!value(a,'quote','quoteId')||!value(a,'page','step')||!value(b,'quote','quoteId')||!value(b,'page','step'))return false;
  return [['quote','quoteId'],['compartment','compartmentId'],['page','step']].every(([primary,alias])=>value(a,primary,alias)===value(b,primary,alias));
 }
 function legacyFingerprint(key,draft){
  const source=draft.captureId||JSON.stringify({scenarioId:draft.scenarioId,text:draft.text||'',when:draft.when||'',context:draft.context||{},attachments:(draft.attachments||[]).map(a=>a.id)});
  let hash=2166136261;for(const char of key+'\n'+source){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16);
 }
 async function recordLegacyRecovery(Store,draftKey,recovery){
  if(!recovery?.legacyKey||!recovery.fingerprint)return;
  const key=draftKey+':legacy-recovery',prior=await Store.getDraft(key);
  const imports=Array.isArray(prior?.imports)?prior.imports:[];
  if(imports.some(item=>item.legacyKey===recovery.legacyKey&&item.fingerprint===recovery.fingerprint))return;
  await Store.saveDraft(key,{schema:1,kind:'feedback-draft-migration-receipt',imports:[...imports,{legacyKey:recovery.legacyKey,fingerprint:recovery.fingerprint}],attachments:[]});
 }
 async function recoverDraft(Store,draftKey,legacyKeys,initial){
  const saved=await Store.getDraft(draftKey);
  if(saved?.schema===1&&saved.scenarioId===initial.scenarioId)return {draft:saved,legacyKey:null};
  const keys=[...new Set((Array.isArray(legacyKeys)?legacyKeys:[]).filter(key=>typeof key==='string'&&key&&key!==draftKey))];
  if(!keys.length)return {draft:null,legacyKey:null};
  const receipt=await Store.getDraft(draftKey+':legacy-recovery'),imports=Array.isArray(receipt?.imports)?receipt.imports:[];
  for(const key of keys){
   const legacy=await Store.getDraft(key);
   if(legacyDraftMatches(legacy,initial)){
    const fingerprint=legacyFingerprint(key,legacy);
    if(!imports.some(item=>item.legacyKey===key&&item.fingerprint===fingerprint))return {draft:{...legacy,legacyRecovery:{legacyKey:key,fingerprint}},legacyKey:key};
   }
  }
  return {draft:null,legacyKey:null};
 }
 function open(options={}){
  const doc=root.document,Store=options.store||root.FeedbackMediaStore,Context=root.FeedbackCaptureContext,Media=root.FeedbackCaptureMedia;
  if(!doc||!Store||!Context||!Media)throw new Error('Feedback capture is not available yet. Please reload this page.');
  if(typeof options.onSubmit!=='function')throw new Error('Feedback needs a submission handler.');
  const submitLabel=options.submitLabel||'Send feedback';
  const draftKey=options.draftKey||'feedback-draft:'+String(options.scenarioId||'current');
  if(active?.element.isConnected){if(active.draftKey!==draftKey)throw new Error('Save and close the current feedback draft before switching.');active.restore();return active;}
  const focusBefore=doc.activeElement;
  // Take context before attaching the composer. Never capture our overlay or the presenter console.
  const initialContext=Context.capture({...options.context,scenarioId:options.scenarioId||options.context?.scenarioId});
  let state={schema:1,captureId:'capture-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),scenarioId:options.scenarioId||'',text:String(options.feedback||''),when:'',context:initialContext,attachments:[]};
  let closed=false,minimized=false,gathering=false,expanded=Boolean(options.expanded),restoring=true,processing=0,submitting=false,submitted=false,dirty=false,saveRevision=0,saveTimer=null,saveQueue=Promise.resolve(),mediaQueue=Promise.resolve(),picker=null,viewer=null,missing=new Set();
  const urls=new Map();
  const dialog=doc.createElement('section');dialog.className='feedback-composer'+(options.managedHub?' fc-managed-hub':'')+(expanded?' fc-expanded':'');dialog.dataset.feedbackComposer='true';dialog.dataset.feedbackPrivate='true';dialog.setAttribute('role','region');dialog.setAttribute('aria-labelledby','fc-title');
  dialog.innerHTML=`<button type="button" class="fc-collapsed" data-fc="restore" hidden aria-label="Resume feedback draft">${icon('feedback')}<span><strong class="fc-draft-name">Feedback draft</strong><small class="fc-draft-meta">Saved on this device</small></span>${icon('expand')}</button>
  <form class="fc-form" novalidate><header class="fc-header"><div class="fc-heading">${options.managedHub?'<button type="button" class="fc-icon-button fc-back" data-fc="workspace" aria-label="Back to feedback" title="Back to feedback">'+icon('back')+'</button>':''}<div><h2 id="fc-title">${escape(options.title||'Share feedback')}</h2><p class="fc-destination">${escape(options.context?.ticket||options.context?.ticketId||'WinQuote')}${options.context?.revision?' · V'+escape(options.context.revision):''} · ${options.context?.ticket||options.context?.ticketId?'Update this feedback':'New feedback'}</p></div></div><div class="fc-window-actions"><button type="button" class="fc-icon-button" data-fc="expand" aria-label="${expanded?'Use compact view':'Open feedback in full page'}" title="${expanded?'Compact view':'Open full page'}">${icon(expanded?'shrink':'expand')}</button><button type="button" class="fc-icon-button" data-fc="minimize" aria-label="Minimize feedback" title="Minimize">${icon('minimize')}</button>${options.managedHub?'':'<button type="button" class="fc-icon-button" data-fc="close" aria-label="Save and close feedback" title="Save and close">'+icon('close')+'</button>'}</div></header>
  <div class="fc-body"><p class="fc-intro">${escape(options.description||'Tell us what happened. Keep this page open while you add the details.')}</p><p class="fc-error" role="alert" hidden></p><button type="button" data-fc="discard" class="fc-discard" hidden>Close without saving</button>
  <label class="fc-label" for="fc-text">${escape(options.label||'Your feedback')} <span>Or attach an image / voice note</span></label><textarea id="fc-text" name="feedback" rows="4" maxlength="2000" placeholder="${escape(options.placeholder||'What happened, and what did you expect?')}"></textarea>
  <div class="fc-tools" aria-label="Add supporting material"><details class="fc-capture-tools"${options.allowSelection===false?' hidden':''}><summary>${icon('camera')}<span>Capture context</span>${icon('down')}</summary><div class="fc-capture-options"><button type="button" data-fc="gather" data-mode="element">${icon('target')}<span><strong>Select an element</strong><small>Attach its location and page state</small></span></button><button type="button" data-fc="gather" data-mode="area">${icon('crop')}<span><strong>Capture an area</strong><small>Choose a tab, then crop its image</small></span></button><button type="button" data-fc="gather" data-mode="page">${icon('camera')}<span><strong>Capture this page</strong><small>Choose this tab's visible view</small></span></button></div></details><button type="button" data-fc="images">${icon('image')}<span>Add image</span></button><button type="button" data-fc="record">${icon('mic')}<span>Record voice</span></button></div>
  <input class="fc-file-input" id="fc-images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple tabindex="-1"><input class="fc-file-input" id="fc-audio" type="file" accept="audio/*" tabindex="-1">
  <div class="fc-recording" hidden><span class="fc-recording-label" role="status"></span><div><button type="button" data-fc="stop">Stop recording</button><button type="button" data-fc="cancel-recording">Cancel</button></div></div>
  <div class="fc-attachments" aria-label="Attachments"></div><div class="fc-drop-zone" tabindex="0">Drop or paste an image<span>Up to 3 images · 10 MB each</span></div>
  <details class="fc-audio-help"><summary>Audio options</summary><p>Voice notes stay as audio, up to 2 minutes. No automatic transcription.</p><button type="button" data-fc="audio">Attach an audio file</button></details>
  <details class="fc-timing"><summary>When did it happen? <span>Optional</span></summary><label class="fc-label fc-time-label" for="fc-when">Time of issue</label><select id="fc-when"><option value="">Choose a time</option><option value="just-now">Just now</option><option value="earlier-today">Earlier today</option><option value="not-sure">Not sure</option></select></details>
  <details class="fc-context"><summary>Included page context</summary><div class="fc-context-content"></div><button type="button" data-fc="select">${icon('target')}Select an element</button><p>Page details stay with this draft. Screenshots are added only when you choose to capture or upload one. No source code or browser history is collected.</p></details>
  </div><footer class="fc-footer"><div><span class="fc-save-status" role="status">Opening your draft…</span><button type="button" class="fc-retry" data-fc="retry" hidden>Retry saving</button><small>Saved in this browser’s demo.</small></div><button type="submit" class="fc-primary"><span>${escape(submitLabel)}</span>${icon('send')}</button></footer></form>`;
  doc.body.append(dialog);
  const $=selector=>dialog.querySelector(selector),textField=$('#fc-text'),whenField=$('#fc-when'),submitButton=$('[type=submit]');
  textField.value=state.text;whenField.value=state.when;
  if(options.showTiming===false)$('.fc-timing').hidden=true;
  if(options.allowSelection===false)$('[data-fc="select"]').hidden=true;
  function message(text=''){const el=$('.fc-error');el.textContent=text;el.hidden=!text;if(text&&minimized)renderCollapsed();}
  function saveStatus(text,retry=false){if(closed)return;$('.fc-save-status').textContent=text;$('.fc-retry').hidden=!retry;renderCollapsed();}
  function sync(){state.text=textField.value;state.when=whenField.value;}
  function snapshot(){return copy(state);}
  function refreshButtons(){if(closed)return;const recording=['requesting','recording','stopping'].includes(recorder.state);submitButton.disabled=restoring||processing>0||submitting||submitted||recording||gathering||missing.size>0;submitButton.querySelector('span').textContent=submitting?'Sending…':processing?'Preparing attachment…':submitted?'Sent':submitLabel;for(const el of dialog.querySelectorAll('[data-fc="images"],[data-fc="audio"],[data-fc="select"],[data-fc="gather"],[data-fc="remove"]'))el.disabled=submitting||restoring||recording||processing>0;$('.fc-tools [data-fc="record"]').disabled=submitting||restoring||processing>0||recording;textField.disabled=whenField.disabled=submitting||restoring;for(const el of dialog.querySelectorAll('[data-fc=minimize],[data-fc=close],[data-fc=expand],[data-fc=workspace]'))el.disabled=submitting||gathering;renderCollapsed();}
  function saveDraft(){
   root.clearTimeout(saveTimer);saveTimer=null;if(closed)return saveQueue;
   sync();const value=snapshot(),revision=++saveRevision;dirty=true;saveStatus('Saving on this device…');
   const result=saveQueue.catch(()=>{}).then(async()=>{await Store.saveDraft(draftKey,value);if(value.legacyRecovery)await recordLegacyRecovery(Store,draftKey,value.legacyRecovery);});saveQueue=result;
   result.then(()=>{if(!closed&&revision===saveRevision){dirty=false;saveStatus('Saved on this device');$('[data-fc="discard"]').hidden=true;}},error=>{if(!closed&&revision===saveRevision){dirty=true;saveStatus('Not saved on this device',true);message(error.message);}});return result;
  }
  function queueSave(){sync();dirty=true;++saveRevision;saveStatus('Saving on this device…');root.clearTimeout(saveTimer);saveTimer=root.setTimeout(()=>saveDraft().catch(()=>{}),250);}
  function renderContext(){const c=state.context,s=c.selection;$('.fc-context-content').innerHTML='<dl>'+[['Page',c.page||c.step||'Current demo page'],['Feedback',c.ticket||c.ticketId],['Version',c.revision?'V'+c.revision:undefined],['Quote',c.quote||c.quoteId],['Compartment',c.compartment||c.compartmentId],['Selected element',s?.label],['Screenshots',Object.values(c.screenCaptures||{}).map(value=>value.kind||'Shared tab screenshot').join(' · ')],['State',Object.entries(c.state||{}).map(([key,value])=>key+': '+String(value)).join(' · ')]].filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>'<dt>'+escape(k)+'</dt><dd>'+escape(v)+'</dd>').join('')+'</dl>'+(s?'<button type="button" data-fc="clear-selection">Remove selected area</button>':'');}
  function revoke(id){if(urls.has(id)){root.URL.revokeObjectURL(urls.get(id));urls.delete(id);}}
  function renderAttachments(){if(closed)return;$('.fc-attachments').innerHTML=state.attachments.map(a=>{
   const url=urls.get(a.id),lost=missing.has(a.id);return '<article class="fc-attachment" data-attachment="'+escape(a.id)+'">'+(a.kind==='image'?'<button type="button" class="fc-thumbnail" data-fc="preview" data-id="'+escape(a.id)+'" '+(!url?'disabled':'')+' aria-label="Enlarge '+escape(a.name)+'">'+(url?'<img src="'+escape(url)+'" alt="Attached '+escape(a.name)+'">':'<span>Image unavailable</span>')+'</button>':'')+'<div class="fc-attachment-body"><strong>'+escape(a.name)+'</strong><span>'+escape(lost?'Original missing on this device':a.kind==='image'?'Image · '+(a.size/1024/1024).toFixed(1)+' MB':'Voice note · '+formatTime(a.duration))+'</span>'+(a.kind==='audio'&&url?'<audio controls preload="metadata" src="'+escape(url)+'"></audio>':'')+'</div><button type="button" class="fc-remove" data-fc="remove" data-id="'+escape(a.id)+'" aria-label="Remove '+escape(a.name)+'">Remove</button></article>';
  }).join('');$('.fc-tools [data-fc="record"] span').textContent=state.attachments.some(a=>a.kind==='audio')?'Record again':'Record voice';refreshButtons();}
  function formatTime(seconds=0){return Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');}
  function enqueueFile(file,source='upload',recorded=null,captureContext=null,pageContext=null){
   processing++;refreshButtons();
   const job=mediaQueue.catch(()=>{}).then(async()=>{
    const kind=recorded?'audio':String(file.type||'').startsWith('image/')?'image':'audio';canAdd(state.attachments,kind);
    const info=recorded||await Media.inspect(file);if(closed)return;
    const manifest=await Store.put(file,{kind:info.kind||kind,duration:info.duration,name:recorded?.name||file.name,source});
    if(closed){await Store.remove(manifest.id);return;}
    const old=state.attachments,oldContext=state.context;state.attachments=kind==='audio'?[...old.filter(a=>a.kind!=='audio'),manifest]:[...old,manifest];
    state.context=contextForAttachments({...mergePageContext(oldContext,pageContext),...(captureContext&&kind==='image'?{screenCaptures:{...(oldContext.screenCaptures||{}),[manifest.id]:copy(captureContext)}}:{})},state.attachments);
    try{await saveDraft();}catch(error){state.attachments=old;state.context=oldContext;await Store.remove(manifest.id).catch(()=>{});throw error;}
    urls.set(manifest.id,root.URL.createObjectURL(file));
    if(kind==='audio')for(const a of old.filter(a=>a.kind==='audio')){revoke(a.id);await Store.remove(a.id).catch(()=>{});}
    message();renderAttachments();renderContext();return manifest;
   });
   mediaQueue=job;job.catch(error=>{if(!closed)message(error.message);}).finally(()=>{processing--;refreshButtons();});return job;
  }
  async function removeAttachment(id){if(submitting||processing||restoring||recorder.state!=='idle')return;const old=state.attachments,oldContext=state.context;let saved=false;processing++;refreshButtons();state.attachments=old.filter(a=>a.id!==id);state.context=contextForAttachments(state.context,state.attachments);try{await saveDraft();saved=true;missing.delete(id);revoke(id);await Store.remove(id);message();}catch(error){if(!saved){state.attachments=old;state.context=oldContext;}message(saved?'Removed from this draft. Its local file could not be cleaned up yet.':error.message);}finally{processing--;renderAttachments();renderContext();}}
  const recorder=Media.createRecorder({onState:({state:status,seconds})=>{
   if(closed)return;const active=status!=='idle';$('.fc-recording').hidden=!active;$('.fc-recording-label').textContent=status==='requesting'?'Waiting for microphone permission…':status==='stopping'?'Finishing your recording…':'Recording · '+formatTime(seconds)+' / 2:00';$('[data-fc="stop"]').hidden=status!=='recording';refreshButtons();
  },onComplete:value=>enqueueFile(value.blob,'recording',{kind:'audio',duration:value.duration,name:value.name}).catch(()=>{}),onError:error=>message(error.message)});
  async function startRecord(){message();try{await recorder.start();}catch(error){message(error.message);refreshButtons();}}
  function preview(id){const url=urls.get(id),a=state.attachments.find(x=>x.id===id);if(!url||!a||viewer)return;const imageDialog=doc.createElement('dialog');viewer=imageDialog;imageDialog.className='fc-viewer';imageDialog.innerHTML='<header><strong>'+escape(a.name)+'</strong><button type="button" aria-label="Close image preview">'+icon('close')+'</button></header><img src="'+escape(url)+'" alt="'+escape(a.name)+'">';dialog.append(imageDialog);imageDialog.querySelector('button').onclick=()=>imageDialog.close();imageDialog.addEventListener('cancel',event=>event.stopPropagation());imageDialog.addEventListener('close',()=>{imageDialog.remove();if(viewer===imageDialog)viewer=null;dialog.querySelector('[data-fc="preview"][data-id="'+id+'"]')?.focus();});imageDialog.showModal();}
  function emitState(){
   doc.body.classList.toggle('feedback-compose-open',!closed&&!minimized&&!gathering);
   doc.body.classList.toggle('feedback-compose-minimized',!closed&&minimized);
   root.dispatchEvent(new CustomEvent('feedback-composer-state',{detail:{open:!closed,minimized:!closed&&minimized,gathering:!closed&&gathering,expanded,draftKey}}));
  }
  function renderCollapsed(){
   if(closed)return;
   const count=state.attachments.length,ticket=state.context.ticket||state.context.ticketId;
   $('.fc-draft-name').textContent=ticket?'Update '+ticket:'Feedback draft';
   $('.fc-draft-meta').textContent=[$('.fc-error')?.hidden===false?'Needs attention':dirty?'Saving…':'Saved',count?count+' attachment'+(count===1?'':'s'):state.context.selection?'Element selected':'Continue writing'].join(' · ');
  }
  function focusTrigger(){if(focusBefore?.isConnected&&!focusBefore.closest('[inert]'))focusBefore.focus({preventScroll:true});else doc.querySelector('[data-wq="open-composer"]')?.focus({preventScroll:true});}
  function setExpanded(value){
   if(closed)return false;
   const next=Boolean(value),changed=next!==expanded,body=$('.fc-body'),scroll=body?.scrollTop||0;
   expanded=next;dialog.classList.toggle('fc-expanded',expanded);
   const control=$('[data-fc="expand"]');
   if(control){control.innerHTML=icon(expanded?'shrink':'expand');control.setAttribute('aria-label',expanded?'Use compact view':'Open feedback in full page');control.title=expanded?'Compact view':'Open full page';}
   if(body)body.scrollTop=scroll;
   emitState();if(changed)options.onExpand?.(expanded);return true;
  }
  async function backToFeedback(){if(closed||submitting||gathering)return;await minimize();if(!closed&&minimized){try{await options.onWorkspace?.();}catch(error){if(!closed){restore();message(error.message||'Your feedback is still open. Try again.');}}}}
  function restore(){if(closed)return;minimized=false;dialog.hidden=false;dialog.classList.remove('fc-minimized');$('.fc-form').hidden=false;$('.fc-collapsed').hidden=true;dialog.setAttribute('aria-labelledby','fc-title');emitState();if(!restoring&&!gathering)textField.focus({preventScroll:true});}
  async function minimize(){
   if(closed||submitting||gathering)return;
   if(['recording','stopping'].includes(recorder.state)){try{await recorder.stop();await mediaQueue;}catch(error){message(error.message);return;}}else recorder.cancel();
   try{if(restoring)await ready;await mediaQueue.catch(()=>{});await saveDraft();}catch(error){message(error.message);return;}
   if(closed)return;minimized=true;$('.fc-form').hidden=true;$('.fc-collapsed').hidden=Boolean(options.managedHub);dialog.hidden=Boolean(options.managedHub);dialog.classList.add('fc-minimized');dialog.removeAttribute('aria-labelledby');dialog.setAttribute('aria-label','Saved feedback draft');renderCollapsed();emitState();focusTrigger();
  }
  function selectElement(){
   if(closed||submitting||options.allowSelection===false)return;
   let pageContext,selectionRoot;
   try{const fresh=options.getContext?.();pageContext=fresh?Context.capture(fresh):null;selectionRoot=typeof options.selectionRoot==='function'?options.selectionRoot():options.selectionRoot;}catch(error){message(error.message||'This source page is no longer available. Return to it before selecting an element.');return;}
   sync();saveDraft().catch(()=>{});dialog.hidden=true;gathering=true;emitState();refreshButtons();
   const back=()=>{if(closed)return;gathering=false;dialog.hidden=false;restore();renderContext();refreshButtons();$('.fc-context').open=true;$('[data-fc="select"]').focus();};
   try{picker=Context.pick({root:selectionRoot,onSelect:selected=>{picker=null;try{if(pageContext)state.context=mergePageContext(state.context,pageContext);state.context.selection=selected;back();saveDraft().catch(()=>{});}catch(error){back();message(error.message);}},onCancel:()=>{picker=null;back();}});}catch(error){back();message(error.message);}
  }
  async function gather(mode){
   if(closed||submitting||processing||gathering||recorder.state!=='idle')return;
   restore();message();
   if(options.allowSelection===false)return;
   if(mode==='element'){await ready;if(!closed)selectElement();return;}
   if(!['area','page'].includes(mode))return;
   // Invoke the browser permission request before the first await, inside the click gesture.
   gathering=true;emitState();refreshButtons();
   try{
    if(typeof Context.captureImage!=='function')throw new Error('Screen capture is unavailable. Use Add image to attach a screenshot.');
    const fresh=options.getContext?.(),pageContext=fresh?Context.capture(fresh):null;
    const captured=Context.captureImage({mode});
    const result=await captured;await ready;if(!result||closed)return;
    await enqueueFile(result.file,'screen-capture',null,result.context,pageContext);renderContext();
   }catch(error){if(!closed)message(error.message||'The image could not be captured. Use Add image instead.');}
   finally{gathering=false;if(!closed){refreshButtons();restore();}else emitState();}
  }
  async function submit(){
   if(submitting||submitted||restoring||processing||recorder.state!=='idle')return;
   sync();let value;try{value=payload(state);if(missing.size)throw new Error('Remove the unavailable attachment or add it again.');}catch(error){message(error.message);return;}
   submitting=true;message();refreshButtons();
   try{
    await saveDraft();await Store.claim(value.attachments.map(a=>a.id),value.captureId);
    await options.onSubmit(value);submitted=true;
    // Host success is the boundary. Evidence remains pinned even when the draft is removed.
    try{await Store.clearDraft(draftKey);}catch(error){message('Feedback was sent, but this device could not clear its saved draft. You can close this window.');saveStatus('Feedback sent · draft cleanup needs retry',true);return;}
    cleanup(true);
   }catch(error){message(error.message||'Feedback could not be sent. Your draft is still here.');}
   finally{submitting=false;refreshButtons();}
  }
  function cleanup(success=false){
   if(closed)return;closed=true;active=null;emitState();root.clearTimeout(saveTimer);recorder.destroy();picker?.cancel();viewer?.close();for(const audio of dialog.querySelectorAll('audio')){audio.pause();audio.removeAttribute('src');audio.load();}for(const id of urls.keys())revoke(id);doc.removeEventListener('visibilitychange',onVisibility);doc.removeEventListener('keydown',onKeyDown);root.removeEventListener('pagehide',onPageHide);dialog.remove();focusTrigger();options.onClose?.({submitted:success||submitted,draftKey});
  }
  async function close(){if(closed)return true;if(submitting||gathering)return false;if(['recording','stopping'].includes(recorder.state)){await recorder.stop().catch(error=>message(error.message));await mediaQueue.catch(()=>{});}else recorder.cancel();if(submitted){await Store.clearDraft(draftKey).catch(()=>{});cleanup(true);return true;}try{if(restoring)await ready;await mediaQueue.catch(()=>{});await saveDraft();cleanup();return true;}catch(error){message(error.message+' Your latest changes are not saved. Retry saving, or copy your text before closing.');$('[data-fc="discard"]').hidden=false;return false;}}
  function onVisibility(){if(doc.hidden&&recorder.state==='recording')recorder.stop().catch(error=>message(error.message));}
  function onPageHide(){recorder.cancel();root.clearTimeout(saveTimer);if(!closed)saveDraft().catch(()=>{});}
  function onKeyDown(event){if(event.key==='Escape'&&!minimized&&!gathering&&!viewer&&dialog.contains(event.target)){event.preventDefault();event.stopPropagation();minimize();}}
  doc.addEventListener('keydown',onKeyDown);
  dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();submit();});
  dialog.addEventListener('input',event=>{if(event.target===textField)queueSave();});
  whenField.addEventListener('change',queueSave);
  dialog.addEventListener('click',event=>{const b=event.target.closest('[data-fc]');if(!b||b.disabled)return;const action=b.dataset.fc;event.preventDefault();if(action==='close')(options.managedHub?minimize():close());else if(action==='workspace')return backToFeedback();else if(action==='minimize')minimize();else if(action==='expand')setExpanded(!expanded);else if(action==='restore')restore();else if(action==='discard')cleanup();else if(action==='images')$('#fc-images').click();else if(action==='audio')$('#fc-audio').click();else if(action==='record')startRecord();else if(action==='stop')recorder.stop().catch(error=>message(error.message));else if(action==='cancel-recording')recorder.cancel();else if(action==='remove')removeAttachment(b.dataset.id);else if(action==='preview')preview(b.dataset.id);else if(action==='select')gather('element');else if(action==='gather'){const menu=$('.fc-capture-tools');if(menu)menu.open=false;gather(b.dataset.mode);}else if(action==='clear-selection'){delete state.context.selection;renderContext();saveDraft().catch(()=>{});}else if(action==='retry'){if(submitted)Store.clearDraft(draftKey).then(()=>cleanup(true),error=>message(error.message));else saveDraft().catch(()=>{});}});
  $('.fc-drop-zone').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&!$('[data-fc="images"]').disabled){event.preventDefault();$('#fc-images').click();}});
  for(const id of ['#fc-images','#fc-audio'])$(id).addEventListener('change',event=>{for(const file of event.target.files||[])enqueueFile(file,'upload').catch(()=>{});event.target.value='';});
  dialog.addEventListener('paste',event=>{const files=[...(event.clipboardData?.items||[])].filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);if(files.length){event.preventDefault();for(const file of files)enqueueFile(file,'paste').catch(()=>{});}});
  dialog.addEventListener('dragover',event=>{if(event.dataTransfer?.types.includes('Files')){event.preventDefault();dialog.classList.add('fc-dragging');}});
  dialog.addEventListener('dragleave',event=>{if(!dialog.contains(event.relatedTarget))dialog.classList.remove('fc-dragging');});
  dialog.addEventListener('drop',event=>{event.preventDefault();dialog.classList.remove('fc-dragging');for(const file of event.dataTransfer?.files||[])enqueueFile(file,'drop').catch(()=>{});});
  doc.addEventListener('visibilitychange',onVisibility);root.addEventListener('pagehide',onPageHide);
  const ready=(async()=>{
   try{const recovered=await recoverDraft(Store,draftKey,options.legacyDraftKeys,state),saved=recovered.draft;if(closed)return;if(saved){state={...state,...saved};state.context=contextForAttachments(state.context,state.attachments);textField.value=state.text;whenField.value=state.when;for(const a of state.attachments){try{const media=await Store.get(a.id);if(closed)return;urls.set(a.id,root.URL.createObjectURL(media.blob));}catch{missing.add(a.id);}}if(missing.size)message('An attachment is no longer on this device. Remove it or add the original again.');}await saveDraft();}
   catch(error){if(!closed){message(error.message);saveStatus('Not saved on this device',true);}}
   finally{restoring=false;if(!closed){renderContext();renderAttachments();refreshButtons();if(!gathering&&!minimized)textField.focus();}}
  })();
  renderContext();refreshButtons();emitState();
  active={ready,close,setExpanded,draftKey,allowSelection:options.allowSelection!==false,get status(){return {minimized,gathering,expanded,submitting,restoring,closed};},restore,minimize,gather,destroy:()=>cleanup(),getDraft:()=>{if(!closed)sync();return snapshot();},element:dialog};if(options.initialGather)void gather(options.initialGather);return active;
 }
 const api={open,payload,canAdd,contextForAttachments,mergePageContext,legacyDraftMatches,recoverDraft,recordLegacyRecovery};root.FeedbackComposer=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
