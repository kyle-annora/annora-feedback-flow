'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const E=require('./engine.js'),S=require('./feedback-store.js'),P=require('./feedback-presentation.js'),C=require('./scenario-catalog.js');
require('./feedback-view.js');const View=globalThis.FeedbackView;
const clone=value=>JSON.parse(JSON.stringify(value));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const source=fs.readFileSync(require.resolve('./feedback-app.js'),'utf8');
function workspace(scenario='pdf'){
 const entry=C.get(scenario);return S.add(S.migrate(null),entry,{text:entry.feedback,captureId:'fixture-'+scenario,context:{page:entry.target,quote:'QUOTE-ONE'},attachments:[]}).data;
}
function commit(data,actor,action,value){return S.commit(data,data.current,{expectedSequence:S.get(data,data.current).sequence,actor,action,value}).data;}
function submitted(){let data=workspace();data=commit(data,'Website team','draft-plan');data=commit(data,'Website team','confirm-scope',S.get(data,data.current).c.reviewFlow.scope);for(const action of ['finish-spec','prepare-result','deliver'])data=commit(data,'Website team',action);return data;}
function controller(data,{query='',getMedia=async()=>{throw Error('No media fixture');},values={}}={}){
 const local=new Map([[S.key,JSON.stringify(data)]]),nodes=new Map(),renders=[],createdURLs=[],revokedURLs=[];
 function element(tag='div'){
  const node={tagName:tag.toUpperCase(),style:{},dataset:{},isConnected:true,innerHTML:'',textContent:'',open:false,attrs:{},events:{},classList:{add(){},remove(){},toggle(){}},
   appendChild(child){child.parentElement=this;if(child.id)nodes.set(child.id,child);return child;},append(child){return this.appendChild(child);},addEventListener(name,fn){this.events[name]=fn;},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]||null;},removeAttribute(k){delete this.attrs[k];},contains(){return false;},focus(){document.activeElement=this;},matches(){return false;},getClientRects(){return [{}];},remove(){this.isConnected=false;},insertAdjacentHTML(){},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();},querySelectorAll(){return [];},querySelector(selector){return values[selector]??null;}};return node;
 }
 const document={activeElement:null,hidden:false,title:'',events:{},addEventListener(name,fn){this.events[name]=fn;},createElement:element,getElementById:id=>nodes.get(id)||null,querySelector(){return null;},querySelectorAll(){return [];}};
 document.body=element('body');document.activeElement=document.body;nodes.set('live',element());
 const location=new URL('https://demo.test/annora-feedback-flow/'+query);const timers=new Map();let serial=0;
 class URLWithMedia extends URL{}URLWithMedia.createObjectURL=blob=>{const url='blob:test-'+(createdURLs.length+1);createdURLs.push({url,blob});return url;};URLWithMedia.revokeObjectURL=url=>revokedURLs.push(url);
 const context={document,location,URL:URLWithMedia,URLSearchParams,Date,Intl,console,Promise,Map,Set,JSON,Math,Number,String,Boolean,Object,Array,
  FeedbackStore:S,CaseEngine:E,FeedbackPresentation:P,FlowScenarios:C,ResultModel:require('./result-model.js'),FeedbackMediaStore:{get:getMedia},
  FeedbackView:{render(view){renders.push(clone(view));return '<div>Rendered test surface</div>';}},
  localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)},
  history:{replaceState(_state,_title,url){const next=new URL(url,location);location.href=next.href;}},
  matchMedia:()=>({matches:false}),innerWidth:1440,innerHeight:900,addEventListener(){},removeEventListener(){},scrollTo(){},
  setTimeout(fn,delay){timers.set(++serial,{fn,delay});return serial;},clearTimeout:id=>timers.delete(id)};
 context.window=context;context.globalThis=context;vm.createContext(context);
 const ending=source.lastIndexOf('})(globalThis);');assert.ok(ending>0);
 const instrumented=source.slice(0,ending)+`globalThis.__test={handle,routeTicket,render,hydrateMedia,savePresentation,submitPayload,apply,
 state:()=>({data,page,actor,historyVersion,walkCursor,consoleState,contextTab,rendered,mediaCache:[...mediaCache]}),
 set:patch=>{if('historyVersion'in patch)historyVersion=patch.historyVersion;if('walkCursor'in patch)walkCursor=patch.walkCursor;}};`+source.slice(ending);
 vm.runInContext(instrumented,context,{filename:'feedback-app.js'});
 return {api:context.__test,context,renders,last:()=>renders.at(-1),persisted:()=>JSON.parse(local.get(S.key)),externalWrite:value=>local.set(S.key,JSON.stringify(value)),createdURLs,revokedURLs,values,timers};
}

test('legacy customer ticket deep links remain in the unified workspace and execute against the same original record',async()=>{
 let c=E.transition(E.createCase('Change the homepage button label to "Start a quote".'),'submit');c=E.transition(c,'deliver');
 const initial=S.migrate({current:'WQ-201',items:[{id:'WQ-201',clientId:'winquote',captureSubmission:true,submissionOrigin:'customer',c}],serial:201});
 const before=clone(c),app=controller(initial,{query:'?legacy=1&ticket=WQ-201'});
 assert.equal(app.context.FeedbackWorkspace.active,true);assert.equal(app.last().page,'ticket');assert.equal(app.last().presentation.legacy,true);assert.equal(app.api.state().data.current,'WQ-201');assert.deepEqual(app.persisted().items[0].c,before);assert.equal(app.context.location.search,'?ticket=WQ-201');
 await app.api.handle('legacy-accept');assert.equal(app.persisted().items[0].c.stage,'release');assert.equal(app.persisted().items[0].c.reviewFlow,undefined);assert.deepEqual(app.persisted().items[0].c.versions,before.versions);
});

test('role, Watch mode and inspector tab restore on ordinary reload; notification deep links reset only the actionable perspective',async()=>{
 const data=submitted(),id=data.current,app=controller(data,{query:'?ticket='+id});
 await app.api.handle('change-role','Website team');await app.api.handle('change-mode','watch');await app.api.handle('open-console');await app.api.handle('context-tab','activity');
 const reloaded=controller(app.persisted(),{query:'?ticket='+id});assert.equal(reloaded.last().actor,'Website team');assert.equal(reloaded.last().console.mode,'watch');assert.equal(reloaded.last().console.open,true);assert.equal(reloaded.last().contextTab,'activity');assert.equal(reloaded.last().console.playing,false);
 const event=S.get(data,id).ux.events.find(e=>e.action==='deliver');const notification=controller(app.persisted(),{query:'?ticket='+id+'&event='+encodeURIComponent(event.id)});assert.equal(notification.last().actor,'Requester');assert.equal(notification.last().historyVersion,null);assert.equal(notification.last().walkHistory.active,false);assert.equal(S.get(notification.persisted(),id).c.accepted,null);
});

test('walkthrough back/current/restart changes presentation only and rejects business actions while replaying',async()=>{
 const data=workspace(),id=data.current,app=controller(data,{query:'?ticket='+id});await app.api.handle('change-role','Website team');
 await app.api.handle('draft-plan');await app.api.handle('confirm-scope');await app.api.handle('finish-spec');const before=clone(S.get(app.persisted(),id)),caseBefore=JSON.stringify(before.c),sequence=before.sequence;
 await app.api.handle('walk-back');assert.equal(app.last().walkHistory.active,true);assert.equal(app.last().presentation.phase,'spec-review');assert.equal(JSON.stringify(S.get(app.persisted(),id).c),caseBefore);assert.equal(S.get(app.persisted(),id).sequence,sequence);
 await assert.rejects(app.api.handle('prepare-result'),/earlier view/);
 await app.api.handle('walk-current');assert.equal(app.last().walkHistory.active,false);assert.equal(app.last().presentation.phase,'candidate');assert.equal(JSON.stringify(S.get(app.persisted(),id).c),caseBefore);
 await app.api.handle('walk-restart');assert.equal(app.last().page,'site');assert.equal(app.persisted().items.length,1);assert.equal(JSON.stringify(S.get(app.persisted(),id).c),caseBefore);assert.equal(S.get(app.persisted(),id).sequence,sequence);
});

test('historical selection projects the frozen V1 request, answer and material and cannot accept the current V2',async()=>{
 let data=submitted(),id=data.current;data=commit(data,'Requester','adjust',{rev:1,reason:'Make Workflow easier to find.'});
 const item=S.get(data,id);item.c.reviewFlow.context={quote:'LATEST-V2'};item.c.reviewFlow.attachments=[{id:'latest-image',kind:'image'}];item.ux.context={quote:'LATEST-V2'};
 const app=controller(data,{query:'?ticket='+id});await app.api.handle('view-version','1');assert.equal(app.last().presentation.historical,true);assert.equal(app.last().presentation.request.context.quote,'QUOTE-ONE');assert.deepEqual(app.last().presentation.request.attachments,[]);assert.ok(!JSON.stringify(app.last().presentation.request).includes('LATEST-V2'));assert.equal(app.last().presentation.currentRev,2);await assert.rejects(app.api.handle('accept'),/earlier view/);assert.equal(S.get(app.persisted(),id).c.accepted,null);
});

test('stale actionable view cannot accept a version changed by another tab',async()=>{
 const data=submitted(),id=data.current,app=controller(data,{query:'?ticket='+id});let fresh=commit(app.persisted(),'Requester','adjust',{rev:1,reason:'Need a clearer next action.'});app.externalWrite(fresh);
 await assert.rejects(app.api.handle('accept'),/has changed/);const after=S.get(app.persisted(),id);assert.equal(after.c.rev,2);assert.equal(after.c.accepted,null);assert.equal(after.sequence,S.get(fresh,id).sequence);
});

test('presentation-only current/restart controls must merge metadata without rolling back a newer external case',async()=>{
 const data=submitted(),id=data.current,app=controller(data,{query:'?ticket='+id});const fresh=commit(app.persisted(),'Requester','adjust',{rev:1,reason:'A newer request from another tab.'});app.externalWrite(fresh);
 await app.api.handle('walk-current');const after=S.get(app.persisted(),id);assert.equal(after.c.rev,2,'presentation persistence must not replace external V2 with cached V1');assert.equal(after.sequence,S.get(fresh,id).sequence);assert.equal(after.c.adjustment,'A newer request from another tab.');
});

test('an incidental render during an in-flight attachment load still renders its original once resolved',async()=>{
 const data=workspace(),id=data.current;S.get(data,id).c.reviewFlow.attachments=[{id:'image-one',kind:'image',name:'Original'}];let resolveMedia,calls=0;const pending=new Promise(resolve=>{resolveMedia=resolve;});
 const app=controller(data,{query:'?ticket='+id,getMedia:()=>{calls++;return pending;}});assert.equal(calls,1);await app.api.handle('open-console');resolveMedia({blob:new Blob(['original'],{type:'image/png'})});await flush();await flush();
 assert.equal(calls,1,'one media request should serve incidental renders');assert.match(app.last().presentation.request.attachments[0].thumbnailUrl||'',/^blob:/,'resolved image should hydrate the currently visible inspector');assert.equal(app.createdURLs.length,1);
});

test('late rejection from a departed ticket cannot poison a replacement load for the same immutable attachment id',async()=>{
 let data=workspace(),first=data.current;S.get(data,first).c.reviewFlow.attachments=[{id:'shared-image',kind:'image'}];const added=S.add(data,C.get('compartment'),{text:C.get('compartment').feedback,captureId:'other',attachments:[],context:{}});data=added.data;const second=added.item.id;data.current=first;
 let rejectOld,resolveNew,call=0;const old=new Promise((_,reject)=>{rejectOld=reject;}),replacement=new Promise(resolve=>{resolveNew=resolve;});const app=controller(data,{query:'?ticket='+first,getMedia:()=>++call===1?old:replacement});
 app.api.routeTicket(second);app.api.routeTicket(first);resolveNew({blob:new Blob(['right original'],{type:'image/png'})});await flush();await flush();const expected=app.last().presentation.request.attachments[0].thumbnailUrl;assert.match(expected||'',/^blob:/);rejectOld(Error('old request failed'));await flush();await app.api.handle('open-console');
 assert.equal(app.last().presentation.request.attachments[0].thumbnailUrl,expected,'old failure must not erase the new successful original');assert.equal(app.revokedURLs.includes(expected),false);
});

test('legacy walkthrough replay does not substitute newer adjustment evidence into an earlier scene',async()=>{
 let c=E.transition(E.createCase('Change the homepage button label to "Start a quote".'),'submit');c=E.transition(c,'deliver');
 const initial=S.migrate({current:'WQ-201',items:[{id:'WQ-201',clientId:'winquote',captureSubmission:true,submissionOrigin:'customer',c}],serial:201});
 const app=controller(initial,{query:'?ticket=WQ-201'});
 app.api.apply('adjust',{rev:1,reason:'A later image explains the problem.',attachments:[{id:'future-evidence',kind:'image',name:'ONLY IN V2'}],context:{page:'Later adjustment page'}});
 assert.equal(app.last().presentation.adjustmentEvidence.attachments[0].name,'ONLY IN V2');
 await app.api.handle('walk-back');
 assert.equal(app.last().walkHistory.active,true);assert.equal(app.last().presentation.viewedRev,1);
 assert.equal(app.last().presentation.adjustmentEvidence,null,'replaying a V1 scene must not borrow current V2 adjustment metadata');
});

test('a media adjustment records the same prior review scene as a text-only adjustment',async()=>{
 const data=submitted(),id=data.current,app=controller(data,{query:'?ticket='+id});let options;
 app.context.FeedbackComposer={open(value){options=value;return {close(){}};}};
 await app.api.handle('adjustment-media','adjust');
 await options.onSubmit({text:'Make the PDF action clearer.',captureId:'adjustment-one',attachments:[{id:'adjustment-image',kind:'image',name:'Adjustment image'}],context:{page:'Make PDF'}});
 assert.equal(S.get(app.persisted(),id).c.rev,2);
 await app.api.handle('walk-back');
 assert.equal(app.last().walkHistory.active,true,'adding media must preserve a replayable prior review scene');
 assert.equal(app.last().presentation.viewedRev,1);assert.equal(app.last().presentation.phase,'review');
 assert.equal(app.last().presentation.adjustmentEvidence,null);
});

test('2s and 40s preparation organizes materials without prematurely drafting a plan or moving the case',async()=>{
 const app=controller(workspace(),{query:'?workflow=pdf'});
 const item=await app.api.submitPayload({text:C.get('pdf').feedback,captureId:'timed-capture',context:{page:'Make PDF',quote:'Q-TIMED',selection:{label:'Generate PDF result'}},attachments:[{id:'timed-image',kind:'image'},{id:'timed-audio',kind:'audio'}]},true);
 const initial=clone(S.get(app.persisted(),item.id));
 const contextTimer=[...app.timers.values()].find(timer=>timer.delay===2000),draftTimer=[...app.timers.values()].find(timer=>timer.delay===40000);
 assert.ok(contextTimer);assert.ok(draftTimer);contextTimer.fn();
 let state=S.get(app.persisted(),item.id);
 assert.equal(state.ux.preparation.stage,'draft-ready');assert.ok(state.ux.preparation.items.some(fact=>fact.text==='Q-TIMED'));assert.ok(state.ux.preparation.items.some(fact=>fact.text==='Generate PDF result'));
 assert.equal(state.ux.preparation.analyzedMedia,false);assert.equal(app.last().presentation.preparation.teamDraft,undefined);
 draftTimer.fn();state=S.get(app.persisted(),item.id);
 assert.equal(state.ux.preparation.stage,'team-review-pending');assert.deepEqual(state.c,initial.c);assert.equal(state.sequence,initial.sequence);assert.deepEqual(state.ux.events,[]);
 assert.equal(app.last().presentation.preparation.teamDraft,undefined,'requester must not receive the private AI/team draft');
 await app.api.handle('change-role','Website team');
 assert.equal(app.last().presentation.preparation.teamDraft,undefined,'elapsed time must not create a complete proposal for either role');
 assert.deepEqual(S.get(app.persisted(),item.id).c.reviewFlow.scope,{approach:'',checks:''});
 await app.api.handle('draft-plan');
 const prepared=S.get(app.persisted(),item.id);assert.equal(prepared.c.reviewFlow.planPrepared,true);assert.ok(prepared.c.reviewFlow.scope.checks.length>0);assert.equal(prepared.c.reviewFlow.phase,'triage');assert.deepEqual(prepared.ux.events,[]);
});

test('leaving preparation pauses local timers and does not invent a completed background draft on return',async()=>{
 const app=controller(workspace(),{query:'?workflow=pdf'});
 const item=await app.api.submitPayload({text:C.get('pdf').feedback,captureId:'paused-capture',context:{page:'Make PDF'},attachments:[]},true);
 await app.api.handle('keep-working');
 assert.equal([...app.timers.values()].some(timer=>timer.delay===2000||timer.delay===40000),false);
 app.api.routeTicket(item.id);
 assert.equal(S.get(app.persisted(),item.id).ux.preparation.stage,'context-ready');assert.equal(S.get(app.persisted(),item.id).c.reviewFlow.phase,'triage');
 await app.api.handle('resume-preparation');
 assert.equal(S.get(app.persisted(),item.id).ux.preparation.stage,'draft-ready');assert.ok([...app.timers.values()].some(timer=>timer.delay===38000));
 assert.equal(S.get(app.persisted(),item.id).c.reviewFlow.phase,'triage');
});

test('delay, return summary and revised checkpoints stay per-ticket and appear in the actual list/update renderer',async()=>{
 let data=workspace(),first=data.current;
 data=S.add(data,C.get('refrigeration'),{text:C.get('refrigeration').feedback,captureId:'second-ticket',context:{page:'Refrigeration'},attachments:[]}).data;
 const second=data.current;data.current=first;
 const app=controller(data,{query:'?ticket='+first}),original=clone(S.get(app.persisted(),first)),promise=original.ux.timing.nextUpdateAt;
 app.api.routeTicket(second);await app.api.handle('advance-time');await app.api.handle('advance-time');
 assert.equal(S.get(app.persisted(),first).ux.events.filter(event=>event.action==='delay').length,1,'the same missed checkpoint emits one delay update');
 assert.equal(S.get(app.persisted(),first).ux.timing.nextUpdateAt,promise,'simulation advance must preserve the missed promise');
 app.api.routeTicket(first);
 assert.match(S.get(app.persisted(),first).ux.sinceLastVisit,/an update was delayed/);assert.deepEqual(S.get(app.persisted(),first).c,original.c);
 assert.match(View.render(app.last()),/Since your last visit/);
 await app.api.handle('change-role','Website team');await app.api.handle('set-next-update');
 assert.equal(S.get(app.persisted(),first).ux.timing.expectationHistory.at(-1).at,promise);
 assert.equal(S.get(app.persisted(),second).ux.timing.nextUpdateAt,S.get(data,second).ux.timing.nextUpdateAt,'changing one checkpoint must not reschedule another ticket');
 await app.api.handle('nav-inbox');let html=View.render(app.last());assert.match(html,/Updated /);assert.match(html,/Next update/);assert.match(html,/Update overdue/);
 await app.api.handle('nav-updates');html=View.render(app.last());assert.equal((html.match(/class="fs-update-group"/g)||[]).length,2);assert.match(html,/earlier update/);assert.match(html,/The team set the next update/);
 const firstGroup=app.last().updateGroups.find(group=>group.ticketId===first);await app.api.handle('open-update',firstGroup.latestEventId);
 assert.equal(app.last().current.id,first);assert.equal(app.last().actor,'Requester');assert.deepEqual(S.get(app.persisted(),first).c,original.c);
});

test('each sample uses the same Watch handoffs and known records do not fabricate a customer question',async()=>{
 for(const scenario of ['pdf','compartment','refrigeration']){
  const app=controller(S.migrate(null),{query:'?workflow='+scenario});
  await app.api.handle('watch-next');assert.equal(app.last().page,'site');
  await app.api.handle('watch-next');const id=app.persisted().current;
  let item=S.get(app.persisted(),id);assert.equal(item.c.reviewFlow.phase,'triage');assert.equal(item.c.reviewFlow.planPrepared,false);assert.deepEqual(item.c.reviewFlow.scope,{approach:'',checks:''});
  if(scenario==='refrigeration'){assert.equal(item.ux.context.state.savedNoRefrigeration,true);assert.equal(item.ux.context.state.cost,2400);}
  await app.api.handle('watch-next');item=S.get(app.persisted(),id);assert.equal(item.c.reviewFlow.planPrepared,true);assert.equal(item.c.reviewFlow.phase,'triage');assert.deepEqual(item.ux.events,[]);
  for(let i=0;i<8&&S.get(app.persisted(),id).c.stage!=='published';i++)await app.api.handle('watch-next');
  item=S.get(app.persisted(),id);assert.equal(item.c.stage,'published');assert.equal(item.c.reviewFlow.questionRounds.length,0);
  assert.equal(item.id,id);assert.equal(item.c.accepted.rev,item.c.authorization.rev);assert.equal(item.c.receipt.rev,item.c.accepted.rev);
 }
});


test('clearing a prepared plan field is validated instead of silently restoring a previous suggestion',async()=>{
 const app=controller(workspace(),{values:{'[name="approach"]':{value:''},'[name="checks"]':{value:'An explicit team check'}}});
 await app.api.handle('change-role','Website team');await app.api.handle('draft-plan');
 await assert.rejects(()=>app.api.handle('confirm-scope'),/approach must contain text/);
 const item=S.get(app.persisted(),app.persisted().current);assert.equal(item.c.reviewFlow.phase,'triage');assert.deepEqual(item.ux.events,[]);
});
