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
  assert.match(html,/Accepted · Release approved/);
  assert.equal((html.match(/Released in simulation/g)||[]).length,1);
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
  assert.match(html,/3 questions · 2 rounds/);assert.equal((html.match(/class="fs-question-row"/g)||[]).length,3);
  assert.match(html,/2 answered/);
  assert.match(html,/1 awaiting answer/);
  assert.match(html,/Next decision/);
});
test('sidebar grouping preserves distinct source identities and all saved plan lines without repeated source disclosures', () => {
  const state=vm({actor:'Website team',presentation:{request:{text:'Feedback'},understanding:{text:'Shared'},versions:[],basis:[
    {text:'First saved behavior.',status:'team-confirmed',source:{id:'U1',label:'Shared understanding'}},
    {text:'Second saved behavior.',status:'team-confirmed',source:{id:'U1',label:'Shared understanding'}},
    {text:'Different saved source.',status:'team-confirmed',source:{id:'U2',label:'Shared understanding',text:'Distinct source context.'}}
  ]}});
  state.current.c.reviewFlow={evidenceFirst:true,phase:'awaiting-answer',planPrepared:true,sharedUnderstanding:{text:'Shared'}};
  const before=JSON.stringify(state),sidebar=View.render(state).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];
  assert.match(sidebar,/Shared plan so far/);
  assert.doesNotMatch(sidebar,/Current basis|fs-source-detail/);
  assert.equal((sidebar.match(/class="fs-basis-group"/g)||[]).length,2);
  assert.equal((sidebar.match(/Shared understanding/g)||[]).length,2);
  for(const text of ['First saved behavior.','Second saved behavior.','Different saved source.','Distinct source context.','Reference U1','Reference U2'])assert.ok(sidebar.includes(text),text);
  assert.equal(JSON.stringify(state),before);
});
test('historical sidebar retains round identities, Other notes and provenance without borrowing live answers', () => {
  const state=vm({historyVersion:1,presentation:{historical:true,viewedRev:1,request:{text:'Saved feedback',source:{note:'Reconstructed from an earlier record; not a new customer report.'}},basis:[],versions:[{rev:2,status:'Draft',readOnly:false,current:true},{rev:1,status:'Submitted',readOnly:true}],questionRounds:[
    {id:'Q1',questions:[{id:'a',text:'Same question?'}]},
    {id:'Q2',scopeCycle:2,questions:[{id:'b',text:'Same question?'}],at:'2026-11-05T13:00:00Z'}
  ],answers:[{bundleId:'Q1',question:'Same question?',answer:['Other'],note:'Saved custom answer.',at:'2026-11-04T13:00:00Z'}]}});
  state.current.c.answer='LATER ANSWER';state.current.c.reviewFlow={source:{note:'LATER SOURCE'},sharedUnderstanding:{text:'LATER PLAN'}};
  const before=JSON.stringify(state),sidebar=View.render(state).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];
  for(const text of ['2 questions · 2 rounds','Awaiting answer','Reconstructed from an earlier record','Statuses below reflect current progress','Viewing'])assert.ok(sidebar.includes(text),text);
  const record=View.render({...state,inspector:{view:{kind:'question',id:'Q1:a'},backLabel:'clarifications'}}).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];
  for(const text of ['Saved custom answer.','Q1 / a','Nov 4','Back to clarifications'])assert.ok(record.includes(text),text);
  assert.doesNotMatch(record,/LATER ANSWER|LATER SOURCE|LATER PLAN|Same question.*Same question/);
  const pending=View.render({...state,inspector:{view:{kind:'question',id:'Q2:b'}}});assert.match(pending,/Scope revision/);assert.match(pending,/Nov 5/);
  assert.equal((sidebar.match(/Same question\?/g)||[]).length,2);
  assert.doesNotMatch(sidebar,/LATER ANSWER|LATER SOURCE|LATER PLAN/);
  assert.match(sidebar,/data-wq="current-version" data-value="2"/);
  assert.equal(JSON.stringify(state),before);
});
test('sidebar leads with the submitted governing answer and keeps earlier rounds available without nested folds',()=>{
  const state=vm({historyVersion:2,presentation:{historical:true,viewedRev:2,request:{text:'Saved report'},basis:[{text:'Full frozen plan.',status:'submitted-snapshot',source:{label:'Submitted V2'}}],versions:[],candidate:'Full frozen plan.',checks:[],questionRounds:[
    {id:'Q1',scopeCycle:1,questions:[{id:'policy',text:'Return policy?'}],answers:{policy:'Select again'}},
    {id:'Q2',scopeCycle:2,questions:[{id:'policy',text:'Return policy?'}],answers:{policy:'Restore previous selection'}}
  ],reasoning:{state:'submitted',sourceVersion:2,implications:[{answer:'Restore previous selection',source:{type:'requester-answer',id:'Q2',label:'Q2 · Scope revision 2'},supported:true,behavior:['Restore the prior equipment on save.'],checks:['Saving restores its charge.']}]}}});
  state.current.c.answer='PRIVATE FUTURE ANSWER';
  const before=JSON.stringify(state),sidebar=View.render(state).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];
  const focus=sidebar.match(/<section class="fs-version-focus"[\s\S]*?<\/section>/)[0];
  for(const text of ['Read-only','Q2 · Scope revision 2','Answer used','Restore previous selection','Impact','Restore the prior equipment on save.','Acceptance check','Saving restores its charge.'])assert.ok(focus.includes(text),text);
  assert.doesNotMatch(focus,/<details|Select again|Full frozen plan|PRIVATE FUTURE/);
  assert.ok(sidebar.indexOf('fs-version-focus')<sidebar.indexOf('Full saved plan'));
  assert.match(sidebar,/data-kind="plan"[^>]*>Full saved plan/);
  assert.ok(sidebar.includes('Select again'));assert.match(sidebar,/Contains an answer used in V2/);assert.doesNotMatch(sidebar,/class="fs-entry-used"/);
  assert.equal(JSON.stringify(state),before);
  state.presentation.reasoning.sourceVersion=3;
  assert.doesNotMatch(View.render(state),/fs-version-focus|Used in V2/);
});
test('unmapped saved answers remain explicit and cannot claim an adopted relationship or invent a missing check',()=>{
  const state=vm({historyVersion:1,presentation:{historical:true,viewedRev:1,request:{},basis:[],versions:[],reasoning:{state:'submitted',sourceVersion:1,implications:[{answer:'An older answer',source:{type:'requester-answer',id:'Q1'},supported:false,note:'Unmapped',behavior:['An old unverified relation'],checks:[]}]}}});
  const sidebar=View.render(state).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];
  assert.match(sidebar,/Recorded answer|Relationship needs review/);assert.doesNotMatch(sidebar,/Answer used|An old unverified relation|Used in V1/);
  state.presentation.reasoning.implications[0]={answer:'Supported answer',source:{type:'requester-answer',id:'Q1'},supported:true,behavior:['Exact saved behavior'],checks:[]};
  assert.match(View.render(state),/No matching check was saved with this version/);
});
test('team follow-up action belongs to an adjusted candidate and preserves the adjustment context in its private question editor',()=>{
  const state=vm({actor:'Website team',status:{owner:'Website team',label:'Preparing V2'}});
  Object.assign(state.current.c,{rev:2,adjustment:'Please restore the old selection.',adjustments:[{rev:1,text:'Please restore the old selection.'}],versions:[{rev:1}],reviewFlow:{phase:'candidate',journey:{enabled:true,scopeCycle:1},sharedUnderstanding:{text:'Earlier shared scope'},candidateDraft:{approach:'Draft',checks:'Check'}}});
  state.presentation={request:{text:'Report'},basis:[],versions:[]};
  assert.match(View.render(state),/data-wq="reopen-clarification"[^>]*>[\s\S]*?Ask a follow-up/);
  state.actor='Requester';assert.doesNotMatch(View.render(state),/data-wq="reopen-clarification"/);
  state.actor='Website team';state.current.c.reviewFlow.phase='question-draft';state.current.c.reviewFlow.journey.scopeCycle=2;
  state.current.c.reviewFlow.reopenedFor={rev:1,reason:state.current.c.adjustment,scopeCycle:2};
  const html=View.render(state);assert.match(html,/Follow-up on changes requested to V1/);assert.match(html,/Please restore the old selection/);assert.doesNotMatch(html,/data-wq="send-questions"/);
  state.actor='Requester';state.current.c.reviewFlow.sharedUnderstanding.needsRevision=true;
  const waiting=View.render(state);assert.match(waiting,/reviewing your requested change/);assert.doesNotMatch(waiting,/Your correction|Follow-up on changes requested/);
  state.actor='Website team';state.current.c.reviewFlow.phase='candidate';state.current.c.adjustments=[];
  assert.doesNotMatch(View.render(state),/data-wq="reopen-clarification"/);
});
test('activity keeps distinct events but removes an exact repeated detail; identical check label and value render once', () => {
  const p={historical:true,viewedRev:1,request:{text:'Saved'},basis:[],versions:[],candidate:'Saved candidate',understanding:{text:'Saved candidate'},checks:[{label:'Saved check.',value:'Saved check.'},{label:'Different label',value:'Different value'}],activity:[
    {actor:'Requester',text:'Accepted version.',detail:'Accepted version.',at:'2026-11-04T13:00:00Z',rev:1},
    {actor:'Site owner',text:'Accepted version.',detail:'Separate authorization detail.',at:'2026-11-05T13:00:00Z',rev:1}
  ]};
  const state=vm({historyVersion:1,contextTab:'activity',presentation:p}),before=JSON.stringify(state),html=View.render(state),sidebar=html.match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];
  assert.equal((html.match(/Saved candidate/g)||[]).length,1);
  assert.equal((html.match(/Saved check\./g)||[]).length,1);
  assert.match(html,/Different label · Different value/);
  assert.equal((sidebar.match(/Accepted version\./g)||[]).length,2);
  assert.match(sidebar,/Separate authorization detail\./);
  assert.match(sidebar,/Recorded through version 1 submission/);
  assert.doesNotMatch(sidebar,/<details|<summary/);
  assert.equal(JSON.stringify(state),before);
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
  assert.match(html,/Use existing evidence/);
  assert.match(html,/Confirm with the customer/);
  assert.match(html,/The plan draft stays private/);
  assert.match(html,/questions are reviewed and previewed before sending/);
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
test('compact answer review keeps distinct implications and folds only pending adjustment context without changing saved data', () => {
  const state=evidenceState();state.current.c.reviewFlow.phase='answer-review';state.current.c.answer='Restore the previous selection.';
  state.current.c.versions=[{rev:1,answer:'Select again.',candidate:'V1 saved behavior',result:{checks:['V1 saved check']}}];
  state.presentation.reasoning.implications=[
    {answer:state.current.c.answer,behavior:['Restore on explicit save.'],checks:['Saving restores the prior charges.'],conflict:'This replaces the previously recorded policy.',source:{type:'requester-answer',label:'Q2 · Scope revision 2',id:'Q2'}},
    {answer:'Keep the other compartment unchanged.',behavior:['Apply this to the current compartment only.'],checks:['Other compartment charges stay unchanged.'],source:{type:'requester-answer',label:'Related answer'}},
    {answer:'Please restore the selection in V2.',behavior:[],checks:[],note:'The team has not yet updated the candidate.',source:{type:'revision-request',label:'Changes requested to V1',id:'V1'}}
  ];
  const before=JSON.stringify(state),html=View.render(state);
  const review=html.split('<div class="fs-answer-review">')[1].split('<details class="fs-answer-context">')[0];
  assert.equal((review.match(/Restore the previous selection\./g)||[]).length,1);
  assert.match(review,/Keep the other compartment unchanged\./);
  assert.match(review,/Restore on explicit save\./);
  assert.match(review,/Saving restores the prior charges\./);
  assert.match(review,/Other compartment charges stay unchanged\./);
  assert.match(review,/This replaces the previously recorded policy\./);
  assert.doesNotMatch(review,/Please restore the selection in V2\.|The team has not yet updated/);
  assert.match(html,/<details class="fs-answer-context"><summary>Answer &amp; adjustment context/);
  assert.match(html,/Q2 · Scope revision 2/);
  assert.match(html,/Changes requested to V1/);
  assert.match(html,/Please restore the selection in V2\./);
  assert.match(html,/The team has not yet updated the candidate\./);
  assert.doesNotMatch(html,/<details class="fs-answer-context" open/);
  assert.equal(JSON.stringify(state),before);
});
test('compact review never hides an unsupported answer or a conflicting adjustment behind context', () => {
  const state=evidenceState();state.current.c.reviewFlow.phase='answer-review';state.current.c.answer='A custom policy.';
  state.presentation.reasoning.implications=[
    {answer:state.current.c.answer,behavior:[],checks:[],note:'No supported result is inferred.',source:{type:'requester-answer',label:'Q2'}},
    {answer:'Conflicting change.',behavior:[],checks:[],conflict:'Resolve the incompatible requirements before sharing.',source:{type:'revision-request',label:'Changes requested to V1'}}
  ];
  const html=View.render(state),review=html.split('<div class="fs-answer-review">')[1].split('<details class="fs-answer-context">')[0];
  assert.match(review,/The answer needs a team decision/);
  assert.match(review,/No supported result is inferred\./);
  assert.match(review,/Conflicting change\./);
  assert.match(review,/Resolve the incompatible requirements before sharing\./);
  assert.doesNotMatch(review,/data-wq="confirm-scope"|name="approach"/);
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

test('first saved customer question is round one even when its preserved internal bundle id is Q2', () => {
  const state=evidenceState({actor:'Requester',status:{owner:'Requester',label:'Needs your input'}});
  const question={id:'return',text:'How should equipment be chosen later?',type:'single',options:['Select again','Restore selection'],required:true};
  const round={id:'Q2',round:'detailed',questions:[question],answered:false};
  Object.assign(state.current.c.reviewFlow,{phase:'awaiting-answer',sentBundle:round,questionRounds:[round],sharedUnderstanding:{text:'Previously shared plan'}});
  state.presentation.understanding={text:'Previously shared plan'};state.presentation.basis=[{text:'Previously shared plan'}];state.presentation.questionRounds=[round];
  const html=View.render(state),header=html.match(/<div class="fs-round">[\s\S]*?<\/div>/)[0];
  assert.match(header,/Question round 1/);
  assert.doesNotMatch(header,/Q2|Detailed decisions|Question round 2/);
  assert.match(html,/data-value="Q2:return"/);assert.doesNotMatch(html,/Reference Q2/);
  assert.match(html,/Awaiting your answer/);
  assert.match(html,/revise the shared plan/);
  assert.match(html,/Shared plan so far/);
  assert.doesNotMatch(html,/not drafted a plan|never drafted/);
  const team=View.render({...state,actor:'Website team'});
  assert.match(team,/Awaiting the customer’s answer/);
});
test('private question draft labels the next actual round and does not borrow the earlier bundle number', () => {
  const state=evidenceState();
  const earlier={id:'Q7',round:'initial',questions:[],answered:true};
  Object.assign(state.current.c.reviewFlow,{phase:'question-draft',questionDraft:[],questionRounds:[earlier],sentBundle:earlier});
  const html=View.render(state),header=html.match(/<div class="fs-round">[\s\S]*?<\/div>/)[0];
  assert.match(header,/Question round 2/);
  assert.match(header,/Draft · not sent/);
  assert.doesNotMatch(header,/Q7/);
  assert.match(html,/Questions under review/);
  assert.match(html,/Review and preview these private questions before sending/);
  state.current.c.reviewFlow.questionRounds=[];state.current.c.reviewFlow.sentBundle=null;
  assert.match(View.render(state),/Question round 1/);
});
test('inspector distinguishes a new review, an answer being reviewed, and a prepared revised draft', () => {
  const state=evidenceState();
  assert.match(View.render(state),/reviewing these records before drafting a plan/);
  state.current.c.reviewFlow.phase='answer-review';state.current.c.answer='An answer';
  assert.match(View.render(state),/Answer received/);
  assert.match(View.render(state),/reviewing how the answer changes the plan and checks/);
  state.current.c.reviewFlow.planPrepared=true;
  assert.match(View.render(state),/Updated plan in review/);
  assert.doesNotMatch(View.render(state),/not drafted a plan/);
  state.historyVersion=1;state.presentation={historical:true,viewedRev:1,request:{text:'Saved request'},basis:[],versions:[],checks:[]};
  const historical=View.render(state);
  assert.match(historical,/Version 1 basis/);
  assert.doesNotMatch(historical,/Updated plan in review|Answer received|Awaiting your answer/);
});
test('unknown supplied material offers a team draft without suggesting it has already been interpreted', () => {
  const state=evidenceState();state.current.c.reviewFlow.needsMaterialReview=true;
  const html=View.render(state);
  assert.match(html,/data-wq="draft-plan"[^>]*>[\s\S]*?Start a team draft/);
  assert.match(html,/The supplied material needs team review/);
  assert.match(html,/Confirm with the customer/);
  assert.doesNotMatch(html,/Use existing evidence|name="approach"/);
});

test('8+2 question overview is bounded, full index keeps groups, and detail preserves long multi-select and notes',()=>{
 const long='A long customer explanation. '.repeat(100),note='OTHER DETAIL '+long;
 const round=(id,count)=>({id,answered:true,questions:Array.from({length:count},(_,n)=>({id:'q'+n,text:'Question '+id+' '+n,type:n===1?'multi':'text',required:false})),answers:Object.fromEntries(Array.from({length:count},(_,n)=>['q'+n,n===0?long:n===1?['First choice','Second choice']:n===2?[]:'Answer '+id+' '+n])),answerNotes:{q1:note}});
 const state=vm({presentation:{historical:true,viewedRev:2,request:{},versions:[],questionRounds:[round('Q1',8),round('Q2',2)],reasoning:{state:'submitted',sourceVersion:2,implications:[{answer:long,source:{id:'Q2',linkage:'bundle'},supported:true,behavior:['Actual saved behavior'],checks:['Actual check']}]}}});
 const before=JSON.stringify(state),sidebar=View.render(state).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];
 assert.match(sidebar,/10 questions · 2 rounds/);assert.equal((sidebar.match(/class="fs-question-row"/g)||[]).length,4);assert.match(sidebar,/View all 10 questions/);assert.doesNotMatch(sidebar,/Reference Q|OTHER DETAIL/);assert.ok(!sidebar.includes(long));assert.match(sidebar,/2 answers recorded in Round 2/);
 const all=View.render({...state,inspector:{view:{kind:'list',section:'questions'}}}).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];
 assert.equal((all.match(/class="fs-question-row"/g)||[]).length,10);assert.match(all,/Skipped · optional/);assert.match(all,/Find a question or answer/);assert.ok(all.indexOf('data-round="Q2"')<all.indexOf('data-round="Q1"'));
 const detail=View.render({...state,inspector:{view:{kind:'question',id:'Q1:q1'},backLabel:'clarifications'}}).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];
 assert.match(detail,/<li>First choice<\/li><li>Second choice<\/li>/);assert.ok(detail.includes(note));assert.match(detail,/Source|Q1 \/ q1/);assert.doesNotMatch(detail,/class="fs-question-row"|data-round="Q2"/);assert.equal(JSON.stringify(state),before);
 const filtered=View.render({...state,inspector:{view:{kind:'list',section:'questions',query:'Q1 7'}}});assert.match(filtered,/Question Q1 7/);assert.equal((filtered.match(/class="fs-question-row"/g)||[]).length,1);
});
test('single clarification has no round scaffolding and exact adoption does not mark sibling answers',()=>{
 const entry={id:'Q2:a',questionId:'a',question:'Continue where?',answer:'Same quote',status:'answered'};
 const state=vm({presentation:{historical:true,viewedRev:2,request:{},versions:[],questionRounds:[{id:'Q2',entries:[entry]}],reasoning:{state:'submitted',sourceVersion:2,implications:[{answer:'Same quote',source:{id:'Q2',answerId:'Q2:a'},supported:true,behavior:['Stay here'],checks:['Same quote stays']} ]}}});
 let sidebar=View.render(state).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];assert.match(sidebar,/fs-single-answer/);assert.doesNotMatch(sidebar,/Round 1|Reference Q2|1 of 1/);assert.match(sidebar,/View source answer/);const detail=View.render({...state,inspector:{view:{kind:'question',id:'Q2:a'}}});assert.match(detail,/Same quote stays/);
 state.presentation.questionRounds[0].entries.push({...entry,id:'Q2:b',questionId:'b',question:'Another question?',answer:'Another answer'});
 sidebar=View.render(state).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];assert.equal((sidebar.match(/class="fs-entry-used"/g)||[]).length,1);
 const wrong=View.render({...state,inspector:{view:{kind:'question',id:'Q3:a'}}});assert.match(wrong,/not part of the selected version/);assert.doesNotMatch(wrong,/fs-record-answer/);
});
test('attachments, changes and versions use bounded indexes without losing full records',()=>{
 const note='Long requested change. '.repeat(100),state=vm({presentation:{historical:true,viewedRev:1,request:{attachments:Array.from({length:7},(_,i)=>({id:'file'+i,kind:'image',name:'Screenshot '+i}))},basis:[],versions:Array.from({length:7},(_,i)=>({rev:i+1,status:'Submitted',readOnly:true})),corrections:Array.from({length:6},(_,i)=>({id:'C'+i,text:note,scopeCycle:i+1,evidence:{attachments:[{id:'note'+i,name:'Correction evidence '+i,kind:'image'}]}}))}});
 const before=JSON.stringify(state),sidebar=View.render(state).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];
 assert.equal((sidebar.match(/class="fs-evidence-row"/g)||[]).length,3);assert.equal((sidebar.match(/class="fs-version-row/g)||[]).length,4);assert.equal((sidebar.match(/data-kind="change"/g)||[]).length,3);assert.ok(!sidebar.includes(note));
 for(const [section,expected,pattern] of [['attachments',7,/class="fs-evidence-row"/g],['versions',7,/class="fs-version-row/g],['changes',6,/data-kind="change"/g]]){const html=View.render({...state,inspector:{view:{kind:'list',section}}});assert.equal((html.match(pattern)||[]).length,expected);}
 const detail=View.render({...state,inspector:{view:{kind:'change',id:'correction:C2:2'}}});assert.ok(detail.includes(note));assert.match(detail,/Correction evidence 2/);assert.doesNotMatch(detail,/Correction evidence 3/);assert.equal(JSON.stringify(state),before);
});

test('ambiguous legacy answer text never duplicates an answer across identically worded questions',()=>{
 const groups=View.questionGroups({questionRounds:[{id:'Q1',answered:true,questions:[{id:'a',text:'Same question?'},{id:'b',text:'Same question?'},{id:'c',text:'Optional?',required:false}]}],answers:[{bundleId:'Q1',question:'Same question?',answer:'A saved answer with no question id'}]});
 assert.deepEqual(groups[0].entries.slice(0,3).map(e=>e.status),['not-recorded','not-recorded','skipped']);assert.ok(groups[0].entries.slice(0,3).every(e=>e.answer===undefined));assert.equal(groups[0].entries[3].unlinked,true);assert.equal(groups[0].entries[3].answer,'A saved answer with no question id');
 const exact=View.questionGroups({questionRounds:[{id:'Q1',questions:[{id:'a',text:'Same question?'},{id:'b',text:'Same question?'}]}],answers:[{bundleId:'Q1',questionId:'b',question:'Same question?',answer:'The second answer'}]});
 assert.equal(exact[0].entries[0].answer,undefined);assert.equal(exact[0].entries[1].answer,'The second answer');
});
test('long decision basis stays bounded on overview and full saved content stays reachable',()=>{
 const state=vm({presentation:{historical:true,viewedRev:1,request:{},basis:[{text:'Saved plan source'}],versions:[],reasoning:{state:'submitted',sourceVersion:1,implications:[{answer:'A short answer',source:{id:'old'},supported:true,behavior:['First behavior','Second behavior','Third behavior'],checks:['First check','Second check','Third check']}]}}});
 const sidebar=View.render(state).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];assert.match(sidebar,/First behavior|First check/);assert.doesNotMatch(sidebar,/Second behavior|Third check/);assert.match(sidebar,/View full basis/);assert.match(sidebar,/2 more saved items/);
 const full=View.render({...state,inspector:{view:{kind:'basis'}}}).match(/<aside class="fs-details[\s\S]*?<\/aside>/)[0];for(const s of ['First behavior','Second behavior','Third behavior','First check','Second check','Third check'])assert.ok(full.includes(s));
 const plan=View.render({...state,inspector:{view:{kind:'plan'}}});assert.match(plan,/Saved plan source/);
});

test('explicit legacy question identity beats stale question wording without reusing the answer',()=>{
 for(const identity of [{questionId:'a'},{id:'Q1:a'}]) {
  const input={questionRounds:[{id:'Q1',questions:[{id:'b',text:'Changed wording'},{id:'a',text:'Original question'}]}],answers:[{bundleId:'Q1',...identity,question:'Changed wording',answer:'Only for a'}]};
  const entries=View.questionGroups(input)[0].entries;assert.equal(entries.length,2);assert.equal(entries[0].answer,undefined);assert.equal(entries[1].answer,'Only for a');
 }
});
