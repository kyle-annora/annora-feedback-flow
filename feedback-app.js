/* The customer workspace uses the existing CaseEngine and storage, not a second workflow engine. */
(function(root){
  'use strict';
  const query=new URLSearchParams(location.search);
  const active=!(query.has('walkthrough')||query.has('capture')||query.has('demo')||(query.has('legacy')&&!query.has('ticket')));
  root.FeedbackWorkspace={active};if(!active)return;
  const S=root.FeedbackStore,E=root.CaseEngine,C=root.FlowScenarios,V=root.FeedbackView,P=root.FeedbackPresentation;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let error='',notice='',data,brokenStorage=false;
  function read(){
    try{const raw=localStorage.getItem(S.key);if(!raw)return S.migrate(null);const parsed=JSON.parse(raw);if(!Array.isArray(parsed.items))throw Error('Saved records have an unsupported shape.');return S.migrate(parsed);}
    catch(e){brokenStorage=true;error='Saved feedback could not be read. It has not been removed. Use an earlier copy or another browser profile to continue.';return S.migrate(null);}
  }
  data=read();
  const ui=data.feedbackExperience.ui||{};
  let page=ui.page||'inbox',actor=['Requester','Website team','Site owner'].includes(ui.actor)?ui.actor:'Requester',scenarioId=ui.scenarioId||'pdf',contextOpen=false,contextTab='details',historyVersion=null,filter='all',search='';
  let consoleState={open:false,mode:'practice',playing:false},watchTimer=null,backgroundTimer=null,preparationTimer=null;
  let hostScenarioId=C.get(ui.hostScenarioId)?ui.hostScenarioId:'pdf',site={...initialSite(),...ui.hostSite},resultState=null,returnFocus=null,returnFocusSelector=null,composer=null,rendered=null;
  let hub={mode:'closed',composing:false,hasDraft:!!ui.hubDraft},hubLastMode=ui.hubLastMode==='full'?'full':'compact',hubDraft=ui.hubDraft||null;
  let hubDrafts=Array.isArray(ui.hubDrafts)?ui.hubDrafts:hubDraft?[hubDraft]:[],hubResume=ui.hubResume||'workspace',gatheringContext=false,listReturnFocus=null;
  const surfacePositions=new Map(),preparations=new Map();let lastSurfaceKey='',lastInspectorPosition=null;
  const app=document.createElement('div');app.id='feedback-root';document.body.appendChild(app);
  const oldApp=document.querySelector('.app');if(oldApp)oldApp.style.display='none';
  document.querySelector('.skip')?.setAttribute('href','#feedback-main');
  const modalRoot=document.createElement('div');modalRoot.id='feedback-modal-root';document.body.appendChild(modalRoot);
  const modal=document.createElement('dialog');modal.className='fs-dialog';modal.id='feedback-dialog';modalRoot.appendChild(modal);
  const current=()=>S.get(data,data.current),scenario=()=>C.get(scenarioId)||C.get('pdf');
  const hostScenario=()=>C.get(hostScenarioId)||C.get('pdf');
  const mediaCache=new Map();let visibleMediaIds=new Set();
  let walkCursor=null;
  let inspector={key:'',view:null,stack:[]},inspectorRestore=null;
  const inspectorNames={questions:'clarifications',changes:'changes',attachments:'attachments',versions:'versions'};
  function inspectorPosition(){
    const drawer=app.querySelector('#feedback-details');
    return {scroll:drawer?.scrollTop||0,windowY:root.scrollY||0,folds:[...(drawer?.querySelectorAll('details')||[])].map(el=>({label:el.querySelector('summary > span')?.textContent||'',open:el.open})),focus:null};
  }
  function restoreInspector(position){
    if(!position)return;const drawer=app.querySelector('#feedback-details');if(!drawer)return;
    for(const el of drawer.querySelectorAll('details')){const saved=position.folds?.find(row=>row.label===(el.querySelector('summary > span')?.textContent||''));if(saved)el.open=saved.open;}
    drawer.scrollTop=position.scroll||0;
    if(position.returning)root.scrollTo(0,position.windowY||0);
    if(position.focus){const target=[...drawer.querySelectorAll('[data-wq]')].find(el=>el.dataset.wq===position.focus.action&&el.dataset.value===position.focus.value&&(!position.focus.kind||el.dataset.kind===position.focus.kind));target?.focus({preventScroll:true});}
  }
  function openInspector(view,el){
    saveDraft();const position=inspectorPosition();position.focus={action:el.dataset.wq,value:el.dataset.value,kind:el.dataset.kind};
    inspector.stack.push({view:inspector.view?clone(inspector.view):null,position});inspector.view=view;inspectorRestore={scroll:0,folds:[]};render();
    app.querySelector('.fs-record-title,.fs-inspector-back')?.focus({preventScroll:true});
  }
  function backInspector(){
    const previous=inspector.stack.pop();inspector.view=previous?.view||null;inspectorRestore={...previous?.position,returning:true};render();
  }
  function savePresentation(){
    if(!current())return;
    const id=current().id,fresh=read();if(!S.get(fresh,id))return;
    persist(S.saveWalk(fresh,id,{mode:consoleState.mode,role:actor,open:consoleState.open,cursor:walkCursor,historyRev:historyVersion,contextTab}).data);
  }
  function restorePresentation(item){
    const w=item?.ux?.walk||{};
    consoleState={open:!!w.open,mode:w.mode==='watch'?'watch':'practice',playing:false};
    historyVersion=w.historyRev||null;walkCursor=Number.isInteger(w.cursor)?w.cursor:null;contextTab=w.contextTab==='activity'?'activity':'details';
  }
  function recordScene(item,label){
    item.ux||={};item.ux.walk||={};const scenes=item.ux.walk.scenes||[];
    if(scenes.at(-1)?.sequence!==item.sequence)scenes.push({sequence:item.sequence,at:S.now(data),label:label||S.status(item).label,role:actor,c:clone(item.c),ux:{context:clone(item.ux.context||{}),attachments:clone(item.ux.attachments||[]),adjustmentEvidence:clone(item.ux.adjustmentEvidence||null),correctionEvidence:clone(item.ux.correctionEvidence||null),preparation:clone(item.ux.preparation||{}),timing:clone(item.ux.timing||{})}});
    item.ux.walk.scenes=scenes.slice(-40);walkCursor=null;
  }
  function presentationVM(item){
    const scenes=item?.ux?.walk?.scenes||[],snap=walkCursor===null?null:scenes[walkCursor];
    const display=snap?{...item,c:snap.c,ux:clone(snap.ux||{})}:item;
    const presentation=display?P.describe(display,{rev:historyVersion||undefined,actor}):null;
    if(presentation){for(const attachment of [...presentation.request?.attachments||[],...presentation.adjustmentEvidence?.attachments||[],...(presentation.corrections||[]).flatMap(c=>c.evidence?.attachments||[])]){const cached=mediaCache.get(attachment.id);if(cached?.url){attachment.blobUrl=cached.url;if(attachment.kind!=='audio')attachment.thumbnailUrl=cached.url;}}}
    return {presentation,walkHistory:{active:!!snap,index:snap?walkCursor:scenes.length,total:scenes.length,canBack:scenes.length>0&&(walkCursor===null||walkCursor>0),canForward:!!snap,label:snap?.label||'Current task',why:presentation?.why?.text||''}};
  }
  async function hydrateMedia(presentation){
    const attachments=[...presentation?.request?.attachments||[],...presentation?.adjustmentEvidence?.attachments||[],...(presentation?.corrections||[]).flatMap(c=>c.evidence?.attachments||[])];
    const ids=new Set(attachments.map(a=>a.id).filter(Boolean));visibleMediaIds=ids;
    for(const [id,value] of mediaCache)if(!ids.has(id)){if(value.url)URL.revokeObjectURL(value.url);mediaCache.delete(id);}
    const pending=attachments.filter(a=>a.id&&!mediaCache.has(a.id));if(!pending.length)return;
    let changed=false;
    await Promise.all(pending.map(async a=>{const token={loading:true};mediaCache.set(a.id,token);try{const result=await root.FeedbackMediaStore.get(a.id);if(mediaCache.get(a.id)!==token||!visibleMediaIds.has(a.id))return;mediaCache.set(a.id,result?.blob?{url:URL.createObjectURL(result.blob)}:{missing:true});changed=true;}catch{if(mediaCache.get(a.id)===token){mediaCache.set(a.id,{missing:true});changed=true;}}}));
    if(changed)render();
  }
  function initialSite(){return {compartment:'1',title:'Cooler',section:'make-pdf',noRefrigeration:false,savedNoRefrigeration:false,equipment:'Medium-temperature refrigeration',cost:2400,pdfGenerated:false,notice:''};}
  function persist(next){
    if(brokenStorage)throw Error('The existing saved data needs recovery before it can be changed.');
    localStorage.setItem(S.key,JSON.stringify(next));data=next;
  }
  function syncUI(){
    const next=read();if(brokenStorage)return;
    next.current=data.current;next.feedbackExperience.ui={page,scenarioId,actor,hostScenarioId,hostSite:clone(site),hubLastMode,hubDraft,hubDrafts,hubResume};persist(next);savePresentation();
  }
  function changeRecord(fn){const next=read();if(brokenStorage)throw Error('Saved feedback needs recovery.');const item=S.get(next,data.current);if(!item)throw Error('This feedback is no longer available.');fn(item,next);persist(next);return item;}
  function roleOwner(item=current()){return S.status(item,S.now(data)).owner;}
  function rememberSurface(){
    const scroller=app.querySelector('.fs-hub-content');
    if(scroller&&lastSurfaceKey)surfacePositions.set(lastSurfaceKey,scroller.scrollTop);
    if(app.querySelector('#feedback-details'))lastInspectorPosition=inspectorPosition();
  }
  function configureHub(){
    const full=(hub.mode==='full'||matchMedia('(max-width:640px)').matches)&&hub.mode!=='closed'&&!composer?.status?.gathering;
    const host=app.querySelector('.fs-host-surface');if(host)host.inert=full;
    document.body.classList.toggle('feedback-hub-full',full);
    document.querySelector('.skip')?.setAttribute('href',hub.mode==='closed'?'#host-main':'#feedback-main');
  }
  function setHubMode(mode){
    saveDraft();rememberSurface();if(mode!=='closed')hubLastMode=mode;
    hub.mode=mode;syncUI();render();
    if(mode==='closed')app.querySelector('[data-wq=hub-open]')?.focus({preventScroll:true});
    else app.querySelector('#feedback-main')?.focus({preventScroll:true});
  }
  function render(){
    if(gatheringContext)return;
    hub.drafts=hubDrafts.filter(draft=>draft.kind!=='update'||draft.actor===actor);hub.hasDraft=hub.drafts.length>0;
    rememberSurface();
    const focused=document.activeElement,focusState=app.contains(focused)?{id:focused.id,name:focused.name,wq:focused.dataset?.wq,value:focused.dataset?.value,answer:focused.dataset?.answerId,start:focused.selectionStart,end:focused.selectionEnd}:null;
    const item=current();if(item?.c.reviewFlow?.scenarioId&&page==='ticket')scenarioId=item.c.reviewFlow.scenarioId;
    if(page==='ticket'&&!item){page='inbox';error=error||'Choose a feedback item to continue.';}
    const status=S.status(page==='site'?null:item,S.now(data));
    rendered=item?{ticketId:item.id,sequence:item.sequence,rev:item.c.rev,bundleId:item.c.reviewFlow?.sentBundle?.id}:null;
    const projection=presentationVM(page==='site'?null:item);
    const key=JSON.stringify([page,item?.id,actor,historyVersion||null,walkCursor,projection.presentation?.historical?projection.presentation.viewedRev:item?.sequence,contextTab]);
    let position=inspectorRestore || (app.querySelector('#feedback-details')?inspectorPosition():lastInspectorPosition);inspectorRestore=null;
    if(inspector.key!==key){inspector={key,view:null,stack:[]};position=null;lastInspectorPosition=null;}
    const previousView=inspector.stack.at(-1)?.view;
    const inspectorVM={view:inspector.view,backLabel:previousView?.section?inspectorNames[previousView.section]:previousView?.kind==='basis'?'version basis':previousView?.kind==='plan'?'saved plan':'details'};
    const attention=S.attention(data,{actor});
    app.innerHTML=(V.renderHub||V.render)({hub,host:{scenario:hostScenario(),site},attention,page,items:S.customerItems(data).map(i=>({...i,status:S.status(i,S.now(data))})),current:page==='site'?null:item,actor,scenarios:C.list(),scenario:scenario(),updates:attention.updates,updateGroups:attention.updateGroups,status,console:consoleState,error,notice,contextOpen,contextTab,historyVersion,preparationPaused:!!item?.ux?.preparation?.paused,...projection,inspector:inspectorVM,filter,search,site,formDraft:item?.ux?.drafts||{},answers:item?.ux?.drafts?.bundleId===item?.c.reviewFlow?.sentBundle?.id?item?.ux?.drafts?.answers||{}:{},answerNotes:item?.ux?.drafts?.answerNotes||{},preview:item?.c.reviewFlow?E.reviewPreview(item.c):null,clock:S.now(data)});
    configureDrawer();configureHub();restoreInspector(position);
    lastSurfaceKey=JSON.stringify([hub.mode,page,page==='ticket'?item?.id:null,page==='ticket'?historyVersion:null,actor,filter,search]);
    const scroller=app.querySelector('.fs-hub-content');if(scroller)scroller.scrollTop=surfacePositions.get(lastSurfaceKey)||0;
    if(focusState){const candidates=[...app.querySelectorAll('input,textarea,select,button,[tabindex]')];const replacement=candidates.find(el=>focusState.id?el.id===focusState.id:focusState.answer?el.dataset.answerId===focusState.answer&&el.value===focused.value:focusState.name?el.name===focusState.name:focusState.wq?el.dataset.wq===focusState.wq&&el.dataset.value===focusState.value:false);if(replacement&&!replacement.closest('[inert]')){replacement.focus({preventScroll:true});try{if(typeof focusState.start==='number')replacement.setSelectionRange(focusState.start,focusState.end);}catch{}}}
    document.title=(page==='ticket'&&item?projection.presentation.title+' · ':'')+'WinQuote Feedback';
    void hydrateMedia(projection.presentation);
  }
  function configureDrawer(focus=false){
    const opened=contextOpen&&matchMedia('(max-width:900px)').matches,drawer=app.querySelector('#feedback-details'),wasModal=drawer?.getAttribute('aria-modal')==='true';
    if(drawer){if(opened){drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');}else{drawer.removeAttribute('role');drawer.removeAttribute('aria-modal');}}
    app.querySelectorAll('.fs-navigation,.fs-topbar,.fs-ticket-document,.fs-hub-header,.fs-hub-workspace-tabs,.fs-console,.fs-console-launcher').forEach(el=>el.inert=opened);
    if(focus)(opened?drawer?.querySelector('.fs-close-details'):app.querySelector('.fs-hub-header-actions [data-wq=toggle-context],.fs-top-actions [data-wq=toggle-context]'))?.focus();
    else if(opened&&!drawer?.contains(document.activeElement))drawer?.querySelector('.fs-close-details')?.focus();
    else if(!opened&&wasModal)drawer?.focus();
  }
  app.addEventListener('keydown',event=>{
    if(event.target.matches('[role=tab][data-wq=context-tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();contextTab=event.key==='Home'?'details':event.key==='End'?'activity':contextTab==='details'?'activity':'details';saveDraft();savePresentation();render();app.querySelector('[role=tab][data-value="'+contextTab+'"]')?.focus();return;
    }
    if(!contextOpen||!matchMedia('(max-width:900px)').matches||modal.open||composer)return;
    const drawer=app.querySelector('#feedback-details');if(!drawer)return;
    if(event.key==='Escape'){event.preventDefault();contextOpen=false;render();configureDrawer(true);}
    if(event.key==='Tab'){const nodes=[...drawer.querySelectorAll('button,a[href],input,textarea,select,summary,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length&&!el.closest('details:not([open]) > :not(summary)')),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  });
  app.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.open&&!composer&&!contextOpen&&hub.mode!=='closed'){event.preventDefault();setHubMode('closed');}});
  addEventListener('resize',()=>{configureDrawer();configureHub();});
  function showError(e){error=e.message;render();if(modal.open){modal.querySelector('[data-dialog-error]')?.remove();modal.insertAdjacentHTML('afterbegin','<p role="alert" data-dialog-error class="fs-note">'+esc(error)+'</p>');}}
  function go(nextPage){
    hubResume='workspace';saveDraft();rememberSurface();page=nextPage;historyVersion=null;walkCursor=null;error='';
    if(page==='site'){hub.mode='closed';history.replaceState({},'',location.pathname+'?workflow='+encodeURIComponent(hostScenarioId));}
    else if(hub.mode==='closed')hub.mode=hubLastMode;
    syncUI();render();const target=page==='inbox'&&listReturnFocus?app.querySelector('[data-wq="open-ticket"][data-value="'+listReturnFocus+'"]'):null;(target||app.querySelector('#feedback-main'))?.focus({preventScroll:true});
  }
  function routeTicket(id,eventId){
    if(page==='inbox')listReturnFocus=id;hubResume='workspace';saveDraft();rememberSurface();stopWatch();data=read();const found=S.resolve(data,id,eventId);
    if(found.missing){page='inbox';error=found.message;if(hub.mode==='closed')hub.mode=hubLastMode;render();return;}
    if(!S.customerItems(data).some(item=>item.id===id)){page='inbox';error='This feedback is not in your current workspace.';render();return;}
    data.current=id;
    const addressed=!eventId||found.event?.recipient===actor;
    if(eventId&&addressed)data=S.markRead(data,eventId);
    notice=!addressed?'This update belongs to another demo role. Your perspective has not changed.':found.message||(eventId?'You’re back in the same feedback. Here is the current task.':'');
    restorePresentation(found.item);if(eventId){historyVersion=null;walkCursor=null;}
    scenarioId=found.item.c.reviewFlow?.scenarioId||found.item.ux?.scenarioId||'pdf';page='ticket';
    if(hub.mode==='closed')hub.mode=hubLastMode;
    const visit=S.visit(data,id);data=visit.data;persist(data);syncUI();
    history.replaceState({},'',location.pathname+'?ticket='+encodeURIComponent(id)+(eventId?'&event='+encodeURIComponent(eventId):''));render();
  }
  function startScenario(id){
    if(!C.get(id))return;saveDraft();rememberSurface();stopWatch();scenarioId=hostScenarioId=id;site=initialSite();
    site.section=id==='pdf'?'make-pdf':id==='compartment'?'panels':'refrigeration';page='site';hub.mode='closed';actor='Requester';notice='';error='';consoleState.open=consoleState.mode==='watch';syncUI();
    history.replaceState({},'',location.pathname+'?workflow='+encodeURIComponent(id));render();
  }
  function field(name){return (modal.open?modal.querySelector('[name="'+name+'"]')?.value:undefined)??app.querySelector('[name="'+name+'"]')?.value??'';}
  function readQuestions(){return [...app.querySelectorAll('[data-question-id]')].map(el=>{
    const read=k=>el.querySelector('[data-field="'+k+'"]');
    const previous=current().c.reviewFlow.questionDraft.find(q=>q.id===el.dataset.questionId)||{};
    const opts=(read('options')?.value??previous.options?.join('\n')??'').split('\n').map(s=>s.trim()).filter(Boolean);
    const preserved=clone(previous),changed=JSON.stringify(opts)!==JSON.stringify(previous.options);
    if(changed){delete preserved.optionIds;delete preserved.optionSnapshots;delete preserved.exclusiveOptionIds;delete preserved.maxSelections;}
    const optionIds=preserved.optionIds||opts.map((_,index)=>el.dataset.questionId.slice(0,52)+'-'+(index+1));
    const enteredExclusive=read('exclusiveOptions')?.value?.split('\n').map(s=>s.trim()).filter(Boolean)||[];
    const exclusiveLabels=[...new Set([...enteredExclusive,...opts.filter(s=>/^(?:none(?: of (?:these|the above))?|not sure|i[’']?m not sure|unsure)$/i.test(s))])];
    if(exclusiveLabels.some(label=>!opts.includes(label)))throw Error('Selection rules must use exact labels from the current options.');
    const type=read('type')?.value??previous.type,required=read('required')?.checked??previous.required;
    return {...preserved,id:el.dataset.questionId,text:read('text')?.value??previous.text,type,options:opts,optionIds,reason:read('reason')?.value??previous.reason,disposition:read('disposition')?.value??previous.disposition,required,screened:true,...(type==='multi'?{exclusiveOptionIds:exclusiveLabels.map(label=>optionIds[opts.indexOf(label)]),minSelections:read('minSelections')?.value!==undefined&&read('minSelections').value!==''?Number(read('minSelections').value):required?1:0,maxSelections:read('maxSelections')?.value!==undefined&&read('maxSelections').value!==''?Number(read('maxSelections').value):opts.length}:{})};
  });}
  function readAnswers(){const answers={};for(const el of app.querySelectorAll('[data-answer-id]')){const id=el.dataset.answerId;if(el.type==='checkbox'){answers[id]||=[];if(el.checked)answers[id].push(el.value);}else if(el.type==='radio'){if(el.checked)answers[id]=el.value;}else answers[id]=el.value;}return answers;}
  function readAnswerNotes(){return Object.fromEntries([...app.querySelectorAll('[data-answer-other]')].map(el=>[el.dataset.answerOther,el.value]));}
  function formScope(){
    const f=current()?.c.reviewFlow,baseline=f?.planPrepared?f.scope:f?.suggestedScope||f?.scope;
    const value=(name,fallback)=>{const input=(modal.open?modal.querySelector('[name="'+name+'"]'):null)||app.querySelector('[name="'+name+'"]');return input?input.value:fallback;};
    return {approach:value('approach',baseline?.approach||''),checks:value('checks',baseline?.checks||''),understanding:value('understanding',undefined)};
  }
  function saveDraft(){
    if(page!=='ticket'||!current()||historyVersion||walkCursor!==null)return;
    const values={};for(const el of app.querySelectorAll('[name]'))if(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)&&!el.closest?.('.fs-host-surface'))values[el.name]=el.type==='checkbox'?el.checked:el.value;
    let qs=[];try{qs=readQuestions();}catch(e){error=e.message;}const answers=readAnswers();
    try{changeRecord(i=>{i.ux||={};i.ux.drafts={...i.ux.drafts,...(Object.keys(values).length?{fields:values}:{}),...(qs.length?{questions:qs}:{}),...(Object.keys(answers).length?{answers,answerNotes:readAnswerNotes(),bundleId:rendered?.bundleId}:{})};});}catch(e){error='Your draft is still on this page but could not be saved: '+e.message;}
  }
  function questionDraftKey(item){
    const flow=item?.c.reviewFlow;
    return flow?[item.c.rev,flow.journey?.scopeCycle||1,flow.journey?.activeRound||'initial'].join(':'):null;
  }
  function apply(action,value,{simulated=false,quiet=false}={}){
    if(historyVersion||walkCursor!==null)throw Error('This is an earlier view. Return to the current task before taking action.');
    const item=current();if(!item)throw Error('Open a feedback item first.');
    const fresh=read(),previous=S.get(fresh,item.id),priorQuestionKey=questionDraftKey(previous);
    const questionsToKeep=action==='close-questions'&&Array.isArray(previous?.ux.drafts?.questions)?clone(previous.ux.drafts.questions):null;
    recordScene(previous);
    const r=S.commit(fresh,rendered?.ticketId||item.id,{expectedSequence:rendered?.sequence,action,value,actor,simulated});
    // Returning is navigation, not a send or validation boundary. Keep even an
    // incomplete private edit, scoped to this version, scope cycle and round.
    if(questionsToKeep)r.item.ux.questionDrafts={...r.item.ux.questionDrafts,[priorQuestionKey]:questionsToKeep};
    if(['save-questions','edit-questions','send-questions'].includes(action)&&r.item.ux.questionDrafts)delete r.item.ux.questionDrafts[priorQuestionKey];
    const restoredQuestions=['draft-questions','reopen-clarification','begin-detailed-questions'].includes(action)?r.item.ux.questionDrafts?.[questionDraftKey(r.item)]:null;
    r.item.ux.drafts=restoredQuestions?{questions:clone(restoredQuestions)}:{};persist(r.data);savePresentation();if(quiet)rendered={ticketId:r.item.id,sequence:r.item.sequence,rev:r.item.c.rev,bundleId:r.item.c.reviewFlow?.sentBundle?.id};error='';notice=simulated?'Walkthrough step simulated.':action==='reopen-clarification'?'Follow-up draft opened from the adjustment. Review and preview it before sending.':action==='draft-plan'?'Draft prepared from this feedback. Review it before sharing.':action==='answer'?'Answer received. The website team owns the next step.':action==='deliver'?'V'+r.item.c.rev+' sent for review.':action==='accept'?'Accepted. Release approval is now with the site owner.':action==='authorize'?'Release authorized. The team can now run it in simulation.':'Saved.';
    if(!quiet)render();return r.item;
  }
  function contextSnapshot(){
    const state=hostScenarioId==='refrigeration'?{noRefrigeration:site.noRefrigeration,savedNoRefrigeration:site.savedNoRefrigeration,equipment:site.equipment,cost:site.cost,hasUnsavedChanges:site.noRefrigeration!==site.savedNoRefrigeration}:hostScenarioId==='pdf'?{pdfGenerated:site.pdfGenerated,currentStep:site.section,pdfOpened:false}:{specificationTitle:site.title,compartment:site.compartment,sectionsLabeled:false};
    return {page:hostScenario().target,route:location.pathname+'?workflow='+hostScenarioId,quote:'MW-1042',compartment:site.compartment,step:site.section,occurredAt:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,viewport:{width:innerWidth,height:innerHeight},build:'feedback-hub-v5',state,simulated:true};
  }
  function pausePreparation(){
    for(const [id,timers] of preparations){timers.forEach(clearTimeout);const fresh=read(),item=S.get(fresh,id);if(item?.c.reviewFlow?.phase==='triage'&&item.ux?.preparation?.stage!=='team-review-pending'){item.ux.preparation={...item.ux.preparation,paused:true};persist(fresh);}}
    preparations.clear();
  }
  function schedulePreparation(id,resume=false){
    (preparations.get(id)||[]).forEach(clearTimeout);
    const prepare=stage=>{try{const fresh=read(),item=S.get(fresh,id);if(item?.c.reviewFlow?.phase!=='triage')return;persist(S.preparation(fresh,id,stage).data);if(stage==='team-review-pending')preparations.delete(id);if(current()?.id===id)notice=stage==='draft-ready'?'A simulated context brief is ready for the team to review.':'A draft is ready for team review. No customer question has been sent.';if(!app.contains(document.activeElement)||!document.activeElement.matches('input,textarea,select'))render();else if(document.getElementById('live'))document.getElementById('live').textContent=notice;}catch(e){showError(e);}};
    const timers=[];if(resume)prepare('draft-ready');else timers.push(setTimeout(()=>prepare('draft-ready'),2000));
    timers.push(setTimeout(()=>prepare('team-review-pending'),resume?38000:40000));preparations.set(id,timers);
  }
  async function submitPayload(payload,simulated=false,sourceScenario=scenario()){
    const r=S.add(read(),sourceScenario,payload,{example:simulated});persist(S.visit(r.data,r.item.id).data);page='ticket';hub.mode=hubLastMode;actor='Requester';historyVersion=null;walkCursor=null;syncUI();
    history.replaceState({},'',location.pathname+'?ticket='+encodeURIComponent(r.item.id));notice='Saved as '+r.item.id+'. The website team will review the evidence. You can keep working.';render();
    if(!simulated){showModal('<div class="fs-receipt-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 12 4 4 8-8"/></svg></div><div class="fs-eyebrow">Feedback received · '+esc(r.item.id)+'</div><h2>We have the context.</h2><p>The website team will review your feedback. We’ll put any questions and results in Updates.</p><p class="fs-muted">This demo saves feedback on this device. Email delivery is simulated.</p><div class="fs-actions"><button class="fs-button" data-wq="keep-working">Keep working</button><button class="fs-button fs-primary" data-wq="close-dialog">View feedback</button></div>',{floating:true});if(!r.duplicate)celebrateSubmission();}
    schedulePreparation(r.item.id);
    return r.item;
  }
  // A durable, new customer submission is the only celebration boundary.
  function celebrateSubmission(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||typeof Element.prototype.animate!=='function')return;
    const layer=document.createElement('div');layer.className='fs-confetti';layer.setAttribute('aria-hidden','true');modal.appendChild(layer);
    const animations=[],colors=['#153e5c','#8ab7cc','#4f8b75','#b7c3cc'];let stopped=false;
    const cleanup=()=>{if(stopped)return;stopped=true;animations.forEach(animation=>animation.cancel());layer.remove();modal.removeEventListener('close',cleanup);document.removeEventListener('visibilitychange',onVisibility);};
    const onVisibility=()=>{if(document.hidden)cleanup();};
    modal.addEventListener('close',cleanup,{once:true});document.addEventListener('visibilitychange',onVisibility);
    requestAnimationFrame(()=>{
      if(!modal.open||!layer.isConnected||document.hidden){cleanup();return;}
      const spread=Math.min(modal.clientWidth*.38,230);
      for(let i=0;i<32;i++){
        const piece=document.createElement('i'),direction=i%2?1:-1,x=direction*(35+Math.random()*spread),y=65+Math.random()*125,angle=Math.random()*240;
        piece.style.cssText='left:'+(i%2?62:38)+'%;background:'+colors[i%colors.length]+';width:'+(4+i%3)+'px;height:'+(7+i%5)+'px;';layer.appendChild(piece);
        animations.push(piece.animate([
          {transform:'translate3d(0,0,0) rotate('+angle+'deg)',opacity:0},
          {offset:.12,opacity:1},
          {offset:.45,transform:'translate3d('+(x*.65)+'px,'+(y*.12-24)+'px,0) rotate('+(angle+90)+'deg)',opacity:1},
          {transform:'translate3d('+x+'px,'+y+'px,0) rotate('+(angle+260)+'deg)',opacity:0}
        ],{duration:900+i%5*45,delay:i%4*16,easing:'cubic-bezier(.2,.65,.4,1)',fill:'both'}));
      }
      Promise.allSettled(animations.map(animation=>animation.finished)).then(cleanup);
    });
  }
  function rememberComposerDraft(descriptor,completedKey){
    if(completedKey)hubDrafts=hubDrafts.filter(draft=>draft.draftKey!==completedKey);
    hubDraft=descriptor;if(descriptor)hubDrafts=[descriptor,...hubDrafts.filter(draft=>draft.draftKey!==descriptor.draftKey)];
    hub.hasDraft=hubDrafts.length>0;syncUI();
  }
  function resumeComposer(key){
    const binding=hubDrafts.find(draft=>draft.draftKey===key)||hubDraft;
    if(!binding)return openComposer();
    if(binding.kind==='update'&&binding.actor!==actor)throw Error('This private draft belongs to another demo role. Use Demo controls to return to that perspective.');
    return binding.kind==='update'?openUpdateComposer(binding.action,'',binding):openComposer(undefined,binding);
  }
  async function useComposer(options,mode,descriptor){
    stopWatch();saveDraft();rememberSurface();
    if(composer?.element?.isConnected&&composer.draftKey!==options.draftKey){if(!await composer.close())return;}
    if(hub.mode==='closed')hub.mode=hubLastMode;
    hubResume='composer';rememberComposerDraft(descriptor);
    composer=root.FeedbackComposer.open({...options,managedHub:true,expanded:hub.mode==='full',onWorkspace:async()=>{if(composer&&!await composer.close())return;hubResume='workspace';page='inbox';hub.mode=hubLastMode;hub.composing=false;syncUI();render();app.querySelector('#feedback-main')?.focus({preventScroll:true});},onExpand:expanded=>{hub.mode=expanded?'full':'compact';hubLastMode=hub.mode;syncUI();render();},onClose:({submitted,discarded}={})=>{composer=null;hub.composing=false;if(submitted||discarded){hubResume='workspace';rememberComposerDraft(null,options.draftKey);}else hub.hasDraft=hubDrafts.length>0;render();}});
    if(mode)void composer.gather(mode);
    return composer;
  }
  function openComposer(mode,binding){
    const id=binding?.scenarioId||hostScenarioId,sourceScenario=clone(C.get(id)),context=binding?.context||contextSnapshot();
    const sourceKey=['winquote',id,context.quote,context.compartment,context.step].join(':');
    const draftKey=binding?.draftKey||(hubDrafts.some(draft=>draft.draftKey===sourceKey)?sourceKey+':'+Date.now().toString(36):sourceKey);
    const descriptor={kind:'new',scenarioId:id,context:clone(context),draftKey};
    return useComposer({scenarioId:id,context,feedback:sourceScenario.feedback,draftKey,legacyDraftKeys:['winquote:'+id],selectionRoot:()=>app.querySelector('.fs-host-surface [data-feedback-surface]'),getContext:()=>{const fresh=contextSnapshot();if(hostScenarioId!==id||fresh.quote!==context.quote||fresh.compartment!==context.compartment||fresh.step!==context.step)throw Error('Return to the original quote and section before adding page context. Your draft is still saved.');return fresh;},onSubmit:payload=>submitPayload(payload,false,sourceScenario)},mode,descriptor);
  }
  function openUpdateComposer(action,note='',binding){
    if(!binding&&(historyVersion||walkCursor!==null))throw Error('Return to the current version before adding feedback.');
    const id=binding?.ticketId||rendered.ticketId,rev=binding?.rev||rendered.rev,sequence=binding?.sequence??rendered.sequence,author=binding?.actor||actor;
    const correction=action==='correct-understanding',sourceId=binding?.scenarioId||scenarioId,context=binding?.context||{page:scenario().target,ticket:id,revision:rev};
    const draftKey=binding?.draftKey||action+':'+id+':V'+rev+':'+sequence;
    const descriptor={kind:'update',action,ticketId:id,rev,sequence,actor:author,scenarioId:sourceId,context:clone(context),draftKey};
    return useComposer({scenarioId:sourceId,title:correction?'Correct our understanding':'What needs to change?',description:'Your note and attachments stay with '+id+' · V'+rev+'. The website team will review them.',label:'Your note',submitLabel:'Send to the team',showTiming:false,allowSelection:false,feedback:note,draftKey,context,onSubmit:async payload=>{
      const fresh=read(),original=S.get(fresh,id);
      if(!original)throw Error('This feedback is unavailable. Your draft has been kept.');
      recordScene(original);
      const message=payload.text||'Please review the attached feedback evidence.';
      const evidence={attachments:payload.attachments,captureId:payload.captureId,context:payload.context};
      const r=S.commit(fresh,id,{expectedSequence:sequence,action,actor:author,value:correction?{text:message,...evidence}:{rev,reason:message,...evidence}});
      r.item.ux.drafts={};persist(r.data);routeTicket(id);notice='Your update and materials are with the website team. Saved to '+id+'.';render();
    }},null,descriptor);
  }
  addEventListener('feedback-composer-state',event=>{
    const state=event.detail||{};gatheringContext=!!state.gathering;hub.composing=!!(state.open&&!state.minimized);
    if(state.open){hub.hasDraft=true;hubResume='composer';if(state.minimized)hub.mode='closed';else hub.mode=state.expanded?'full':'compact';}
    if(state.gathering){hub.composing=true;const host=app.querySelector('.fs-host-surface');if(host)host.inert=false;for(const surface of app.querySelectorAll('.fs-hub-surface,.fs-hub-launcher'))surface.hidden=true;document.body.classList.remove('feedback-hub-full');return;}
    render();if(state.minimized)app.querySelector('[data-wq=hub-open]')?.focus({preventScroll:true});
  });
  function showModal(html,{floating=false}={}){returnFocus=document.activeElement;returnFocusSelector=returnFocus?.dataset?.wq?'[data-wq="'+CSS.escape(returnFocus.dataset.wq)+'"]':null;if(modal.open)modal.close();modal.className='fs-dialog'+(floating?' fs-receipt-floating':'');modal.innerHTML=html;floating?modal.show():modal.showModal();}
  function closeCaptureMenu(focus=false){const menu=app.querySelector('#feedback-context-menu'),trigger=app.querySelector('[data-wq=feedback-context-menu]');if(menu?.matches(':popover-open'))menu.hidePopover();trigger?.setAttribute('aria-expanded','false');if(focus)trigger?.focus();}
  function openCaptureMenu(){const menu=app.querySelector('#feedback-context-menu'),trigger=app.querySelector('[data-wq=feedback-context-menu]');if(!menu||!trigger)return;if(menu.matches(':popover-open')){closeCaptureMenu(true);return;}const box=trigger.getBoundingClientRect();Object.assign(menu.style,{top:Math.round(box.bottom+8)+'px',right:Math.max(12,Math.round(innerWidth-box.right))+'px'});menu.showPopover();trigger.setAttribute('aria-expanded','true');menu.querySelector('button')?.focus();menu.ontoggle=()=>trigger.setAttribute('aria-expanded',String(menu.matches(':popover-open')));}
  app.addEventListener('keydown',event=>{const menu=app.querySelector('#feedback-context-menu');if(event.target.closest('[data-wq=feedback-context-menu]')&&event.key==='ArrowDown'){event.preventDefault();openCaptureMenu();return;}if(!menu?.matches(':popover-open')||!menu.contains(event.target))return;if(event.key==='Escape'){event.preventDefault();closeCaptureMenu(true);return;}const buttons=[...menu.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}else if(event.key==='Tab')closeCaptureMenu(false);});
  function restoreFocus(){const usable=el=>el?.isConnected&&el.matches('a[href],button,input,textarea,select,summary,[tabindex]')&&!el.disabled&&!el.closest('[inert]')&&el.getClientRects().length;const prior=usable(returnFocus)?returnFocus:null,matched=returnFocusSelector?app.querySelector(returnFocusSelector):null;const target=prior||(usable(matched)?matched:null)||app.querySelector('#feedback-main');target?.focus({preventScroll:true});}
  function closeModal(){if(modal.open)modal.close();resultState=null;restoreFocus();}
  modal.addEventListener('close',restoreFocus);
  function openEmail(event){if(!event)throw Error('There is no customer update yet. Send a reviewed question or result first.');const url=location.origin+location.pathname+'?ticket='+encodeURIComponent(event.ticketId)+'&event='+encodeURIComponent(event.id);showModal('<div class="fs-eyebrow">Email preview · not sent</div><h2>'+esc(event.title)+'</h2><p>WinQuote · '+esc(event.ticketId)+'</p><p>'+esc(event.cta)+'. Your feedback and its history are kept together.</p><a class="fs-button fs-primary" href="'+esc(url)+'">'+esc(event.cta)+'</a><p class="fs-muted">This is a simulated notification. No email has been sent.</p><button class="fs-button" data-wq="close-dialog">Close preview</button>');}
  function stopWatch(){clearTimeout(watchTimer);watchTimer=null;consoleState.playing=false;}
  async function watchNext(){
    if(page==='site'){
      if(!site.walkProblemShown){
        site.walkProblemShown=true;
        if(scenarioId==='refrigeration'){site.noRefrigeration=true;site.savedNoRefrigeration=true;site.notice='Saved, but the equipment and charges remain. This is the problem the requester will report.';}
        else if(scenarioId==='pdf'){site.pdfGenerated=true;site.notice='The PDF was generated, but it did not open. The requester can report it here.';}
        else site.notice='The specification title and section labels do not identify their compartment. The requester can point this out here.';
        notice='Walkthrough simulation · the reported problem is visible on the original page.';render();return;
      }
      await submitPayload({text:scenario().feedback,occurredAt:'Just now',context:contextSnapshot(),attachments:[],captureId:'watch-'+Date.now()},true);return;
    }
    const item=current();if(!item)return startScenario(scenarioId);
    if(!item.c.reviewFlow){
      actor=roleOwner(item);const p=item.c.stage,answer=E.derive(item.c)?.clarification?.options?.[0]||'I want the button to say Start a new quote.';
      const steps={draft:['submit'],clarify:['answer',answer],processing:['deliver'],review:['accept',{rev:item.c.rev}],release:['authorize',{rev:item.c.rev}],authorized:['publish',{rev:item.c.rev}]};
      if(!steps[p]){stopWatch();notice='Continue in Practice to resolve this case.';render();return;}
      return apply(steps[p][0],steps[p][1],{simulated:true});
    }
    if(item.c.reviewFlow.needsMaterialReview)throw Error('This feedback needs the team’s judgement. Switch to Practice to review its materials.');
    const f=item.c.reviewFlow,p=f.phase;actor=roleOwner(item);if(actor==='Complete'){stopWatch();render();return;}
    let action,value;
    switch(p){
      case 'triage':action=f.evidenceFirst&&!f.planPrepared?'draft-plan':'confirm-scope';value=action==='confirm-scope'?f.scope:undefined;break;
      case 'spec-review':action='finish-spec';break;
      case 'question-draft':action=f.questionPreview?'send-questions':'preview-questions';break;
      case 'awaiting-answer':action='answer';value={bundleId:f.sentBundle.id,answers:Object.fromEntries(f.sentBundle.questions.map(q=>[q.id,q.type==='multi'?[q.options[0]]:q.options?.[0]||'Please keep this focused on the current quote.']))};break;
      case 'answer-review':if((f.suggestedScope?.decisionRequired||f.suggestedScope?.conflict))throw Error('This answer needs a team decision. Continue in Practice.');action=f.evidenceFirst&&!f.planPrepared?'draft-plan':'confirm-scope';value=action==='confirm-scope'?(f.suggestedScope||f.scope):undefined;break;
      case 'candidate':case 'checking':action='prepare-result';break;
      case 'ready':action='deliver';break;
      case 'review':action='accept';value={rev:item.c.rev};break;
      case 'accepted':action='authorize';value={rev:item.c.rev};break;
      case 'authorized':action='publish';value={rev:item.c.rev};break;
      case 'release-failed':action='retry-publish';value={rev:item.c.rev};break;
      default:stopWatch();return;
    }
    apply(action,value,{simulated:true});
  }
  function scheduleWatch(){clearTimeout(watchTimer);if(!consoleState.playing)return;watchTimer=setTimeout(async()=>{try{await watchNext();if(current()?.c.stage==='published')stopWatch();scheduleWatch();}catch(e){stopWatch();error=e.message;render();}},2600);}
  function startWatch(){if(historyVersion||walkCursor!==null){notice='Return to the current task before continuing the walkthrough.';render();return;}consoleState.mode='watch';consoleState.playing=true;consoleState.open=true;savePresentation();notice='Scripted roles and decisions will be simulated. Pause to take over.';render();scheduleWatch();}

  // Result previews run authored fixtures for the exact candidate, never arbitrary code.
  function openResult(){
    const item=current(),v=historyVersion?item.c.versions.find(v=>v.rev===historyVersion):null;
    const input=v||item.c;
    if(!item.c.reviewFlow){const p=P.describe(item,{rev:historyVersion||undefined,actor});showModal('<div class="fs-eyebrow">Candidate · V'+esc(p.viewedRev)+'</div><h2>Homepage quote button</h2><div class="fs-preview"><strong>'+esc(p.candidate||'No candidate recorded')+'</strong></div><h3>Review checks</h3><p>'+esc(Array.isArray(p.checks)?p.checks.join('\n'):p.checks||'No checks recorded.')+'</p><button class="fs-button" data-wq="close-dialog">Close result</button>');return;}
    const preview=E.reviewPreview(input);
    if(!preview.interactive)throw Error(preview.reason||'The team needs to update this result preview.');
    const rev=v?.rev||item.c.rev,signature=JSON.stringify(preview),saved=item.ux?.resultSessions?.[rev];
    resultState={preview,rev,ticketId:item.id,signature,model:preview.type==='pdf-workflow'?null:saved?.signature===signature?saved.model:root.ResultModel.create(preview),tab:'quote',pdfOpened:false,notice:''};
    showModal('');renderResult();
  }
  function updateResult(action,value){
    const r=resultState;r.model=root.ResultModel.update(r.model,action,value);
    const fresh=read(),item=S.get(fresh,r.ticketId);if(!item)throw Error('This feedback is no longer available.');
    item.ux.resultSessions||={};item.ux.resultSessions[r.rev]={signature:r.signature,model:r.model};persist(fresh);renderResult();
  }
  function renderResult(){
    const r=resultState;if(!r)return;
    const m=r.model,money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:m?.currency||'USD',maximumFractionDigits:0}).format(n);let html='';
    if(r.preview.type==='pdf-workflow')html='<div class="fs-preview"><div class="fs-eyebrow">Quote MW-1042 · Make PDF</div><h3>Your PDF is ready</h3><p>The saved customer PDF opens separately. This quote stays here.</p><div class="fs-actions"><button class="fs-button fs-primary" data-wq="result-pdf">Open saved PDF ↗</button><button class="fs-button" data-wq="result-workflow">Go to Workflow</button></div>'+(r.tab==='workflow'?'<p role="status">Workflow · Quote MW-1042</p><button class="fs-button" data-wq="result-back">Back to Make PDF</button>':'')+'</div>';
    else {
      const c=m.compartments.find(c=>c.id===m.selectedId);
      html='<div class="fs-toolbar">'+m.compartments.map(c=>'<button class="fs-button '+(m.selectedId===c.id?'fs-selected':'')+'" data-wq="result-compartment" data-value="'+esc(c.id)+'">'+esc(c.title||'Compartment '+c.number+' · '+c.type)+'</button>').join('')+'</div>';
      if(m.type==='compartment')html+='<div class="fs-preview"><label class="fs-field">Editable compartment title<input data-wq="result-title" maxlength="160" value="'+esc(c.title)+'"></label><h3>'+esc(c.title)+'</h3><div class="fs-preview-sections">'+c.sections.map(section=>'<section><strong>'+esc(m.repeatLabels?'Compartment '+c.number+' · '+c.type+' · '+section:section)+'</strong><p class="fs-muted">Settings for compartment '+c.number+'</p></section>').join('')+'</div><p class="fs-muted">Titles save in this preview. Switch compartments to check that the other title stays unchanged.</p></div>';
      else {
        const totals=root.ResultModel.totals(m),saved=totals.compartments.find(x=>x.id===c.id);
        html+='<div class="fs-preview"><div class="fs-eyebrow">Quote MW-1042 · Compartment '+c.number+' · '+esc(c.type)+'</div><h3>Refrigeration</h3><label class="fs-option"><input type="checkbox" data-wq="result-no-refrigeration" '+(c.draftNoRefrigeration?'checked':'')+'> No refrigeration required</label>'+
          (!c.draftNoRefrigeration?'<label class="fs-field">Equipment<select data-wq="result-equipment"><option value="">Select equipment</option>'+c.availableEquipment.map(e=>'<option value="'+esc(e.id)+'" '+(c.draftEquipment.some(x=>x.id===e.id)?'selected':'')+'>'+esc(e.label)+' · '+money(e.amount)+'</option>').join('')+'</select></label>':'')+
          '<p>'+esc(c.savedNoRefrigeration?'Saved: no refrigeration equipment':saved.equipment.length?'Saved: '+saved.equipment.map(e=>e.label).join(', '):'Saved: no equipment selected. Choose equipment when needed.')+'</p><div class="fs-metric"><span>Saved refrigeration amount</span><strong>'+money(saved.refrigerationAmount)+'</strong></div>'+
          '<div class="fs-actions"><button class="fs-button fs-primary" data-wq="result-save">Save this compartment</button><button class="fs-button" data-wq="result-summary">View quote summary</button></div><p class="fs-muted">'+(c.dirty?'Unsaved changes. Totals below still reflect the saved quote.':'This compartment is saved.')+'</p></div>';
        html+='<div class="fs-preview"><h3>Saved quote summary</h3>'+totals.compartments.map(row=>'<div class="fs-metric"><span>Compartment '+row.number+' · '+esc(row.type)+'<small style="display:block">Base '+money(row.baseAmount)+' + refrigeration '+money(row.refrigerationAmount)+'</small></span><strong>'+money(row.total)+'</strong></div>').join('')+'<div class="fs-metric"><strong>Quote total</strong><strong>'+money(totals.quoteTotal)+'</strong></div><p class="fs-muted">Illustrative amounts. Only the selected compartment changes.</p></div>';
        if(r.tab==='summary')html+='<div class="fs-preview" role="status"><div class="fs-eyebrow">Simulated PDF · same saved quote</div><h3>Quote MW-1042</h3>'+totals.pdf.compartments.map(row=>'<div class="fs-metric"><span>Compartment '+row.number+' · '+esc(row.type)+'</span><strong>'+money(row.total)+'</strong></div>').join('')+'<div class="fs-metric"><strong>Total</strong><strong>'+money(totals.pdf.total)+'</strong></div></div>';
      }
    }
    modal.innerHTML='<div class="fs-toolbar"><span class="fs-eyebrow">Interactive result · V'+r.rev+' · Simulation</span><button class="fs-button" data-wq="close-dialog">Close result</button></div><h2>'+esc(scenario().title)+'</h2>'+html+(r.notice?'<p role="status">'+esc(r.notice)+'</p>':'')+'<p class="fs-muted">This fixture demonstrates the proposal. It does not change a live WinQuote quote.</p>';
  }
  function openPDF(){
    const w=window.open('','_blank');if(!w)throw Error('The browser blocked the new tab. Allow pop-ups, then select Open saved PDF again.');
    w.opener=null;w.document.write('<!doctype html><html lang="en"><title>MW-1042 · Sample customer PDF</title><style>body{font:16px system-ui;max-width:700px;margin:60px auto;padding:24px;color:#222}h1{font-family:Georgia}small{color:#666}section{border-top:1px solid #ddd;padding:24px 0}</style><small>WINQUOTE · SIMULATED PDF PREVIEW</small><h1>Quote MW-1042</h1><section>Customer quote<br>Walk-in cooler configuration</section><p>This is an authored document preview for the demo, not a generated customer PDF.</p><p>Your Make PDF tab remains open.</p></html>');w.document.close();if(resultState){resultState.pdfOpened=true;resultState.notice='Opened the sample document in a separate tab. This quote is still here.';renderResult();}
  }
  async function openAttachment(id){const result=await root.FeedbackMediaStore.get(id);if(!result)throw Error('This attachment is not available on this device.');const url=URL.createObjectURL(result.blob);showModal('<h2>'+esc(result.manifest.name||'Attached evidence')+'</h2>'+(result.manifest.kind==='audio'?'<audio controls src="'+url+'"></audio>':'<img class="fs-evidence-image" alt="Attached feedback evidence" src="'+url+'">')+'<p><button class="fs-button" data-wq="close-dialog">Close</button></p>');modal.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});}

  async function handle(action,value,el){
    error='';rememberSurface();
    if(action!=='watch-toggle'&&action!=='watch-next'&&consoleState.playing)stopWatch();
    switch(action){
      case 'hub-open':if(hubResume==='composer'&&hubDraft&&(hubDraft.kind!=='update'||hubDraft.actor===actor))return resumeComposer(hubDraft.draftKey);if(page==='site')page='inbox';if(page==='ticket'&&current())persist(S.visit(read(),current().id).data);return setHubMode(hubLastMode);
      case 'hub-minimize':return setHubMode('closed');
      case 'hub-expand':return setHubMode('full');
      case 'hub-shrink':return setHubMode('compact');
      case 'hub-home':return go('inbox');
      case 'inspector-open':return openInspector({kind:el.dataset.kind,id:value},el);
      case 'inspector-list':return openInspector({kind:'list',section:value,query:''},el);
      case 'inspector-back':return backInspector();
      case 'inspector-search':return;
      case 'nav-inbox':history.replaceState({},'',location.pathname);return go('inbox');
      case 'nav-updates':return go('updates');
      case 'open-ticket':return routeTicket(value);
      case 'open-update':{const ev=S.attention(data,{actor}).updates.find(x=>x.id===value);if(ev)return routeTicket(ev.ticketId,ev.id);break;}
      case 'start-scenario':return startScenario(value||'pdf');
      case 'open-composer':return openComposer();
      case 'resume-composer':return resumeComposer(value);
      case 'feedback-context-menu':return openCaptureMenu();
      case 'gather-context':closeCaptureMenu();return openComposer(value);
      case 'resume':if(current())return routeTicket(current().id);return startScenario(scenarioId);
      case 'open-console':saveDraft();consoleState.open=true;break;
      case 'close-console':saveDraft();consoleState.open=false;break;
      case 'change-role':if(!['Requester','Website team','Site owner'].includes(value))return;saveDraft();actor=value;historyVersion=null;syncUI();break;
      case 'change-mode':saveDraft();consoleState.mode=value;stopWatch();break;
      case 'walk-back':{saveDraft();stopWatch();historyVersion=null;const scenes=current()?.ux?.walk?.scenes||[];walkCursor=walkCursor===null?Math.max(0,scenes.length-1):Math.max(0,walkCursor-1);if(!scenes.length)return go('inbox');notice='Earlier walkthrough view. The current feedback has not changed.';break;}
      case 'walk-current':walkCursor=null;historyVersion=null;notice='Back at the current task. Your work is unchanged.';break;
      case 'walk-restart':saveDraft();stopWatch();walkCursor=null;historyVersion=null;notice='';return startScenario(scenarioId);
      case 'context-tab':saveDraft();contextTab=value==='activity'?'activity':'details';break;
      case 'watch-toggle':if(consoleState.playing)stopWatch();else return startWatch();break;
      case 'watch-next':await watchNext();return;
      case 'advance-time':{let next=S.advance(read(),3);for(const item of S.customerItems(next)){if(S.status(item,S.now(next)).overdue)next=S.recordDelay(next,item.id,{reason:'The team is still reviewing the evidence. A revised checkpoint has not been confirmed.'}).data;}persist(next);notice='Simulation advanced by 3 hours. Delayed checkpoints are recorded in Updates; no background work or email delivery occurred.';break;}
      case 'legacy-links':showModal('<h2>Earlier walkthroughs</h2><p>These original examples remain available. They use the same saved workspace.</p><div class="fs-actions">'+[['create','Explore “Create”'],['pdf','PDF · team review'],['pdf&branch=ask&mode=practice','PDF · ask the customer'],['journey','Two-round journey'],['customer&mode=practice','Requester practice'],['team&mode=practice','Website team practice'],['publisher&mode=practice','Site owner practice']].map(([q,t])=>'<a class="fs-button" href="?walkthrough='+q+'">'+t+'</a>').join('')+'</div><button class="fs-button" data-wq="close-dialog">Close</button>');return;
      case 'back':if(historyVersion||walkCursor!==null){historyVersion=null;walkCursor=null;break;}return go('inbox');
      case 'toggle-context':saveDraft();contextOpen=!contextOpen;render();configureDrawer(true);return;
      case 'filter-inbox':filter=value;break;
      case 'search-inbox':search=value;break;
      case 'mark-read-all':{const next=read();next.feedbackExperience.read=[...new Set([...(next.feedbackExperience.read||[]),...S.attention(next,{actor}).updates.map(e=>e.id)])];persist(next);break;}
      case 'simulate-email':return openEmail(S.updates(data).find(e=>e.ticketId===data.current));
      case 'open-attachment':return openAttachment(value);
      case 'view-version':saveDraft();walkCursor=null;historyVersion=Number(value);notice='Historical version. Return to the current task to take action.';break;
      case 'current-version':historyVersion=null;walkCursor=null;notice='';break;
      case 'activity':showModal('<h2>Activity</h2>'+(current()?.c.trail||[]).filter(t=>actor==='Website team'||['submit','send-questions','answer','confirm-scope','correct-understanding','deliver','adjust','accept','authorize','publish','publish-failed','retry-publish'].includes(t.action)).slice().reverse().map(t=>'<div class="fs-activity"><strong>'+esc(t.actor)+'</strong><p>'+esc(t.text)+'</p><small>'+esc(new Date(t.at).toLocaleString())+'</small></div>').join('')+'<button class="fs-button" data-wq="close-dialog">Close</button>');return;
      case 'set-next-update':if(actor!=='Website team')throw Error('The website team owns this checkpoint.');persist(S.setExpectation(read(),current().id,{at:new Date(Date.parse(S.now(data))+2*3600000).toISOString(),reason:'The team is checking the result before sending it.'}).data);notice='Next update set for two simulated hours from now.';break;
      case 'resume-preparation':schedulePreparation(current().id,true);notice='Simulated preparation resumed on this device. The team still needs to review it.';break;
      case 'dismiss-return-summary':changeRecord(i=>{delete i.ux.sinceLastVisit;});break;
      case 'legacy-submit':return apply('submit');
      case 'legacy-answer':return apply('answer',app.querySelector('textarea[name=answer]')?.value.trim()||app.querySelector('input[name=answer]:checked')?.value||field('answer'));
      case 'legacy-prepare':return apply('edit-candidate',field('candidate'));
      case 'legacy-deliver':return apply('deliver');
      case 'legacy-accept':return apply('accept',{rev:rendered.rev});
      case 'legacy-authorize':return apply('authorize',{rev:rendered.rev});
      case 'legacy-publish':return apply('publish',{rev:rendered.rev});
      case 'legacy-adjust':return openUpdateComposer('adjust');
      case 'keep-working':closeModal();return setHubMode('closed');
      case 'close-dialog':return closeModal();
      case 'site-select-compartment':site.compartment=value;site.title=value==='1'?'Cooler':'Freezer';break;
      case 'site-title':site.title=value;return;
      case 'site-no-refrigeration':site.noRefrigeration=el.checked;return;
      case 'site-save':site.savedNoRefrigeration=site.noRefrigeration;site.notice=hostScenarioId==='compartment'?'Saved. The section labels still do not identify which compartment they belong to.':site.noRefrigeration?'Saved. The selected equipment and amount are still visible — this is the issue to report.':'Saved. Refrigeration is included in this quote.';break;
      case 'site-make-pdf':site.pdfGenerated=true;site.notice='PDF generated. It did not open automatically — this is the issue to report.';break;
      case 'site-workflow':site.section='workflow';break;
      case 'site-back':site.section='make-pdf';break;
      case 'select-variant':{const selected=C.variant(scenarioId,value);if(!selected)throw Error('That candidate is unavailable.');return apply('edit-candidate',selected.scope);}
      case 'save-questions':return apply('save-questions',readQuestions());
      case 'preview-questions':apply('save-questions',readQuestions(),{quiet:true});return apply('preview-questions');
      case 'send-questions':{const qs=readQuestions(),pick=rows=>rows.filter(q=>q.disposition==='ask'||!q.disposition).map(q=>[q.id,q.text,q.type,q.options,q.required,q.minSelections,q.maxSelections,q.exclusiveOptionIds]);const unchanged=JSON.stringify(pick(qs))===JSON.stringify(pick(current().c.reviewFlow.questionPreview?.questions||[]));apply('save-questions',qs,{quiet:true});apply('preview-questions',undefined,{quiet:true});if(!unchanged){notice='The customer preview changed. Review it before sending.';render();return;}return apply('send-questions');}
      case 'answer':return apply('answer',{bundleId:rendered?.bundleId,answers:readAnswers(),answerNotes:readAnswerNotes()});
      case 'confirm-scope':return apply('confirm-scope',formScope());
      case 'edit-candidate':{if(!app.querySelector('[name=approach]')&&(!modal.open||!modal.querySelector('[name=approach]'))){const scope=current().c.reviewFlow.candidateDraft||current().c.reviewFlow.scope;showModal('<h2>Edit version '+current().c.rev+'</h2><p>Editing this candidate clears its prepared result. Prepare it again before sending.</p><label class="fs-field">Proposed behavior<textarea name="approach" rows="5">'+esc(scope.approach)+'</textarea></label><label class="fs-field">Acceptance checks<textarea name="checks" rows="5">'+esc(scope.checks)+'</textarea></label><div class="fs-actions"><button class="fs-button" data-wq="close-dialog">Cancel</button><button class="fs-button fs-primary" data-wq="edit-candidate">Save draft</button></div>');return;}const updated=apply('edit-candidate',{approach:field('approach'),checks:field('checks')});if(modal.open)closeModal();return updated;}
      case 'prepare-result':if(app.querySelector('[name=approach]'))apply('edit-candidate',{approach:field('approach'),checks:field('checks')},{quiet:true});return apply('prepare-result');
      case 'adjust':case 'request-release-changes':case 'correct-understanding':return openUpdateComposer(action);
      case 'adjustment-media':{const note=field('reason');closeModal();return openUpdateComposer(value,note);}
      case 'accept':case 'authorize':case 'publish':case 'retry-publish':return apply(action,{rev:current().c.rev});
      case 'publish-failed':return apply(action,{rev:current().c.rev,reason:'The simulated release attempt did not complete. The approved version is unchanged.'});
      case 'open-result':if(value)historyVersion=Number(value);return openResult();
      case 'add-question':{const qs=readQuestions();qs.push({id:'question-'+Date.now(),text:'What additional business detail should the team consider?',type:'text',options:[],reason:'Edit this draft to ask only for missing customer context.',required:true,disposition:'team'});return apply('save-questions',qs);}
      case 'close-questions':saveDraft();return apply('close-questions');
      case 'result-compartment':return updateResult('select-compartment',value);
      case 'result-title':return updateResult('title',value);
      case 'result-no-refrigeration':return updateResult('toggle',el.checked);
      case 'result-equipment':return updateResult('select-equipment',value?[value]:[]);
      case 'result-save':resultState.notice='Saved. The quote summary and simulated PDF use this same saved state.';return updateResult('save');
      case 'result-summary':resultState.tab='summary';return renderResult();
      case 'result-pdf':return openPDF();
      case 'result-workflow':resultState.tab='workflow';return renderResult();
      case 'result-back':resultState.tab='quote';return renderResult();
      default:if(['draft-plan','draft-questions','reopen-clarification','begin-detailed-questions','finish-spec','deliver'].includes(action))return apply(action);return;
    }
    savePresentation();render();
  }
  document.addEventListener('click',async event=>{const el=event.target.closest('[data-wq]');if(!el||!app.contains(el)&&!modal.contains(el)||['INPUT','SELECT','TEXTAREA'].includes(el.tagName))return;event.preventDefault();try{await handle(el.dataset.wq,el.dataset.value,el);}catch(e){stopWatch();showError(e);}});
  document.addEventListener('change',async event=>{const el=event.target;if(!app.contains(el)&&!modal.contains(el))return;try{if(el.dataset.wq)await handle(el.dataset.wq,el.value,el);else saveDraft();}catch(e){showError(e);}});
  app.addEventListener('input',event=>{const el=event.target;if(el.dataset.wq==='inspector-search'){const start=el.selectionStart;inspector.view={...inspector.view,query:el.value};render();const input=app.querySelector('[data-wq=inspector-search]');input?.focus({preventScroll:true});try{input?.setSelectionRange(start,start);}catch{}return;}if(el.matches('[data-wq="search-inbox"]')){search=el.value;return;}if(el.dataset.wq==='site-title')site.title=el.value;if(el.name||el.dataset.answerId||el.closest('[data-question-id]'))saveDraft();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopWatch();saveDraft();syncUI();}else if(current()?.ux?.preparation?.paused)render();});
  window.addEventListener('pagehide',()=>{stopWatch();pausePreparation();saveDraft();syncUI();for(const value of mediaCache.values())if(value.url)URL.revokeObjectURL(value.url);mediaCache.clear();});
  window.addEventListener('storage',event=>{if(event.key!==S.key)return;notice='Feedback changed in another tab. Your current input is still here; reopen the task to see its latest state.';if(hub.mode==='closed'||page!=='ticket'){data=read();render();}if(document.getElementById('live'))document.getElementById('live').textContent=notice;});
  if(query.has('ticket')){hub.mode=hubLastMode='full';routeTicket(query.get('ticket'),query.get('event'));}
  else if(query.has('workflow'))startScenario(query.get('workflow'));
  else {if(page==='ticket'&&!current())page='inbox';if(page==='ticket'&&current())restorePresentation(current());notice=current()?'Welcome back. Continue your feedback from its current step.':'';render();}
})(globalThis);
