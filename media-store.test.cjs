const test=require('node:test');
const assert=require('node:assert/strict');
const {createStore,validate}=require('./media-store.js');

// Small asynchronous, transactional adapter. Browser IndexedDB is also checked in the preview.
function database(){
 const tables=new Map(),fault={nextWrite:null};
 const db={objectStoreNames:{contains:n=>tables.has(n)},createObjectStore(n){tables.set(n,new Map());},close(){},transaction(names,mode){
  const copies=new Map(names.map(n=>[n,new Map([...tables.get(n)].map(([k,v])=>[k,structuredClone(v)]))]));let pending=0,done=false;
  const tx={abort(){if(done)return;done=true;queueMicrotask(()=>tx.onabort?.());},objectStore(name){
   function operation(kind,key,value){const request={};pending++;queueMicrotask(()=>{if(done)return;try{
    const table=copies.get(name);if(kind!=='get'&&fault.nextWrite){const name=fault.nextWrite;fault.nextWrite=null;throw Object.assign(new Error(name),{name});}
    if(kind==='add'&&table.has(key))throw Object.assign(new Error('Duplicate media ID'),{name:'ConstraintError'});
    if(kind==='get')request.result=structuredClone(table.get(key));else if(kind==='delete')table.delete(key);else table.set(key,structuredClone(value));
    request.onsuccess?.();
   }catch(error){tx.error=request.error=error;tx.abort();}finally{pending--;complete();}});return request;}
   return {get:k=>operation('get',k),add:v=>operation('add',v.id??v.key,v),put:v=>operation('put',v.id??v.key,v),delete:k=>operation('delete',k)};
  }};
  function complete(){setImmediate(()=>{if(done||pending)return;done=true;if(mode==='readwrite')for(const [n,t] of copies)tables.set(n,t);tx.oncomplete?.();});}complete();return tx;
 }};
 return {fault,open(){const req={result:db};queueMicrotask(()=>{if(!tables.size)req.onupgradeneeded?.();req.onsuccess?.();});return req;}};
}
function setup(){const indexedDB=database();let next=0;const store=createStore({indexedDB,id:()=>`media-${++next}`,now:()=> '2026-11-05T00:00:00Z'});return {store,indexedDB};}
const image=()=>new Blob(['real binary fixture'],{type:'image/png'});

test('media originals are immutable and retrievable after opening another store instance',async()=>{
 const {store,indexedDB}=setup(),original=image(),manifest=await store.put(original,{name:'screen.png',source:'paste'});
 assert.ok(Object.isFrozen(manifest));assert.equal(manifest.localOnly,true);assert.equal(manifest.source,'paste');assert.equal(manifest.blobKey,manifest.id);
 const reopened=createStore({indexedDB});const result=await reopened.get(manifest.id);assert.equal(await result.blob.text(),await original.text());
 result.manifest.name='changed';assert.equal((await store.get(manifest.id)).manifest.name,'screen.png');
 const collision=createStore({indexedDB,id:()=>manifest.id});await assert.rejects(collision.put(image()),/Duplicate/);assert.equal((await store.get(manifest.id)).manifest.name,'screen.png');
});
test('draft refresh restores only manifest references and protects originals until unreferenced',async()=>{
 const {store}=setup(),manifest=await store.put(image());await store.saveDraft('draft-a',{text:'',attachments:[manifest]});
 const restored=await store.getDraft('draft-a');assert.equal(restored.text,'');assert.equal(restored.attachments[0].id,manifest.id);assert.equal('blob' in restored.attachments[0],false);
 assert.equal(await store.remove(manifest.id),false);await store.clearDraft('draft-a');assert.equal(await store.remove(manifest.id),true);await assert.rejects(store.get(manifest.id),/no longer/);
});
test('submitted original survives draft cleanup, replacement and later removal attempts',async()=>{
 const {store}=setup(),v1=await store.put(image()),v2=await store.put(image());await store.saveDraft('draft-a',{attachments:[v1]});await store.claim([v1.id],'capture-one');
 await store.saveDraft('draft-a',{attachments:[v2]});assert.equal(await store.remove(v1.id),false);await store.clearDraft('draft-a');assert.equal(await store.remove(v2.id),true);assert.equal(await (await store.get(v1.id)).blob.text(),'real binary fixture');
});
test('quota failure rejects save and preserves the previous draft, never false success',async()=>{
 const {store,indexedDB}=setup();await store.saveDraft('draft-a',{text:'saved',attachments:[]});indexedDB.fault.nextWrite='QuotaExceededError';
 await assert.rejects(store.saveDraft('draft-a',{text:'not saved',attachments:[]}),/no space/);assert.equal((await store.getDraft('draft-a')).text,'saved');
 indexedDB.fault.nextWrite='QuotaExceededError';await assert.rejects(store.put(image()),/no space/);await assert.rejects(store.get('media-1'),/no longer/);
});
test('missing attachment aborts draft transaction and prevents claim',async()=>{
 const {store}=setup();await store.saveDraft('draft-a',{text:'kept',attachments:[]});await assert.rejects(store.saveDraft('draft-a',{text:'bad',attachments:[{id:'lost'}]}),/missing/);assert.equal((await store.getDraft('draft-a')).text,'kept');await assert.rejects(store.claim(['lost'],'capture-x'),/missing/);
});
test('storage unavailable and unsupported, oversize or overlong media give actionable failures',async()=>{
 await assert.rejects(createStore({indexedDB:null}).getDraft('x'),/unavailable/);
 assert.throws(()=>validate(new Blob(['<svg/>'],{type:'image/svg+xml'})),/PNG/);
 assert.throws(()=>validate(new Blob([new Uint8Array(10*1024*1024+1)],{type:'image/png'})),/10 MB/);
 assert.throws(()=>validate(new Blob(['voice'],{type:'audio/webm'}),{duration:121}),/2 minutes/);
 assert.throws(()=>validate(new Blob(['voice'],{type:'audio/webm'}),{duration:Infinity}),/playable/);
 assert.equal(validate(new Blob(['voice'],{type:'audio/webm;codecs=opus'}),{duration:120}),'audio');
});
