"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const E = require("./engine.js");
const P = require("./personas.js");
const Story = require("./review-story.js");
const SM = require("./showcase-model.js");
const Capture = require("./capture-state.js");
const W = require("./workspace-state.js");
const Store = require("./feedback-store.js");
const clone = value => JSON.parse(JSON.stringify(value));
const caseKey = "feedbackflow:casework:v2.1", walkKey = "feedbackflow:walk:v2.1";
const record = (id,c=E.createReviewedCase(E.pdfFeedback),extra={}) => ({id,c,clientId:"winquote",demoOnly:false,submissionOrigin:"customer",captureSubmission:true,reviewUI:{role:"Requester",drafts:{},history:[]},...extra});
const walk = (item,extra={}) => ({record:item.id,type:"reviewed",reviewed:true,frames:[{case:clone(item.c),title:"An earlier step"}],index:0,inputMode:"practice",playing:false,reviewUI:{role:"Requester",drafts:{},history:[]},...extra});
function storage(initial={}) {
  const values = new Map(Object.entries(initial).map(([key,value])=>[key,typeof value==="string"?value:JSON.stringify(value)]));
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
}
// Execute the actual controller with inert rendering surfaces. These tests cover
// state and navigation boundaries, while browser QA covers layout and focus.
function controller({workspace,session={},local={},url='https://demo.test/annora-feedback-flow/?legacy=1'}) {
  const navigations=[];
  const location={href:url,assign(value){navigations.push(value);this.href=value;}};
  const element = () => ({hidden:false,innerHTML:"",textContent:"",style:{setProperty(){}},classList:{toggle(){},add(){},remove(){}},focus(){},prepend(){},setAttribute(){},querySelector(){return null;}});
  const elements = Object.fromEntries(["main","nav","shade","topbar","dialog","dialog-body","live","walkthrough-dock"].map(id=>[id,element()]));
  elements["walkthrough-dock"].parentElement=element();
  const document = {body:element(),activeElement:{tagName:"BODY"},addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},getElementById:id=>elements[id]??null,createElement:element};
  const context = {CaseEngine:E,CasePersonas:P,ReviewStory:Story,ShowcaseModel:SM,FlowCaptureState:Capture,WorkspaceState:W,FeedbackStore:Store,URL,location,
    Glyph:()=>"",document,localStorage:storage({[caseKey]:workspace,...local}),sessionStorage:storage(session),
    setTimeout:()=>1,clearTimeout(){},innerWidth:1200,addEventListener(){},scrollTo(){}};
  context.window=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve("./upgrade.js"),"utf8"),context);
  vm.runInContext(fs.readFileSync(require.resolve("./review-ui.js"),"utf8"),context);
  const source=fs.readFileSync(require.resolve("./studio.js"),"utf8");
  const bootstrap=source.indexOf("const launchURL=new URL(location.href);");
  assert.ok(bootstrap>0,"The controller test must stop before URL presentation bootstrap");
  vm.runInContext(source.slice(0,bootstrap)+`
    renderNav=()=>{};renderBar=()=>{};caseMain=()=>{};inbox=()=>{};updatesPage=()=>{};
    renderCapture=()=>{};renderShowcase=()=>{};renderDock=()=>{};reviewCapture=()=>{};focusTask=()=>{};
    globalThis.controllerTest={
      state:()=>({data,tour,parkedTour,page,showcase,captureState}),
      set:next=>{if('data' in next)data=next.data;if('tour' in next)tour=next.tour;if('parkedTour' in next)parkedTour=next.parkedTour;if('showcase' in next)showcase=next.showcase;if('page' in next)page=next.page;},
      render,openWalkthrough,openCapturedRecord,openShowcase,saveShowcase,captureAction,doAction,customerItems,customerUpdates
    };
  })();`,context,{filename:"studio.js"});
  return {...context.controllerTest,navigations,persisted:()=>JSON.parse(context.localStorage.getItem(caseKey))};
}
function workspace(items,current=items[0].id) { return {current,serial:200,items}; }

test("a workspace containing only another client gets an actual local fallback and never restores that client’s cached walkthrough", () => {
  const other = record("OTHER-201",undefined,{clientId:"other-client"});
  const before = clone(other);
  const app=controller({workspace:workspace([other]),session:{[walkKey]:walk(other)}});
  const state=app.state();
  assert.equal(state.tour,null);
  assert.equal(state.parkedTour,null);
  assert.notEqual(state.data.current,other.id);
  const fallback=state.data.items.find(item=>item.id===state.data.current);
  assert.equal(fallback.clientId,"winquote");
  assert.equal(fallback.demoOnly,true);
  assert.deepEqual(clone(state.data.items.find(item=>item.id===other.id)),before);
  assert.equal(app.customerItems().length,0);
  assert.doesNotThrow(()=>app.render(),"The fallback must exist before here() dereferences the selected record");
});

test("an old same-client walkthrough for another ticket stays parked and cannot replace the selected ticket on render or continue", () => {
  const old=record("WQ-201"),current=record("WQ-202",E.createReviewedCase("The quote entry label is unclear."));
  const before=clone(current.c);
  const app=controller({workspace:workspace([old,current],current.id),session:{[walkKey]:walk(old)}});
  assert.equal(app.state().tour,null);
  assert.equal(app.state().parkedTour.record,old.id);
  app.render();app.openWalkthrough();
  assert.equal(app.state().data.current,current.id);
  assert.equal(app.state().tour,null,"Continue current must not open the other ticket’s parked frames");
  assert.equal(app.state().page,"case");
  assert.deepEqual(clone(app.state().data.items.find(item=>item.id===current.id).c),before);
});

test("customer lists and notifications use the same client and provenance scope, retaining curated feedback but excluding examples", () => {
  let c=Capture.createCase(E,{text:E.pdfFeedback,when:"just-now"});
  c=E.review(E.review(c,"draft-questions"),"send-questions");
  const own=record("WQ-203",c),curated=record("WQ-204",clone(c),{curatedDemo:true});
  const example=record("WQ-205",clone(c),{submissionOrigin:"example",demoOnly:true});
  const other=record("OTHER-206",clone(c),{clientId:"other-client"});
  const app=controller({workspace:workspace([own,curated,example,other])});
  assert.deepEqual(Array.from(app.customerItems(),item=>item.id),[own.id,curated.id]);
  assert.deepEqual(Array.from(app.customerUpdates(),update=>update.id),[own.id,curated.id]);
  app.captureAction("open-update",other.id+":Q1");
  assert.equal(app.state().data.current,own.id,"A stale notification key from another client is ignored");
});

test("opening a notification parks the old example and returns to the exact customer ticket and current sent bundle", () => {
  const sample=record("WQ-207",undefined,{submissionOrigin:"example",demoOnly:true});
  let c=Capture.createCase(E,{text:E.pdfFeedback,when:"yesterday"});
  c=E.review(E.review(c,"draft-questions"),"send-questions");
  const own=record("WQ-208",c),before=clone(c);
  const app=controller({workspace:workspace([sample,own]),session:{[walkKey]:walk(sample)}});
  assert.equal(app.state().tour.record,sample.id);
  app.captureAction("open-update",own.id+":Q1");
  assert.equal(app.state().data.current,own.id);
  assert.equal(app.state().tour,null);
  assert.equal(app.state().parkedTour.record,sample.id);
  assert.equal(app.state().data.items.find(item=>item.id===own.id).reviewUI.role,"Requester");
  assert.equal(app.state().captureState.seen[own.id+":Q1"],true);
  app.render();app.openWalkthrough();
  assert.equal(app.state().data.current,own.id);
  assert.equal(app.state().tour,null);
  assert.deepEqual(clone(app.state().data.items.find(item=>item.id===own.id).c),before);
});

test("continuing a same-ticket parked walkthrough rebases to a newer saved version instead of restoring stale frames", () => {
  const item=record("WQ-209"),stale=walk(item,{minimized:true});
  let actual=E.review(item.c,"confirm-scope",item.c.reviewFlow.scope);
  actual=E.review(E.review(actual,"prepare-result"),"deliver");
  item.c=actual;
  const before=clone(actual);
  const app=controller({workspace:workspace([item]),session:{[walkKey]:stale}});
  app.openWalkthrough();app.render();
  const state=app.state();
  assert.equal(state.tour.record,item.id);
  assert.equal(state.tour.frames.length,1);
  assert.equal(state.tour.frames[0].case.stage,"review");
  assert.deepEqual(clone(state.tour.frames[0].case),before);
  assert.deepEqual(clone(state.data.items[0].c),before);
});

test("restoring an active same-ticket walkthrough never rolls a newer workspace version back to its cached frame", () => {
  const item=record("WQ-214"),stale=walk(item);
  let actual=E.review(item.c,"confirm-scope",item.c.reviewFlow.scope);
  actual=E.review(E.review(actual,"prepare-result"),"deliver");
  item.c=actual;
  const before=clone(actual);
  const app=controller({workspace:workspace([item]),session:{[walkKey]:stale}});
  app.render();
  assert.deepEqual(clone(app.state().data.items[0].c),before,
    "An active session cache is navigation context, not authority to replace the saved V1 snapshot");
  app.openWalkthrough();
  assert.deepEqual(clone(app.state().data.items[0].c),before);
  if(app.state().tour)assert.equal(app.state().tour.frames[app.state().tour.index].case.stage,"review");
});

test("a cached showcase cannot resurrect a missing ticket or overwrite an ordinary ticket sharing the cached id", () => {
  const current=record("WQ-210"),cached={...SM.fresh(),id:"WQ-211",c:clone(current.c),scene:"submitted"};
  const app=controller({workspace:workspace([current])});
  app.set({showcase:cached});app.saveShowcase();
  assert.deepEqual(Array.from(app.state().data.items,item=>item.id),[current.id]);
  const before=clone(current.c);
  app.set({showcase:{...cached,id:current.id,c:E.createReviewedCase("Do not replace the current customer feedback.")}});
  app.saveShowcase(true);
  assert.deepEqual(clone(app.state().data.items[0].c),before);
  app.openWalkthrough();
  assert.equal(app.state().data.current,current.id);
  assert.equal(app.state().page,"case");
  assert.deepEqual(clone(app.state().data.items[0].c),before);
});

test("curated resume uses the current ticket’s newer answer and scope rather than the cached prior question state", () => {
  let s=SM.step(SM.fresh(),"start");s=SM.step(s,"submit",{id:"WQ-212"});
  s=SM.step(SM.step(s,"next-team"),"send-question");
  const cached=clone(s);
  s=SM.step(SM.step(s,"open-question"),"answer",{answer:SM.options[1]});
  const item=record(s.id,s.c,{curatedDemo:true}),before=clone(item.c);
  const app=controller({workspace:workspace([item]),local:{"feedbackflow:curated-pdf:v1":cached}});
  app.openWalkthrough();
  assert.equal(app.state().page,"showcase");
  assert.equal(app.state().showcase.scene,"plan");
  assert.equal(app.state().showcase.answer,SM.options[1]);
  assert.match(app.state().showcase.draftScope.checks,/does not redirect/);
  assert.deepEqual(clone(app.state().data.items[0].c),before);
});

test("the original example launchers still create separate samples, while continuing own work keeps its original ticket", () => {
  const own=record("WQ-213"),before=clone(own.c);
  const app=controller({workspace:workspace([own])});
  app.doAction("create-tour");
  const sample=app.state().data.items.find(item=>item.id===app.state().tour.record);
  assert.notEqual(sample.id,own.id);
  assert.equal(sample.demoOnly,true);
  assert.equal(sample.submissionOrigin,"example");
  assert.deepEqual(Array.from(app.customerItems(),item=>item.id),[own.id]);
  assert.deepEqual(clone(app.state().data.items.find(item=>item.id===own.id).c),before);
  app.openCapturedRecord(own.id,'Requester',{legacy:true});
  app.doAction("walk");
  assert.equal(app.state().tour.record,own.id);
  assert.equal(app.state().tour.frames.length,1);
  assert.equal(app.navigations.length,0,'An explicitly selected old demonstration remains callable');
  assert.deepEqual(clone(app.state().data.items.find(item=>item.id===own.id).c),before);
});

test('old customer capture receipt opens the exact ticket in the unified workspace without changing its case', () => {
  const own=record('WQ-220',Capture.createCase(E,{text:'Keep Make PDF available after opening the PDF.',when:'yesterday',includePreview:true}));
  own.c.reviewFlow.attachments=[{id:'immutable-image',kind:'image',name:'Original evidence'}];
  own.ux={walk:{role:'Website team',mode:'watch',historyRev:1,cursor:0,scenes:[{label:'Saved example history'}]}};
  const before=clone(own.c);
  const app=controller({workspace:workspace([own]),url:'https://demo.test/annora-feedback-flow/?capture=pdf&legacy=1&walkthrough=create#old',local:{'feedbackflow:capture:v1':{onSite:true,receipt:{id:own.id,raw:own.c.text}}}});
  app.captureAction('view-feedback');
  assert.equal(app.navigations.length,1);
  const target=new URL(app.navigations[0]);
  assert.equal(target.origin,'https://demo.test');
  assert.equal(target.pathname,'/annora-feedback-flow/');
  assert.equal(target.search,'?ticket=WQ-220');assert.equal(target.hash,'');
  const persisted=app.persisted(),saved=persisted.items.find(item=>item.id===own.id);
  assert.equal(persisted.current,own.id);assert.deepEqual(saved.c,before);
  assert.equal(saved.ux.walk.role,'Requester');assert.equal(saved.ux.walk.cursor,null);assert.equal(saved.ux.walk.historyRev,null);
  assert.deepEqual(saved.ux.walk.scenes,own.ux.walk.scenes,'Presentation handoff retains saved history');
  assert.equal(app.state().captureState.onSite,false);
});

test('old capture My feedback opens the clean unified inbox while retaining the current ticket and saved records', () => {
  const own=record('WQ-226'),other=record('WQ-227');
  const data=workspace([own,other],other.id);
  data.feedbackExperience={schema:1,read:['already-read'],ui:{page:'ticket',scenarioId:'pdf'}};
  const app=controller({workspace:data,url:'https://demo.test/annora-feedback-flow/?capture=pdf&legacy=1&ticket=WQ-226#old',local:{'feedbackflow:capture:v1':{onSite:true,open:true,updatesOpen:true,text:'Unsubmitted feedback'}}});
  const before=clone(app.state().data.items);
  app.captureAction('workspace');
  assert.deepEqual(app.navigations,['https://demo.test/annora-feedback-flow/']);
  const saved=app.persisted();
  assert.equal(saved.current,other.id);
  assert.deepEqual(saved.items,before,'Opening My feedback changes only presentation, not any saved ticket');
  assert.equal(saved.feedbackExperience.ui.page,'inbox','A previously saved ticket view must not override the inbox destination');
  assert.equal(saved.feedbackExperience.ui.scenarioId,'pdf');
  assert.deepEqual(saved.feedbackExperience.read,['already-read']);
  assert.equal(app.state().captureState.onSite,false);
  assert.equal(app.state().captureState.open,false);
  assert.equal(app.state().captureState.updatesOpen,false);
  assert.equal(app.state().captureState.text,'Unsubmitted feedback');
});

test('old customer question update binds the migrated requester event and the current sent bundle', () => {
  let c=Capture.createCase(E,{text:E.pdfFeedback,when:'just-now'});
  c=E.review(E.review(c,'draft-questions'),'send-questions');
  const own=record('WQ-221',c),before=clone(c),app=controller({workspace:workspace([own]),url:'https://demo.test/annora-feedback-flow/?capture=pdf'});
  const update=app.customerUpdates()[0];
  app.captureAction('open-update',update.key);
  const target=new URL(app.navigations[0]);
  assert.equal(target.searchParams.get('ticket'),own.id);
  assert.ok(target.searchParams.get('event'),'Use a real migrated event, not the former capture-only key');
  const saved=app.persisted(),resolved=Store.resolve(saved,own.id,target.searchParams.get('event'));
  assert.equal(resolved.event.recipient,'Requester');assert.equal(resolved.event.bundleId,c.reviewFlow.sentBundle.id);
  assert.equal(resolved.stale,false);assert.deepEqual(resolved.item.c,before);
  assert.equal(app.state().captureState.seen[update.key],true);
});

test('a customer accepted-version notification does not hand the requester the site-owner approval perspective', () => {
  let c=E.createReviewedCase(E.pdfFeedback);
  c=E.review(c,'confirm-scope',c.reviewFlow.scope);
  c=E.review(E.review(c,'prepare-result'),'deliver');c=E.review(c,'accept',{rev:c.rev});
  const own=record('WQ-222',c),before=clone(c),app=controller({workspace:workspace([own])});
  const update=app.customerUpdates()[0];
  app.captureAction('open-update',update.key);
  const target=new URL(app.navigations[0]);
  assert.equal(target.searchParams.get('ticket'),own.id);
  assert.equal(target.searchParams.has('event'),false,'The acceptance event belongs to the site owner; keep this customer return read-only');
  const saved=app.persisted().items.find(item=>item.id===own.id);
  assert.equal(saved.ux.walk.role,'Requester');assert.deepEqual(saved.c,before);
});

test('old demo and explicit legacy fallbacks stay on their original controller and cannot navigate another client', () => {
  const own=record('WQ-223'),demo=record('WQ-224',undefined,{demoOnly:true,submissionOrigin:'example'}),foreign=record('OTHER-225',undefined,{clientId:'other-client'});
  const app=controller({workspace:workspace([own,demo,foreign])}),before=clone(app.state().data.items.map(item=>item.c));
  app.openCapturedRecord(own.id,'Website team',{legacy:true});
  assert.equal(app.state().page,'case');assert.equal(app.state().data.items[0].reviewUI.role,'Website team');
  app.openCapturedRecord(demo.id);assert.equal(app.state().data.current,demo.id);
  app.openCapturedRecord(foreign.id);assert.equal(app.state().data.current,demo.id);
  assert.equal(app.navigations.length,0);
  assert.deepEqual(clone(app.state().data.items.map(item=>item.c)),before);
});
