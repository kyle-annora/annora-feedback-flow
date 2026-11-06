/* Independent feedback dialog; host owns ticket creation and never shares its business DOM. */
(function(root){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const whenLabels={'just-now':'Just now','earlier-today':'Earlier today','not-sure':'Not sure'};
 let active=null;
 function payload(draft){
  const text=String(draft.text||'').trim(),attachments=copy(draft.attachments||[]);
  if(text.length>2000)throw new Error('Keep feedback to 2,000 characters.');
  if(!text&&!attachments.length)throw new Error('Describe the issue, add an image, or record a voice note.');
  return {captureId:draft.captureId,text,occurredAt:whenLabels[draft.when]||'',context:copy(draft.context||{}),attachments,...(draft.transcript?.trim()?{transcript:{text:draft.transcript.trim(),source:'requester-written',generated:false}}:{})};
 }
 function canAdd(attachments,kind){if(kind==='image'&&attachments.filter(a=>a.kind==='image').length>=3)throw new Error('You can attach up to 3 images. Remove one before adding another.');}
 function open(options={}){
  if(active?.element.isConnected){active.element.focus();return active;}
  const doc=root.document,Store=options.store||root.FeedbackMediaStore,Context=root.FeedbackCaptureContext,Media=root.FeedbackCaptureMedia;
  if(!doc||!Store||!Context||!Media)throw new Error('Feedback capture is not available yet. Please reload this page.');
  if(typeof options.onSubmit!=='function')throw new Error('Feedback needs a submission handler.');
  const submitLabel=options.submitLabel||'Send feedback';
  const draftKey=options.draftKey||'feedback-draft:'+String(options.scenarioId||'current');
  const focusBefore=doc.activeElement;
  // Take context before attaching the composer. Never capture our overlay or the presenter console.
  const initialContext=Context.capture({...options.context,scenarioId:options.scenarioId||options.context?.scenarioId});
  let state={schema:1,captureId:'capture-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),scenarioId:options.scenarioId||'',text:String(options.feedback||''),when:'',context:initialContext,attachments:[]};
  let closed=false,restoring=true,processing=0,submitting=false,submitted=false,dirty=false,saveRevision=0,saveTimer=null,saveQueue=Promise.resolve(),mediaQueue=Promise.resolve(),picker=null,viewer=null,missing=new Set();
  const urls=new Map();
  const dialog=doc.createElement('dialog');dialog.className='feedback-composer';dialog.dataset.feedbackComposer='true';dialog.dataset.feedbackPrivate='true';dialog.setAttribute('aria-labelledby','fc-title');
  dialog.innerHTML=`<form class="fc-form" novalidate><header class="fc-header"><div><span class="fc-eyebrow">WinQuote · Feedback</span><h2 id="fc-title">${escape(options.title||'What got in your way?')}</h2></div><button type="button" class="fc-icon-button" data-fc="close" aria-label="Close feedback">×</button></header>
  <div class="fc-body"><p class="fc-intro">${escape(options.description||'Show us the issue. The website team will work out the solution.')}</p><p class="fc-error" role="alert" hidden></p><button type="button" data-fc="discard" class="fc-discard" hidden>Close without saving</button>
  <label class="fc-label" for="fc-text">${escape(options.label||'Your feedback')} <span>Optional with an attachment</span></label><textarea id="fc-text" name="feedback" rows="4" maxlength="2000" placeholder="${escape(options.placeholder||'What happened, and what did you expect?')}"></textarea>
  <div class="fc-tools"><button type="button" data-fc="images">Add images</button><button type="button" data-fc="record">Record voice</button><button type="button" data-fc="select">Select an area</button></div>
  <input class="fc-file-input" id="fc-images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple tabindex="-1"><input class="fc-file-input" id="fc-audio" type="file" accept="audio/*" tabindex="-1">
  <div class="fc-recording" hidden><span class="fc-recording-label" role="status"></span><div><button type="button" data-fc="stop">Stop recording</button><button type="button" data-fc="cancel-recording">Cancel</button></div></div>
  <div class="fc-attachments" aria-label="Attachments"></div><div class="fc-drop-zone" tabindex="0">Drop images here, or paste an image.<span>Up to 3 images · 10 MB each</span></div>
  <div class="fc-audio-help"><span>Voice notes stay as audio. No automatic transcription.</span><button type="button" data-fc="audio">Attach audio instead</button><span>Up to 2 minutes</span></div>
  <label class="fc-label fc-time-label" for="fc-when">When did it happen? <span>Optional</span></label><select id="fc-when"><option value="">Choose a time</option><option value="just-now">Just now</option><option value="earlier-today">Earlier today</option><option value="not-sure">Not sure</option></select>
  <details class="fc-context"><summary>Included page context</summary><div class="fc-context-content"></div><p>Selected demo context only. No screenshot, source code or browser activity is collected.</p></details>
  </div><footer class="fc-footer"><div><span class="fc-save-status" role="status">Opening your local draft…</span><button type="button" class="fc-retry" data-fc="retry" hidden>Retry saving</button><small>This feedback and its files stay in this browser’s demo.</small></div><button type="submit" class="fc-primary">Send feedback</button></footer></form>`;
  doc.body.append(dialog);
  const $=selector=>dialog.querySelector(selector),textField=$('#fc-text'),whenField=$('#fc-when'),submitButton=$('[type=submit]');
  textField.value=state.text;whenField.value=state.when;
  if(options.showTiming===false){$('.fc-time-label').hidden=true;whenField.hidden=true;}
  if(options.allowSelection===false)$('[data-fc="select"]').hidden=true;
  function message(text=''){const el=$('.fc-error');el.textContent=text;el.hidden=!text;}
  function saveStatus(text,retry=false){if(closed)return;$('.fc-save-status').textContent=text;$('.fc-retry').hidden=!retry;}
  function sync(){state.text=textField.value;state.when=whenField.value;}
  function snapshot(){return copy(state);}
  function refreshButtons(){if(closed)return;const recording=['requesting','recording','stopping'].includes(recorder.state);submitButton.disabled=restoring||processing>0||submitting||submitted||recording||missing.size>0;submitButton.textContent=submitting?'Sending…':processing?'Preparing attachment…':submitted?'Sent':submitLabel;for(const el of dialog.querySelectorAll('[data-fc="images"],[data-fc="audio"],[data-fc="select"],[data-fc="remove"]'))el.disabled=submitting||restoring||recording||processing>0;$('.fc-tools [data-fc="record"]').disabled=submitting||restoring||processing>0||recording;textField.disabled=whenField.disabled=submitting||restoring;}
  function saveDraft(){
   root.clearTimeout(saveTimer);saveTimer=null;if(closed)return saveQueue;
   sync();const value=snapshot(),revision=++saveRevision;dirty=true;saveStatus('Saving on this device…');
   const result=saveQueue.catch(()=>{}).then(()=>Store.saveDraft(draftKey,value));saveQueue=result;
   result.then(()=>{if(!closed&&revision===saveRevision){dirty=false;saveStatus('Saved on this device');$('[data-fc="discard"]').hidden=true;}},error=>{if(!closed&&revision===saveRevision){dirty=true;saveStatus('Not saved on this device',true);message(error.message);}});return result;
  }
  function queueSave(){sync();dirty=true;++saveRevision;saveStatus('Saving on this device…');root.clearTimeout(saveTimer);saveTimer=root.setTimeout(()=>saveDraft().catch(()=>{}),250);}
  function renderContext(){const c=state.context,s=c.selection;$('.fc-context-content').innerHTML='<dl>'+[['Page',c.page||c.step||'Current demo page'],['Feedback',c.ticket||c.ticketId],['Version',c.revision?'V'+c.revision:undefined],['Quote',c.quote||c.quoteId],['Compartment',c.compartment||c.compartmentId],['Selected area',s?.label],['State',Object.entries(c.state||{}).map(([key,value])=>key+': '+String(value)).join(' · ')]].filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>'<dt>'+escape(k)+'</dt><dd>'+escape(v)+'</dd>').join('')+'</dl>'+(s?'<button type="button" data-fc="clear-selection">Remove selected area</button>':'');}
  function revoke(id){if(urls.has(id)){root.URL.revokeObjectURL(urls.get(id));urls.delete(id);}}
  function renderAttachments(){if(closed)return;$('.fc-attachments').innerHTML=state.attachments.map(a=>{
   const url=urls.get(a.id),lost=missing.has(a.id);return '<article class="fc-attachment" data-attachment="'+escape(a.id)+'">'+(a.kind==='image'?'<button type="button" class="fc-thumbnail" data-fc="preview" data-id="'+escape(a.id)+'" '+(!url?'disabled':'')+' aria-label="Enlarge '+escape(a.name)+'">'+(url?'<img src="'+escape(url)+'" alt="Attached '+escape(a.name)+'">':'<span>Image unavailable</span>')+'</button>':'')+'<div class="fc-attachment-body"><strong>'+escape(a.name)+'</strong><span>'+escape(lost?'Original missing on this device':a.kind==='image'?'Image · '+(a.size/1024/1024).toFixed(1)+' MB':'Voice note · '+formatTime(a.duration))+'</span>'+(a.kind==='audio'&&url?'<audio controls preload="metadata" src="'+escape(url)+'"></audio>':'')+'</div><button type="button" class="fc-remove" data-fc="remove" data-id="'+escape(a.id)+'" aria-label="Remove '+escape(a.name)+'">Remove</button></article>';
  }).join('');$('.fc-tools [data-fc="record"]').textContent=state.attachments.some(a=>a.kind==='audio')?'Record again':'Record voice';refreshButtons();}
  function formatTime(seconds=0){return Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');}
  function enqueueFile(file,source='upload',recorded=null){
   processing++;refreshButtons();
   const job=mediaQueue.catch(()=>{}).then(async()=>{
    const kind=recorded?'audio':String(file.type||'').startsWith('image/')?'image':'audio';canAdd(state.attachments,kind);
    const info=recorded||await Media.inspect(file);if(closed)return;
    const manifest=await Store.put(file,{kind:info.kind||kind,duration:info.duration,name:recorded?.name||file.name,source});
    if(closed){await Store.remove(manifest.id);return;}
    const old=state.attachments;state.attachments=kind==='audio'?[...old.filter(a=>a.kind!=='audio'),manifest]:[...old,manifest];
    try{await saveDraft();}catch(error){state.attachments=old;await Store.remove(manifest.id).catch(()=>{});throw error;}
    urls.set(manifest.id,root.URL.createObjectURL(file));
    if(kind==='audio')for(const a of old.filter(a=>a.kind==='audio')){revoke(a.id);await Store.remove(a.id).catch(()=>{});}
    message();renderAttachments();
   });
   mediaQueue=job;job.catch(error=>{if(!closed)message(error.message);}).finally(()=>{processing--;refreshButtons();});return job;
  }
  async function removeAttachment(id){if(submitting||processing||restoring||recorder.state!=='idle')return;const old=state.attachments;let saved=false;processing++;refreshButtons();state.attachments=old.filter(a=>a.id!==id);try{await saveDraft();saved=true;missing.delete(id);revoke(id);await Store.remove(id);message();}catch(error){if(!saved)state.attachments=old;message(saved?'Removed from this draft. Its local file could not be cleaned up yet.':error.message);}finally{processing--;renderAttachments();}}
  const recorder=Media.createRecorder({onState:({state:status,seconds})=>{
   if(closed)return;const active=status!=='idle';$('.fc-recording').hidden=!active;$('.fc-recording-label').textContent=status==='requesting'?'Waiting for microphone permission…':status==='stopping'?'Finishing your recording…':'Recording · '+formatTime(seconds)+' / 2:00';$('[data-fc="stop"]').hidden=status!=='recording';refreshButtons();
  },onComplete:value=>enqueueFile(value.blob,'recording',{kind:'audio',duration:value.duration,name:value.name}).catch(()=>{}),onError:error=>message(error.message)});
  async function startRecord(){message();try{await recorder.start();}catch(error){message(error.message);refreshButtons();}}
  function preview(id){const url=urls.get(id),a=state.attachments.find(x=>x.id===id);if(!url||!a||viewer)return;const imageDialog=doc.createElement('dialog');viewer=imageDialog;imageDialog.className='fc-viewer';imageDialog.innerHTML='<header><strong>'+escape(a.name)+'</strong><button type="button" aria-label="Close image preview">×</button></header><img src="'+escape(url)+'" alt="'+escape(a.name)+'">';dialog.append(imageDialog);imageDialog.querySelector('button').onclick=()=>imageDialog.close();imageDialog.addEventListener('cancel',event=>event.stopPropagation());imageDialog.addEventListener('close',()=>{imageDialog.remove();if(viewer===imageDialog)viewer=null;dialog.querySelector('[data-fc="preview"][data-id="'+id+'"]')?.focus();});imageDialog.showModal();}
  function selectArea(){
   if(submitting||options.allowSelection===false)return;sync();saveDraft().catch(()=>{});dialog.close();
   const back=()=>{if(closed)return;dialog.showModal();renderContext();$('[data-fc="select"]').focus();};
   try{picker=Context.pick({root:options.selectionRoot,onSelect:selected=>{picker=null;state.context.selection=selected;back();saveDraft().catch(()=>{});},onCancel:()=>{picker=null;back();}});}catch(error){back();message(error.message);}
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
   if(closed)return;closed=true;active=null;root.clearTimeout(saveTimer);recorder.destroy();picker?.cancel();viewer?.close();for(const audio of dialog.querySelectorAll('audio')){audio.pause();audio.removeAttribute('src');audio.load();}for(const id of urls.keys())revoke(id);doc.removeEventListener('visibilitychange',onVisibility);root.removeEventListener('pagehide',onPageHide);dialog.remove();if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});options.onClose?.({submitted:success||submitted,draftKey});
  }
  async function close(){if(closed||submitting)return;if(recorder.state==='recording'){await recorder.stop().catch(error=>message(error.message));await mediaQueue.catch(()=>{});}else recorder.cancel();if(submitted){await Store.clearDraft(draftKey).catch(()=>{});cleanup(true);return;}try{if(restoring)await ready;await mediaQueue.catch(()=>{});await saveDraft();cleanup();}catch(error){message(error.message+' Your latest changes are not saved. Retry saving, or copy your text before closing.');$('[data-fc="discard"]').hidden=false;}}
  function onVisibility(){if(doc.hidden&&recorder.state==='recording')recorder.stop().catch(error=>message(error.message));}
  function onPageHide(){recorder.cancel();root.clearTimeout(saveTimer);if(!closed)saveDraft().catch(()=>{});}
  dialog.addEventListener('cancel',event=>{if(event.target!==dialog)return;event.preventDefault();close();});
  dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();submit();});
  dialog.addEventListener('input',event=>{if(event.target===textField)queueSave();});
  whenField.addEventListener('change',queueSave);
  dialog.addEventListener('click',event=>{const b=event.target.closest('[data-fc]');if(!b||b.disabled)return;const action=b.dataset.fc;event.preventDefault();if(action==='close')close();else if(action==='discard')cleanup();else if(action==='images')$('#fc-images').click();else if(action==='audio')$('#fc-audio').click();else if(action==='record')startRecord();else if(action==='stop')recorder.stop().catch(error=>message(error.message));else if(action==='cancel-recording')recorder.cancel();else if(action==='remove')removeAttachment(b.dataset.id);else if(action==='preview')preview(b.dataset.id);else if(action==='select')selectArea();else if(action==='clear-selection'){delete state.context.selection;renderContext();saveDraft().catch(()=>{});}else if(action==='retry'){if(submitted)Store.clearDraft(draftKey).then(()=>cleanup(true),error=>message(error.message));else saveDraft().catch(()=>{});}});
  $('.fc-drop-zone').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&!$('[data-fc="images"]').disabled){event.preventDefault();$('#fc-images').click();}});
  for(const id of ['#fc-images','#fc-audio'])$(id).addEventListener('change',event=>{for(const file of event.target.files||[])enqueueFile(file,'upload').catch(()=>{});event.target.value='';});
  dialog.addEventListener('paste',event=>{const files=[...(event.clipboardData?.items||[])].filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);if(files.length){event.preventDefault();for(const file of files)enqueueFile(file,'paste').catch(()=>{});}});
  dialog.addEventListener('dragover',event=>{if(event.dataTransfer?.types.includes('Files')){event.preventDefault();dialog.classList.add('fc-dragging');}});
  dialog.addEventListener('dragleave',event=>{if(!dialog.contains(event.relatedTarget))dialog.classList.remove('fc-dragging');});
  dialog.addEventListener('drop',event=>{event.preventDefault();dialog.classList.remove('fc-dragging');for(const file of event.dataTransfer?.files||[])enqueueFile(file,'drop').catch(()=>{});});
  doc.addEventListener('visibilitychange',onVisibility);root.addEventListener('pagehide',onPageHide);
  const ready=(async()=>{
   try{const saved=await Store.getDraft(draftKey);if(closed)return;if(saved?.schema===1&&saved.scenarioId===state.scenarioId){state={...state,...saved};textField.value=state.text;whenField.value=state.when;for(const a of state.attachments){try{const media=await Store.get(a.id);if(closed)return;urls.set(a.id,root.URL.createObjectURL(media.blob));}catch{missing.add(a.id);}}if(missing.size)message('An attachment is no longer on this device. Remove it or add the original again.');}await saveDraft();}
   catch(error){if(!closed){message(error.message);saveStatus('Not saved on this device',true);}}
   finally{restoring=false;if(!closed){renderContext();renderAttachments();refreshButtons();textField.focus();}}
  })();
  renderContext();dialog.showModal();refreshButtons();
  active={ready,close,destroy:()=>cleanup(),getDraft:()=>{if(!closed)sync();return snapshot();},element:dialog};return active;
 }
 const api={open,payload,canAdd};root.FeedbackComposer=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
