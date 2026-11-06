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

function evidenceState(overrides={}) {
  const state=vm({actor:'Website team',status:{owner:'Website team',label:'Review the evidence'},...overrides});
  state.current.c.reviewFlow={phase:'triage',evidenceFirst:true,planPrepared:false,scope:{approach:'UNPREPARED SOLUTION',checks:'UNPREPARED CHECK',understanding:'UNPREPARED MESSAGE'}};
  state.presentation={request:{text:'The quote page sent me somewhere unexpected.',context:{page:'Make PDF'}},basis:[{text:'UNPREPARED SOLUTION'}],versions:[{rev:1,status:'Draft',readOnly:false}],preparation:{stage:'team-review-pending',teamDraft:{approach:'PRIVATE AUTO PLAN'}},reasoning:{problem:{text:'The quote page sent me somewhere unexpected.'},facts:[{text:'The customer was on Make PDF.',source:{label:'Captured page',id:'capture-1'}}],decisions:[{text:'Keep the quote workflow available.',source:{label:'Recorded discussion',id:'discussion-1'},status:'recorded'}],outstanding:[],implications:[]}};
  return state;
}
test('evidence-first team review exposes records and a draft decision without a premature plan', () => {
  const state=evidenceState(),before=JSON.stringify(state.current);
  const html=View.render(state);
  assert.match(html,/Start with the evidence/);
  assert.match(html,/The customer was on Make PDF\./);
  assert.match(html,/Captured page/);
  assert.match(html,/capture-1/);
  assert.match(html,/Recorded decisions/);
  assert.match(html,/data-wq="draft-plan"/);
  assert.match(html,/Draft plan from these records/);
  assert.match(html,/Ask the requester/);
  assert.doesNotMatch(html,/UNPREPARED SOLUTION|UNPREPARED CHECK|UNPREPARED MESSAGE|PRIVATE AUTO PLAN|name="approach"|name="checks"|data-wq="confirm-scope"/);
  assert.equal(JSON.stringify(state.current),before);
});
test('an explicit prepared plan exposes editable behavior and checks with folded provenance and shared message', () => {
  const state=evidenceState();state.current.c.reviewFlow.planPrepared=true;
  const html=View.render(state);
  assert.match(html,/<textarea name="approach"[^>]*>UNPREPARED SOLUTION<\/textarea>/);
  assert.match(html,/<textarea name="checks"[^>]*>UNPREPARED CHECK<\/textarea>/);
  assert.match(html,/<details class="fs-share-message"><summary>Message to the requester/);
  assert.match(html,/<details class="fs-plan-sources">/);
  assert.match(html,/data-wq="confirm-scope"/);
  assert.doesNotMatch(html,/data-wq="draft-plan"|PRIVATE AUTO PLAN/);
});
test('answer review makes the actual answer and its behavior/check implications visible before drafting', () => {
  const state=evidenceState();state.current.c.reviewFlow.phase='answer-review';state.current.c.answer='Keep me on Make PDF.';
  state.presentation.reasoning.implications=[{answer:'Keep me on Make PDF.',behavior:['Stay on the current page after generation.'],checks:['After generating, Make PDF remains visible.'],source:{label:'Requester answer',id:'answer-1'}}];
  const html=View.render(state);
  assert.match(html,/Keep me on Make PDF\./);
  assert.match(html,/What this answer changes/);
  assert.match(html,/Stay on the current page after generation\./);
  assert.match(html,/After generating, Make PDF remains visible\./);
  assert.ok(html.indexOf('Keep me on Make PDF.')<html.indexOf('What this answer changes'));
  assert.match(html,/Draft an updated plan/);
  assert.doesNotMatch(html,/name="approach"|name="checks"|UNPREPARED SOLUTION|data-wq="draft-questions"/);
  state.current.c.reviewFlow.planPrepared=true;
  const prepared=View.render(state);
  assert.match(prepared,/data-wq="confirm-scope"/);
  assert.doesNotMatch(prepared,/data-wq="draft-questions"/);
});
test('requester cannot see the private evidence decision or unprepared solution', () => {
  const state=evidenceState({actor:'Requester'});
  state.presentation.reasoning.facts[0].text='PRIVATE TEAM EVIDENCE';
  const html=View.render(state);
  assert.doesNotMatch(html,/PRIVATE TEAM EVIDENCE|UNPREPARED SOLUTION|PRIVATE AUTO PLAN|data-wq="draft-plan"/);
  assert.match(html,/The website team has your request/);
});
test('unsupported answers and uncertain historical applicability remain explicit team judgments', () => {
  const state=evidenceState();state.current.c.reviewFlow.phase='answer-review';state.current.c.answer='Other: handle this differently.';
  state.presentation.reasoning.implications=[{answer:state.current.c.answer,behavior:[],checks:[],supported:false,note:'No supported behavior is inferred from this answer.',source:{label:'Requester answer'}}];
  state.presentation.reasoning.teamConsiderations=['These records are reference material; applicability is not confirmed.'];
  const html=View.render(state);
  assert.match(html,/The answer needs a team decision/);
  assert.match(html,/No supported behavior is inferred from this answer/);
  assert.match(html,/applicability is not confirmed/);
  assert.doesNotMatch(html,/What this answer changes|name="approach"/);
});
test('inbox offers one feedback workspace and keeps sample ticket selection in the walkthrough', () => {
  const scenarios=[{id:'pdf',title:'PDF navigation feedback'},{id:'compartment',title:'Panel title feedback'},{id:'refrigeration',title:'Equipment removal feedback'}];
  const html=View.render(vm({page:'inbox',scenarios,console:{open:true}}));
  assert.match(html,/One conversation from your first report to an accepted result/);
  assert.match(html,/Try the same flow with a sample ticket/);
  assert.match(html,/<span>Sample ticket<\/span><select data-wq="start-scenario" aria-label="Sample ticket"/);
  assert.doesNotMatch(html,/class="fs-scenario"|Three real WinQuote cases|Explore a feedback journey/);
});
test('evidence source text is escaped and original compartment page does not pretend the proposed title exists', () => {
  const state=evidenceState();state.presentation.reasoning.facts[0]={text:'<script>unsafe()</script>',source:{label:'<b>Source</b>',id:'"bad'}};
  const html=View.render(state);
  assert.match(html,/&lt;script&gt;unsafe\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script>|<b>Source<\/b>/);
  const site=View.render(vm({page:'site',scenario:{id:'compartment'},site:{compartment:'2'}}));
  assert.match(site,/name="site-title" value="Freezer"/);
  assert.doesNotMatch(site,/name="site-title" value="Section 2"/);
});

test('submitted result links the saved answer to its exact version without proposed-plan language', () => {
  const state=vm({preview:{interactive:true}});
  state.current.c.rev=1;state.current.c.reviewFlow={phase:'review'};
  state.current.c.versions=[{rev:1,candidate:'Saved behavior',result:{checks:['Saved check']}}];
  state.presentation={request:{text:'Original feedback'},basis:[],versions:[],reasoning:{state:'submitted',sourceVersion:1,implications:[{answer:'Restore my earlier selection.',behavior:['Restore the earlier equipment.'],checks:['Saving restores its charge.'],source:{type:'requester-answer',label:'Q2 · Detailed answer',id:'Q2'}}]}};
  let html=View.render(state);
  assert.match(html,/<details class="fs-version-basis"><summary><span>Why this version<\/span><small>Version 1 basis/);
  assert.match(html,/Restore my earlier selection\./);
  assert.match(html,/Restore the earlier equipment\./);
  assert.match(html,/Saving restores its charge\./);
  assert.match(html,/Saved with version 1\. Later answers do not change this record\./);
  assert.doesNotMatch(html,/Proposed implications|confirm them before sharing/);
  state.presentation.reasoning.sourceVersion=2;
  assert.doesNotMatch(View.render(state),/Why this version|Restore my earlier selection/);
  state.presentation.reasoning.sourceVersion=1;state.presentation.reasoning.implications=[];
  assert.doesNotMatch(View.render(state),/Why this version|Requester answer/);
});
test('historical version shows its frozen answer relation without current answer or mutable actions', () => {
  const state=vm({historyVersion:1});state.current.c.rev=2;state.current.c.answer='LATER ANSWER MUST STAY OUT';
  state.current.c.reviewFlow={phase:'review'};
  state.presentation={historical:true,viewedRev:1,request:{text:'Original feedback'},basis:[],versions:[],candidate:'Earlier candidate',checks:[],reasoning:{state:'submitted',sourceVersion:1,implications:[{answer:'Keep my original equipment.',behavior:['Retain the recorded selection.'],checks:['The original choice remains selected.'],source:{label:'Saved V1 answer'}}]}};
  const html=View.render(state);
  assert.match(html,/Why this version/);
  assert.match(html,/Version 1 basis/);
  assert.match(html,/Keep my original equipment\./);
  assert.match(html,/The original choice remains selected\./);
  assert.doesNotMatch(html,/LATER ANSWER MUST STAY OUT|data-wq="accept"|data-wq="authorize"|Proposed implications/);
});
