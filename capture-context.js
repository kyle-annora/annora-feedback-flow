/* Explicitly allowlisted DOM context. This is not a screenshot, source-code capture or telemetry SDK. */
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
 const api={sanitize,capture,selection,pick};root.FeedbackCaptureContext=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
