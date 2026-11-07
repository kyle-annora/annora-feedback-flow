const test=require('node:test');
const assert=require('node:assert/strict');
const {contextForAttachments,mergePageContext,payload}=require('./capture-composer.js');
const Composer=require('./capture-composer.js');
test('capture context belongs only to its attached image, with unrelated context unchanged',()=>{
 const original={ticket:'WQ-021',revision:2,selection:{label:'Generate PDF'},screenCapture:{kind:'Legacy unbound claim'},screenCaptures:{one:{kind:'Shared tab screenshot',crop:{x:10}},two:{kind:'Shared tab screenshot'},audio:{kind:'Wrong kind'},missing:{kind:'Detached screenshot'}}};
 const attachments=[{id:'one',kind:'image'},{id:'two',kind:'image'},{id:'audio',kind:'audio'}];
 const both=contextForAttachments(original,attachments);assert.deepEqual(Object.keys(both.screenCaptures),['one','two']);assert.equal('screenCapture' in both,false);assert.equal(both.ticket,'WQ-021');assert.equal(both.revision,2);
 const removed=contextForAttachments(both,attachments.filter(a=>a.id!=='one'));assert.deepEqual(Object.keys(removed.screenCaptures),['two']);assert.equal(original.screenCaptures.one.crop.x,10);
 const none=contextForAttachments(removed,[]);assert.equal('screenCaptures' in none,false);assert.deepEqual(none.selection,{label:'Generate PDF'});
});
test('submitted capture metadata is independently snapshotted and cannot claim a missing file',()=>{
 const source={captureId:'c',text:'PDF issue',attachments:[{id:'one',kind:'image'}],context:{screenCaptures:{one:{kind:'Shared tab screenshot',width:800},lost:{kind:'Missing file'}}}};
 const submitted=payload(source);source.context.screenCaptures.one.width=20;assert.equal(submitted.context.screenCaptures.one.width,800);assert.equal('lost' in submitted.context.screenCaptures,false);
});

test('explicit recapture refreshes page state without crossing the original ticket or version',()=>{
 const old={ticket:'WQ-021',revision:1,scenarioId:'pdf',state:{pdfGenerated:false},capturedAt:'before',selection:{label:'PDF action'},screenCaptures:{one:{kind:'Shared tab screenshot'}}};
 const updated=mergePageContext(old,{ticket:'other',revision:7,scenarioId:'different',state:{pdfGenerated:true},capturedAt:'after'});
 assert.equal(updated.ticket,'WQ-021');assert.equal(updated.revision,1);assert.equal(updated.scenarioId,'pdf');assert.equal(updated.state.pdfGenerated,true);assert.equal(updated.capturedAt,'after');assert.deepEqual(updated.selection,old.selection);assert.deepEqual(updated.screenCaptures,old.screenCaptures);assert.equal(old.state.pdfGenerated,false);
 assert.deepEqual(mergePageContext(old,null),old);
});

test('legacy draft recovery requires the same source quote, compartment and page, and never deletes old data',async()=>{
 const initial={schema:1,scenarioId:'refrigeration',context:{quote:'MW-1042',compartment:'1',page:'Refrigeration'}};
 const old={...initial,text:'Keep my earlier report.',attachments:[{id:'one',kind:'image'}]};
 assert.equal(Composer.legacyDraftMatches(old,initial),true);
 for(const patch of [{quote:'OTHER'},{compartment:'2'},{page:'Make PDF'},{page:undefined}]){
  assert.equal(Composer.legacyDraftMatches({...old,context:{...old.context,...patch}},initial),false);
 }
 assert.equal(Composer.legacyDraftMatches({...old,scenarioId:'pdf'},initial),false);
 const entries=new Map([['old',{...old,context:{...old.context,compartment:'2'}}],['matching',old]]);
 const reads=[],store={getDraft:async key=>{reads.push(key);return entries.get(key);}};
 const recovered=await Composer.recoverDraft(store,'source-bound',['old','matching'],initial);
 assert.equal(recovered.legacyKey,'matching');assert.equal(recovered.draft.text,old.text);
 assert.deepEqual(reads,['source-bound','source-bound:legacy-recovery','old','matching']);assert.equal(entries.size,2);
 entries.set('source-bound',{...initial,text:'The new source-bound draft'});
 assert.equal((await Composer.recoverDraft(store,'source-bound',['matching'],initial)).draft.text,'The new source-bound draft');
 assert.equal(entries.get('matching').text,old.text);
});
test('a persistent migration receipt prevents a submitted source-bound draft from resurrecting its preserved legacy copy',async()=>{
 const initial={schema:1,scenarioId:'pdf',context:{quote:'MW-1042',page:'Make PDF',compartment:'1'}};
 const legacy={...initial,captureId:'capture-original',text:'Earlier draft',attachments:[]};
 const entries=new Map([['winquote:pdf',legacy]]);
 const store={getDraft:async key=>entries.get(key),saveDraft:async(key,value)=>entries.set(key,JSON.parse(JSON.stringify(value)))};
 const first=await Composer.recoverDraft(store,'bound',['winquote:pdf'],initial);
 assert.equal(first.legacyKey,'winquote:pdf');
 await store.saveDraft('bound',first.draft);
 await Composer.recordLegacyRecovery(store,'bound',first.draft.legacyRecovery);
 entries.delete('bound'); // Same boundary used after successful submission.
 assert.equal((await Composer.recoverDraft(store,'bound',['winquote:pdf'],initial)).draft,null);
 assert.equal(entries.get('winquote:pdf').text,'Earlier draft','The archival legacy draft is preserved.');
 assert.equal(entries.get('bound:legacy-recovery').imports.length,1);
 await Composer.recordLegacyRecovery(store,'bound',first.draft.legacyRecovery);
 assert.equal(entries.get('bound:legacy-recovery').imports.length,1,'Recovery records are idempotent.');
});

function mockComposerHost(){
 const originals={};
 for(const key of ['document','FeedbackCaptureContext','FeedbackCaptureMedia','dispatchEvent','addEventListener','removeEventListener','CustomEvent'])originals[key]=Object.getOwnPropertyDescriptor(globalThis,key);
 const events=[],nodes=new Map(),records=new Map(),pickCalls=[],captureCalls=[];
 function node(selector=''){
  const attributes=new Map(),classes=new Set(),listeners={};
  const n={selector,hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',scrollTop:0,dataset:{},isConnected:true,open:false,style:{},
   classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,on)=>{if(on===undefined)on=!classes.has(x);on?classes.add(x):classes.delete(x);}},
   setAttribute:(k,v)=>attributes.set(k,String(v)),getAttribute:k=>attributes.get(k),removeAttribute:k=>attributes.delete(k),
   addEventListener:(type,fn)=>listeners[type]=fn,removeEventListener:()=>{},focus:()=>{},contains:()=>false,closest:()=>null,
   querySelector:key=>{const full=selector+':'+key;if(!nodes.has(full))nodes.set(full,node(full));return nodes.get(full);},
   querySelectorAll:()=>[],append:()=>{},remove(){this.isConnected=false;},listeners};
  return n;
 }
 const dialog=node('dialog'),body=node('body');body.append=()=>{};
 const doc={body,activeElement:null,hidden:false,createElement:()=>dialog,querySelector:()=>null,addEventListener:()=>{},removeEventListener:()=>{}};
 const context={capture:value=>JSON.parse(JSON.stringify(value||{})),pick:options=>{pickCalls.push(options);return {cancel:()=>{}};},captureImage:options=>{captureCalls.push(options);return Promise.resolve(null);}};
 const media={createRecorder:()=>({state:'idle',cancel(){},destroy(){},stop:async()=>{},start:async()=>{}})};
 const store={getDraft:async key=>records.get(key),saveDraft:async(key,value)=>{records.set(key,JSON.parse(JSON.stringify(value)));},get:async()=>({blob:new Blob(['sample'],{type:'image/png'})}),put:async()=>{},remove:async()=>{},claim:async()=>{},clearDraft:async key=>records.delete(key)};
 globalThis.document=doc;globalThis.FeedbackCaptureContext=context;globalThis.FeedbackCaptureMedia=media;
 globalThis.dispatchEvent=event=>events.push(event);globalThis.addEventListener=()=>{};globalThis.removeEventListener=()=>{};
 globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options.detail;}};
 return {dialog,store,events,pickCalls,captureCalls,node:key=>dialog.querySelector(key),restore(){for(const [key,descriptor] of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}
test('managed composer expands and minimizes the same input DOM and reports its presentation state',async()=>{
 const host=mockComposerHost();let composer,expanded=[],backCalls=0;
 try{
  composer=Composer.open({managedHub:true,store:host.store,draftKey:'managed',scenarioId:'pdf',context:{page:'Make PDF',quote:'MW-1042'},onSubmit:async()=>{},onExpand:value=>expanded.push(value),onWorkspace:()=>{backCalls++;}});
  await composer.ready;
  assert.match(host.dialog.innerHTML,/data-fc="workspace"[\s\S]*?Back to feedback/);assert.doesNotMatch(host.dialog.innerHTML,/data-fc="close"/);
  const field=host.node('#fc-text'),body=host.node('.fc-body');field.value='Keep this exact long answer.';body.scrollTop=219;
  assert.equal(composer.setExpanded(true),true);assert.equal(composer.status.expanded,true);assert.equal(host.node('#fc-text'),field);assert.equal(field.value,'Keep this exact long answer.');assert.equal(body.scrollTop,219);
  composer.setExpanded(false);assert.deepEqual(expanded,[true,false]);
  await composer.minimize();assert.equal(composer.status.minimized,true);assert.equal(host.dialog.hidden,true);assert.equal(host.node('.fc-collapsed').hidden,true);
  composer.restore();assert.equal(host.dialog.hidden,false);assert.equal(field.value,'Keep this exact long answer.');
  await host.dialog.listeners.click({target:{closest:()=>({dataset:{fc:'workspace'}})},preventDefault(){}});assert.equal(backCalls,1);assert.equal(composer.status.minimized,true);assert.equal((await host.store.getDraft('managed')).text,field.value);assert.equal(composer.status.closed,false);
  assert.ok(host.events.some(event=>event.detail.expanded===true&&event.detail.gathering===false));
  assert.equal(await composer.close(),true);assert.equal(composer.status.closed,true);assert.equal(host.store&&host.dialog.isConnected,false);
 }finally{composer?.destroy();host.restore();}
});
test('legacy composer retains its explicit save and close action',async()=>{
 const host=mockComposerHost();let composer;
 try{composer=Composer.open({store:host.store,draftKey:'legacy-ui',scenarioId:'pdf',context:{page:'Make PDF',quote:'MW-1042'},onSubmit:async()=>{}});await composer.ready;assert.match(host.dialog.innerHTML,/data-fc="close"[^>]*aria-label="Save and close feedback"/);assert.doesNotMatch(host.dialog.innerHTML,/data-fc="workspace"/);}finally{composer?.destroy();host.restore();}
});
test('source validation fails before an element picker or browser capture is started',async()=>{
 const host=mockComposerHost();let composer,checks=0;
 try{
  composer=Composer.open({managedHub:true,store:host.store,draftKey:'guarded',scenarioId:'pdf',context:{page:'Make PDF',quote:'MW-1042'},getContext:()=>{checks++;throw new Error('Return to the original quote before capturing.');},onSubmit:async()=>{}});
  await composer.ready;await composer.gather('element');assert.equal(host.pickCalls.length,0);
  await composer.gather('page');assert.equal(host.captureCalls.length,0);assert.equal(checks,2);
  assert.match(host.node('.fc-error').textContent,/original quote/);assert.equal(composer.status.gathering,false);assert.equal(host.dialog.hidden,false);
 }finally{composer?.destroy();host.restore();}
});
test('element gathering emits begin/end and uses the validated context snapshot even if the host later changes',async()=>{
 const host=mockComposerHost();let composer,reads=0;
 try{
  composer=Composer.open({managedHub:true,store:host.store,draftKey:'selection',scenarioId:'pdf',context:{page:'Make PDF',quote:'MW-1042'},getContext:()=>{reads++;return {page:'Make PDF',quote:'MW-1042',state:{pdfGenerated:false}};},onSubmit:async()=>{}});
  await composer.ready;await composer.gather('element');
  assert.equal(reads,1);assert.equal(host.pickCalls.length,1);assert.equal(composer.status.gathering,true);assert.equal(host.dialog.hidden,true);
  host.pickCalls[0].onSelect({label:'Generate PDF'});
  assert.equal(reads,1);assert.equal(composer.status.gathering,false);assert.equal(host.dialog.hidden,false);
  assert.equal(composer.getDraft().context.selection.label,'Generate PDF');
  assert.ok(host.events.some(event=>event.detail.gathering===true));
  assert.equal(host.events.at(-1).detail.gathering,false);
 }finally{composer?.destroy();host.restore();}
});

test('Back to feedback does not leave the editor when its latest draft cannot be saved',async()=>{
 const host=mockComposerHost();let composer,returned=0;
 try{
  composer=Composer.open({managedHub:true,store:host.store,draftKey:'unsaved-return',scenarioId:'pdf',context:{page:'Make PDF',quote:'MW-1042'},onSubmit:async()=>{},onWorkspace:()=>{returned++;}});
  await composer.ready;host.node('#fc-text').value='Do not lose this unsaved correction.';
  host.store.saveDraft=async()=>{throw Error('Not enough device storage.');};
  await host.dialog.listeners.click({target:{closest:()=>({dataset:{fc:'workspace'}})},preventDefault(){}});
  assert.equal(returned,0);assert.equal(composer.status.minimized,false);assert.equal(host.dialog.hidden,false);
  assert.equal(composer.getDraft().text,'Do not lose this unsaved correction.');assert.match(host.node('.fc-error').textContent,/storage/);
 }finally{composer?.destroy();host.restore();}
});
