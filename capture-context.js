/* Allowlisted DOM context plus explicit, reviewed one-frame browser-tab screenshots. No source-code or telemetry collection. */
(function(root){
 'use strict';
 const fields=['scenarioId','page','step','quote','quoteId','compartment','compartmentId','ticket','ticketId','revision','build','buildId','origin','simulated'];
 const stateFields=['unsaved','generated','pdfGenerated','selectedCompartment','noRefrigeration','savedNoRefrigeration','hasUnsavedChanges','saved','equipment','equipmentCount','cost','unit','activeTab'];
 const clean=(v,max=160)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').slice(0,max):typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v))?v:undefined;
 function sanitize(input={}){
  const out={};for(const key of fields){const v=clean(input[key]);if(v!==undefined)out[key]=v;}
  const state={};for(const key of stateFields){const v=clean(input.state?.[key]);if(v!==undefined)state[key]=v;}if(Object.keys(state).length)out.state=state;
  return out;
 }
 function selection(element){
  if(!element||element.closest?.('[data-feedback-private],input,textarea,select,[contenteditable],iframe,[data-feedback-composer],[data-demo-console]'))return null;
  const rect=element.getBoundingClientRect?.();
  const label=element.getAttribute?.('data-feedback-label')||element.getAttribute?.('data-capture-region')||element.getAttribute?.('aria-label')||element.getAttribute?.('title')||element.tagName?.toLowerCase()||'Selected area';
  // Only explicitly marked safe copy can enter the excerpt; generic textContent may contain personal data.
  const safeText=element.getAttribute?.('data-feedback-text');
  return {label:String(label).slice(0,160),tag:String(element.tagName||'').toLowerCase(),component:clean(element.getAttribute?.('data-feedback-component')),excerpt:safeText?String(safeText).slice(0,500):'',bounds:rect?{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)}:null,kind:'selected DOM context',screenshot:false,sourceCode:false};
 }
 function capture(input={},environment=root){
  const context=sanitize(input);
  const route=environment.location?.pathname;if(route)context.route=route; // Deliberately omit query strings and hashes.
  context.capturedAt=new Date().toISOString();
  try{context.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;}catch{}
  context.viewport={width:Number(environment.innerWidth)||0,height:Number(environment.innerHeight)||0};
  if(input.selection?.kind==='selected DOM context'){const s=input.selection;context.selection={label:clean(s.label),tag:clean(s.tag),component:clean(s.component),excerpt:clean(s.excerpt,500),bounds:s.bounds?Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(s.bounds[k])||0])):null,kind:'selected DOM context',screenshot:false,sourceCode:false};}
  context.captureKind='Local demo page context';context.localOnly=true;return context;
 }
 function pick({root:surface,onSelect,onCancel}={}){
  const doc=root.document;surface=typeof surface==='string'?doc.querySelector(surface):surface||doc.querySelector('[data-feedback-surface]');
  if(!surface)throw new Error('This page has no selectable demo area. You can attach an image instead.');
  const overlay=doc.createElement('div');overlay.className='fc-picker';overlay.dataset.feedbackPrivate='true';
  overlay.innerHTML='<div class="fc-picker-banner" role="status">Click the area you mean. This selects context, not a screenshot.<button type="button">Cancel · Esc</button></div><div class="fc-picker-outline"></div>';
  doc.body.append(overlay);const outline=overlay.lastElementChild;outline.hidden=true;let target=null,done=false;
  const candidates=()=>[...surface.querySelectorAll('[data-feedback-region],[data-capture-region]')].filter(el=>selection(el));
  function find(x,y){overlay.style.visibility='hidden';let hit=doc.elementFromPoint(x,y);overlay.style.visibility='';if(!hit||!surface.contains(hit)||hit.closest('input,textarea,select,[contenteditable],iframe,[data-feedback-private],[data-demo-console]'))return null;hit=hit.closest('[data-feedback-region],[data-capture-region]')||hit.closest('button,h1,h2,h3,p,section,article');return hit&&surface.contains(hit)&&selection(hit)?hit:null;}
  function highlight(el){target=el;outline.hidden=!el;if(el){const r=el.getBoundingClientRect();Object.assign(outline.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}}
  function cleanup(){if(done)return;done=true;doc.removeEventListener('keydown',keys,true);overlay.remove();}
  function finish(el){const selected=selection(el);if(!selected)return;cleanup();onSelect?.(selected);}
  function cancel(){if(done)return;cleanup();onCancel?.();}
  function keys(event){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}else if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();const all=candidates();if(all.length){let i=all.indexOf(target);i=(i+(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)+all.length)%all.length;highlight(all[i]);}}else if(event.key==='Enter'&&target){event.preventDefault();event.stopImmediatePropagation();finish(target);}else if(event.key==='Tab'){event.preventDefault();overlay.querySelector('button').focus();}}
  overlay.addEventListener('pointermove',e=>{if(!e.target.closest('.fc-picker-banner'))highlight(find(e.clientX,e.clientY));});
  overlay.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(e.target.closest('button'))cancel();else if(!e.target.closest('.fc-picker-banner'))finish(find(e.clientX,e.clientY));});
  doc.addEventListener('keydown',keys,true);overlay.querySelector('button').focus();return {cancel};
 }
 // A one-frame, explicitly approved browser-tab capture. It never reads page source,
 // records a stream, or attaches an image until the requester has reviewed it.
 let imageCaptureActive=false;
 function cropBounds(rect,width,height){
  const w=Math.max(1,Math.round(Number(width)||1)),h=Math.max(1,Math.round(Number(height)||1));
  const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
  const x=Math.max(0,Math.min(w-1,Math.round(finite(rect?.x,0)))),y=Math.max(0,Math.min(h-1,Math.round(finite(rect?.y,0))));
  return {x,y,width:Math.max(1,Math.min(w-x,Math.round(finite(rect?.width,w)))),height:Math.max(1,Math.min(h-y,Math.round(finite(rect?.height,h))))};
 }
 function screenError(error){
  if(error?.name==='NotAllowedError')return new Error('Screenshot permission was not granted. Your draft is safe. Try again, or use Add image.');
  if(error?.name==='InvalidStateError')return new Error('Click Capture again to choose this WinQuote tab, or use Add image.');
  if(error?.name==='NotReadableError')return new Error('The browser could not capture that tab. Try again, or use Add image.');
  return error instanceof Error?error:new Error('The screenshot could not be captured. Use Add image instead.');
 }
 function canvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The screenshot could not be prepared. Use Add image instead.')),'image/png'));}
 function nextFrame(video){
  if(video.readyState>=2&&video.videoWidth&&video.videoHeight)return Promise.resolve();
  return new Promise((resolve,reject)=>{
   let callback=null;
   const finish=error=>{root.clearTimeout(timer);if(callback!==null)video.cancelVideoFrameCallback?.(callback);error?reject(error):resolve();};
   const timer=root.setTimeout(()=>video.videoWidth&&video.videoHeight?finish():finish(new Error('No image arrived from the shared tab. Try again or use Add image.')),2200);
   if(video.requestVideoFrameCallback)callback=video.requestVideoFrameCallback(()=>finish());
   else root.setTimeout(()=>video.videoWidth&&video.videoHeight?finish():null,180);
  });
 }
 function previewCapture(canvas,mode,source){
  const doc=root.document,previous=doc.activeElement,panel=doc.createElement('section');
  panel.className='fc-screen-preview';panel.dataset.feedbackPrivate='true';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','fc-screen-title');
  panel.innerHTML='<header><h2 id="fc-screen-title">'+(mode==='area'?'Select a screenshot area':'Review screenshot')+'</h2><button type="button" data-screen="cancel" aria-label="Cancel screenshot"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="fc-screen-body"><p id="fc-screen-help">'+(mode==='area'?'Drag over the image to choose an area. Arrow keys move the selection; Shift + arrows resize it.':'Check that this is the WinQuote page you meant to share.')+'</p><div class="fc-screen-image" '+(mode==='area'?'tabindex="0" role="group" aria-label="Screenshot crop selection" aria-describedby="fc-screen-help"':'')+'><canvas aria-label="Captured browser tab"></canvas><div class="fc-screen-selection" hidden></div></div>'+(mode==='area'?'<details class="fc-screen-adjust"><summary>Adjust selection</summary><div>'+['Left','Top','Width','Height'].map((label,index)=>'<label>'+label+' (%)<input type="number" min="0" max="100" step="1" data-crop="'+['x','y','width','height'][index]+'"></label>').join('')+'</div></details>':'')+'<p class="fc-screen-source">Shared tab screenshot · One image, no recording. Only the image you approve will be attached.</p><p class="fc-screen-error" role="alert" hidden></p></div><footer><button type="button" data-screen="cancel">Cancel</button><button type="button" class="fc-screen-primary" data-screen="use">'+(mode==='area'?'Use selected area':'Use screenshot')+'</button></footer>';
  doc.body.append(panel);const stage=panel.querySelector('.fc-screen-image'),display=stage.querySelector('canvas'),outline=stage.querySelector('.fc-screen-selection'),use=panel.querySelector('[data-screen="use"]');
  display.width=canvas.width;display.height=canvas.height;display.getContext('2d').drawImage(canvas,0,0);
  let selection=mode==='area'?cropBounds({x:canvas.width*.1,y:canvas.height*.1,width:canvas.width*.8,height:canvas.height*.8},canvas.width,canvas.height):{x:0,y:0,width:canvas.width,height:canvas.height},start=null,done=false;
  function draw(){
   outline.hidden=mode!=='area';if(mode!=='area')return;
   Object.assign(outline.style,{left:selection.x/canvas.width*100+'%',top:selection.y/canvas.height*100+'%',width:selection.width/canvas.width*100+'%',height:selection.height/canvas.height*100+'%'});
   for(const input of panel.querySelectorAll('[data-crop]'))input.value=String(Math.round(selection[input.dataset.crop]/(['x','width'].includes(input.dataset.crop)?canvas.width:canvas.height)*100));
  }
  const point=event=>{const box=display.getBoundingClientRect();return {x:Math.max(0,Math.min(canvas.width,(event.clientX-box.left)/box.width*canvas.width)),y:Math.max(0,Math.min(canvas.height,(event.clientY-box.top)/box.height*canvas.height))};};
  const position=event=>{if(!start)return;const end=point(event);selection=cropBounds({x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(end.x-start.x),height:Math.abs(end.y-start.y)},canvas.width,canvas.height);draw();};
  stage.addEventListener('pointerdown',event=>{if(mode!=='area'||event.button!==0)return;event.preventDefault();stage.focus();start=point(event);stage.setPointerCapture(event.pointerId);position(event);});
  stage.addEventListener('pointermove',position);stage.addEventListener('pointerup',event=>{if(!start)return;position(event);start=null;stage.releasePointerCapture?.(event.pointerId);});stage.addEventListener('pointercancel',()=>{start=null;});
  stage.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
   event.preventDefault();const horizontal=['ArrowLeft','ArrowRight'].includes(event.key),sign=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1,key=event.shiftKey?(horizontal?'width':'height'):(horizontal?'x':'y'),limit=horizontal?canvas.width:canvas.height;
   let value=selection[key]+sign*Math.max(1,Math.round(limit*.01));if(!event.shiftKey)value=Math.max(0,Math.min(limit-selection[horizontal?'width':'height'],value));selection=cropBounds({...selection,[key]:value},canvas.width,canvas.height);draw();
  });
  panel.addEventListener('change',event=>{const key=event.target.dataset.crop;if(!key)return;const limit=['x','width'].includes(key)?canvas.width:canvas.height;selection=cropBounds({...selection,[key]:Number(event.target.value)/100*limit},canvas.width,canvas.height);draw();});
  draw();(mode==='area'?stage:use).focus();
  return new Promise(resolve=>{
   function cleanup(value){if(done)return;done=true;doc.removeEventListener('keydown',escape,true);root.removeEventListener('pagehide',cancel);panel.remove();if(previous?.isConnected)previous.focus({preventScroll:true});resolve(value);}
   function cancel(){cleanup(null);}
   function escape(event){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}}
   doc.addEventListener('keydown',escape,true);root.addEventListener('pagehide',cancel,{once:true});
   panel.addEventListener('click',async event=>{
    const action=event.target.closest('[data-screen]')?.dataset.screen;if(action==='cancel'){cancel();return;}if(action!=='use'||use.disabled)return;
    use.disabled=true;use.textContent='Preparing image…';
    try{const cropped=doc.createElement('canvas');cropped.width=selection.width;cropped.height=selection.height;cropped.getContext('2d').drawImage(canvas,selection.x,selection.y,selection.width,selection.height,0,0,selection.width,selection.height);const blob=await canvasBlob(cropped);if(done)return;
     const file=new root.File([blob],mode==='area'?'Shared-tab-selected-area.png':'Shared-tab-screenshot.png',{type:'image/png'});
     cleanup({file,context:{kind:'Shared tab screenshot',capturedAt:source.capturedAt,source:'user-selected browser tab',screenshot:true,sourceCode:false,width:selection.width,height:selection.height,...(mode==='area'?{crop:{...selection},sourceWidth:canvas.width,sourceHeight:canvas.height}:{})}});
    }catch(error){const message=panel.querySelector('.fc-screen-error');message.textContent=error.message;message.hidden=false;use.disabled=false;use.textContent=mode==='area'?'Use selected area':'Use screenshot';}
   });
  });
 }
 async function captureImage({mode='page'}={}){
  if(!['page','area'].includes(mode))throw new Error('Choose a page screenshot or selected screenshot area.');
  if(imageCaptureActive)throw new Error('Finish or cancel the current screenshot first.');
  const doc=root.document,devices=root.navigator?.mediaDevices;
  if(!doc||!devices?.getDisplayMedia)throw new Error('This browser cannot capture a tab. Take a screenshot and use Add image instead.');
  imageCaptureActive=true;let stream=null,video=null,canvas=null;const capturedAt=new Date().toISOString();
  try{
   // This call intentionally precedes every await: browser approval needs the click's activation.
   const permission=devices.getDisplayMedia({video:{displaySurface:'browser'},audio:false,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude',monitorTypeSurfaces:'exclude'});
   doc.documentElement.classList.add('fc-capturing');
   try{
    stream=await permission;const track=stream.getVideoTracks()[0];if(!track||track.getSettings?.().displaySurface!=='browser')throw new Error('Choose a browser tab for the screenshot. Try again and select this WinQuote tab, or use Add image.');
    video=doc.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;await video.play();await nextFrame(video);
    // Capture only the frame after the composer/presenter surfaces have been hidden.
    await new Promise(resolve=>root.setTimeout(resolve,120));
    if(!video.videoWidth||!video.videoHeight)throw new Error('The tab returned an empty image. Try again or use Add image.');
    const scale=Math.min(1,4096/Math.max(video.videoWidth,video.videoHeight));canvas=doc.createElement('canvas');canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
   }finally{
    for(const track of stream?.getTracks()||[])track.stop();if(video){video.pause();video.srcObject=null;}doc.documentElement.classList.remove('fc-capturing');
   }
   return await previewCapture(canvas,mode,{capturedAt});
  }catch(error){throw screenError(error);}finally{imageCaptureActive=false;}
 }

 const api={sanitize,capture,selection,pick,captureImage,cropBounds};root.FeedbackCaptureContext=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
