const test = require('node:test');
const assert = require('node:assert/strict');
require('./feedback-view.js');
const View = globalThis.FeedbackView;
const E = require('./engine.js');
const P = require('./feedback-presentation.js');
function vm(overrides={}) {
  const c = E.createCase('Change the WinQuote homepage button from “Create” to “Start a quote”.');
  const item = {id:'WQ-TEST',c,ux:{}};
  return {page:'ticket',current:item,items:[item],actor:'Requester',scenarios:[],updates:[],status:{owner:'Requester',label:'Ready to submit'},console:{open:false},...overrides};
}
test('plain legacy feedback stays actionable in the unified workspace', () => {
  const state=vm(); state.presentation=P.describe(state.current);
  const html=View.render(state);
  assert.match(html,/data-wq="legacy-submit"/);
  assert.doesNotMatch(html,/needs a different view|Open earlier paths/);
  assert.match(html,/role="tab"[^>]*data-wq="context-tab"/);
});
test('historical detail never borrows current request, basis, media or approval controls', () => {
  const state=vm({historyVersion:1,presentation:{historical:true,viewedRev:1,request:{text:null,attachments:[]},basis:[],versions:[],candidate:'Saved old wording',checks:[]}});
  state.current.c.text='FUTURE PRIVATE FEEDBACK';
  state.current.c.reviewFlow={phase:'accepted',sharedUnderstanding:{text:'FUTURE BASIS'},adjustmentEvidence:{rev:1,attachments:[{id:'later',name:'LATER SCREENSHOT'}]}};
  const html=View.render(state);
  assert.doesNotMatch(html,/FUTURE PRIVATE|FUTURE BASIS|LATER SCREENSHOT|data-wq="authorize"|data-wq="accept"/);
  assert.match(html,/No basis was saved with this version/);
  assert.match(html,/Saved old wording/);
});
test('replay suppresses mutable tasks and exposes return without replacing live record', () => {
  const state=vm({console:{open:true},walkHistory:{active:true,index:0,total:2,canBack:false,label:'Earlier clarification'},presentation:{request:{text:'Earlier source'},basis:[],candidate:'Earlier copy',checks:[],why:{text:'The exact answer explained the next step.'}}});
  state.current.c.reviewFlow={phase:'review'};
  const before=JSON.stringify(state.current);
  const html=View.render(state);
  assert.match(html,/Read-only replay/);
  assert.match(html,/data-wq="walk-current"/);
  assert.doesNotMatch(html,/data-wq="accept"|data-wq="adjust"|\[object Object\]/);
  assert.equal(JSON.stringify(state.current),before);
});
test('inspector media uses supplied local thumbnails and escapes filenames', () => {
  const state=vm({presentation:{request:{text:'Feedback',attachments:[{id:'img',kind:'image',name:'<img onerror=alert(1)>',thumbnailUrl:'blob:https://demo.test/actual'},{id:'unsafe',kind:'image',name:'second',thumbnailUrl:'javascript:alert(1)'},{id:'audio',kind:'audio',name:'Voice note',size:12000,duration:12}]},basis:[],versions:[]}});
  const html=View.render(state);
  assert.match(html,/src="blob:https:\/\/demo.test\/actual"/);
  assert.match(html,/&lt;img onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html,/src="javascript/);
  assert.match(html,/Audio recording · 12 KB · 0:12/);
});
test('versions keep newest first, accurate status, and an unsent draft cannot open a snapshot', () => {
  const state=vm({presentation:{request:{text:'Feedback'},basis:[],versions:[{rev:1,status:'Released in simulation',statuses:['submitted','accepted','authorized','released'],readOnly:true},{rev:2,status:'Draft',current:true,readOnly:false}]}});
  const html=View.render(state);
  assert.ok(html.indexOf('Version 2') < html.indexOf('Version 1'));
  assert.match(html,/data-wq="current-version" data-value="2"/);
  assert.match(html,/Accepted · Authorized · Released/);
});
test('updates group the latest event per ticket with older events disclosed', () => {
  const state=vm({page:'updates',updates:[{id:'old',ticketId:'WQ-TEST',title:'Older update',at:'2026-11-04T12:00:00Z'},{id:'new',ticketId:'WQ-TEST',title:'Newest update',at:'2026-11-05T12:00:00Z'}]});
  const html=View.render(state);
  assert.equal((html.match(/class="fs-update-group"/g)||[]).length,1);
  assert.ok(html.indexOf('Newest update')<html.indexOf('Older update'));
  assert.match(html,/1 earlier update/);
});
test('requester waiting does not restore a private legacy candidate from derivation', () => {
  const state=vm({status:{owner:'Website team',label:'Preparing the result'}});
  state.current.c=E.transition(state.current.c,'submit');
  state.presentation={request:{text:state.current.c.text},basis:[],versions:[],candidate:'',checks:[]};
  const html=View.render(state);
  assert.doesNotMatch(html,/class="fs-result"|Proposed homepage copy/);
});
test('question-round count groups answers by bundle and includes sent unanswered questions', () => {
  const state=vm({presentation:{request:{text:'Feedback'},basis:[],versions:[],questionRounds:[{id:'initial-1',round:'initial',questions:[{id:'q1',text:'First question'},{id:'q2',text:'Second question'}]},{id:'detailed-2',round:'detailed',questions:[{id:'q3',text:'Next decision'}]}],answers:[{bundleId:'initial-1',question:'First question',answer:'First answer'},{bundleId:'initial-1',question:'Second question',answer:'Second answer'}]}});
  const html=View.render(state);
  assert.match(html,/Question rounds<\/span><small class="fs-side-count">2/);
  assert.match(html,/2 of 2 answered/);
  assert.match(html,/0 of 1 answered/);
  assert.match(html,/Next decision/);
});
test('team triage displays the later private preparation without adopting or sharing it', () => {
  const state=vm({actor:'Website team',status:{owner:'Website team',label:'Reviewing the scope'}});
  state.current.c.reviewFlow={phase:'triage',scope:{approach:'Existing scope text',checks:'Existing check'}};
  state.current.ux.preparation={teamDraft:{approach:'RAW UX MUST NOT BE READ'}};
  state.presentation={request:{text:'Feedback'},basis:[],versions:[],preparation:{stage:'team-review-pending',summary:'Context ready',facts:[{label:'Page',text:'Make PDF',source:'Captured context'}],teamDraft:{approach:'PRIVATE PRELIMINARY APPROACH',checks:['PRIVATE MATCHING CHECK'],questions:['PRIVATE DRAFT QUESTION'],source:'Recorded context'}}};
  const before=JSON.stringify(state.current);
  const team=View.render(state);
  assert.match(team,/Private AI draft/);
  assert.match(team,/PRIVATE PRELIMINARY APPROACH/);
  assert.match(team,/PRIVATE MATCHING CHECK/);
  assert.match(team,/PRIVATE DRAFT QUESTION/);
  assert.doesNotMatch(team,/RAW UX MUST NOT BE READ/);
  assert.match(team,/<textarea name="approach"[^>]*>Existing scope text<\/textarea>/);
  const requester=View.render({...state,actor:'Requester'});
  assert.doesNotMatch(requester,/PRIVATE PRELIMINARY APPROACH|PRIVATE MATCHING CHECK|PRIVATE DRAFT QUESTION|Private AI draft/);
  assert.equal(JSON.stringify(state.current),before);
});
test('early team preparation exposes a concrete context brief before a plan exists', () => {
  const state=vm({actor:'Website team',status:{owner:'Website team',label:'Reviewing the scope'}});
  state.current.c.reviewFlow={phase:'triage',scope:{}};
  state.presentation={request:{text:'Feedback'},basis:[],versions:[],preparation:{stage:'draft-ready',summary:'Saved material organized',facts:[{label:'Affected page',text:'Make PDF'}]}};
  const html=View.render(state);
  assert.match(html,/<details class="fs-team-preparation" open>/);
  assert.match(html,/Affected page/);
  assert.doesNotMatch(html,/Private AI draft/);
});
test('plain legacy clarification derives its actual question when the projection omits it', () => {
  const state=vm();
  state.current.c=E.transition(E.createCase(E.hesitationFeedback),'submit');
  const question=E.derive(state.current.c).question;
  assert.ok(question?.text);
  state.presentation={request:{text:state.current.c.text},basis:[],versions:[]};
  const html=View.render(state);
  assert.ok(html.includes(question.text.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')));
  assert.match(html,/data-wq="legacy-answer"/);
});
test('opening an existing unscoped record does not imply the PDF workflow is selected', () => {
  const scenarios=[{id:'pdf',title:'PDF workflow'},{id:'compartment',title:'Compartment workflow'},{id:'refrigeration',title:'Refrigeration workflow'}];
  const state=vm({console:{open:true},scenario:scenarios[0],scenarios,presentation:{legacy:true,title:'Clarify the quote entry',request:{text:'Feedback'},basis:[],versions:[]}});
  const html=View.render(state);
  const select=html.match(/<select data-wq="start-scenario"[\s\S]*?<\/select>/)[0];
  assert.match(select,/<option value="" selected disabled>Current feedback · Clarify the quote entry<\/option>/);
  assert.doesNotMatch(select,/<option value="pdf" selected/);
  assert.equal((select.match(/<option value="(?:pdf|compartment|refrigeration)"/g)||[]).length,3);
  state.current.c.reviewFlow={phase:'triage',scenarioId:'pdf'};
  const scoped=View.render(state).match(/<select data-wq="start-scenario"[\s\S]*?<\/select>/)[0];
  assert.match(scoped,/<option value="pdf" selected/);
  assert.doesNotMatch(scoped,/Current feedback ·/);
});
test('a paused context brief can resume before the private plan stage', () => {
  const state=vm({status:{owner:'Website team',label:'Reviewing the scope'}});
  state.current.c.reviewFlow={phase:'triage'};
  state.presentation={request:{text:'Feedback'},basis:[],versions:[],preparation:{stage:'draft-ready',paused:true,title:'Context brief ready',facts:[]}};
  assert.match(View.render(state),/data-wq="resume-preparation"/);
  state.presentation.preparation.paused=false;
  assert.doesNotMatch(View.render(state),/data-wq="resume-preparation"/);
  state.preparationPaused=true;
  assert.match(View.render(state),/data-wq="resume-preparation"/);
  state.preparationPaused=false;
  state.presentation.preparation.stage='team-review-pending';
  state.presentation.preparation.paused=true;
  assert.doesNotMatch(View.render(state),/data-wq="resume-preparation"/);
});
