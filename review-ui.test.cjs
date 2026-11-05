const test=require('node:test'),assert=require('node:assert/strict');
const E=require('./engine.js');globalThis.CaseEngine=E;require('./review-ui.js');const UI=globalThis.ReviewUI;const S=require('./review-story.js');
test('requester sees no private questions, records decisions or editing controls before send',()=>{
 let c=E.review(E.createReviewedCase(E.pdfFeedback),'draft-questions');
 const q=c.reviewFlow.questionDraft.map(x=>({...x,text:'Private evidence '+x.id}));c=E.review(c,'save-questions',q);
 const html=UI.render(c,{role:'Requester'});
 assert.ok(html.includes('No action is needed'));assert.ok(!html.includes('Private evidence'));assert.ok(!html.includes('Recorded decisions'));assert.ok(!html.includes('r-questions-form'));assert.ok(!html.includes('Screen and send questions'));
 const team=UI.render(c,{role:'Website team'});assert.ok(team.includes('Private evidence'));assert.ok(team.includes('Save private draft'));
});
test('sent preview and customer form contain only selected questions and exact edited wording',()=>{
 let c=E.review(E.createReviewedCase(E.pdfFeedback),'draft-questions');let q=c.reviewFlow.questionDraft.map(x=>({...x}));q[0].text='Which task follows opening your PDF?';c=E.review(c,'save-questions',q);c=E.review(c,'send-questions');
 const html=UI.render(c,{role:'Requester'});assert.ok(html.includes(q[0].text));assert.ok(!html.includes(q[1].text));assert.ok(!html.includes(q[2].text));assert.ok(html.includes('Send answer to the team'));
});
test('unknown edited PDF candidates never show a fixed interaction as their result',()=>{
 let c=E.createReviewedCase(E.pdfFeedback);c=E.review(c,'confirm-scope',c.reviewFlow.scope);c=E.review(c,'edit-candidate',{approach:'Send the PDF by email.',checks:'Check the email recipient.'});c=E.review(c,'prepare-result');
 const html=UI.render(c,{role:'Website team'});assert.ok(html.includes('Send the PDF by email.'));assert.ok(!html.includes('data-go="r-open-pdf"'));assert.ok(html.includes('custom candidate has no interactive preview'));
});
test('read-only history uses its snapshot instead of current unsaved scope or question drafts',()=>{
 const c=E.createReviewedCase(E.pdfFeedback);const html=UI.render(c,{role:'Website team',history:true,drafts:{scope:{approach:'FUTURE DRAFT',checks:'FUTURE CHECK'}},questionDraft:[{text:'FUTURE QUESTION'}]});
 assert.ok(!html.includes('FUTURE'));assert.ok(html.includes('Earlier step'));assert.ok(html.includes('textarea disabled'));
});
test('the original two Create concerns produce distinct visible candidate and review evidence',()=>{
 const states=E.hesitationAnswers.map(answer=>S.build({kind:'create',answer,adjust:false}).find(f=>f.case.stage==='review').case);
 const html=states.map(c=>UI.render(c,{role:'Requester'}));assert.ok(html[0].includes('Configure a walk-in'));assert.ok(html[1].includes('Use a template'));assert.notEqual(html[0],html[1]);assert.ok(html.every(h=>h.includes('Accept V1')&&!h.includes('Approve V1')));
});

const journey=()=>E.createReviewedCase(E.pdfFeedback,{journey:true});
const shared=c=>E.review(c,'confirm-scope',{...c.reviewFlow.scope,understanding:'The PDF opens separately and this quote stays available.'});
test('shared understanding is customer-visible and correctable while private scope and technical questions remain team-only',()=>{
 const c=shared(journey()),html=UI.render(c,{role:'Requester'});
 assert.ok(html.includes('The PDF opens separately and this quote stays available.'));
 assert.ok(html.includes('Here’s what we understood'));
 assert.ok(html.includes('data-go="r-correct-understanding"'));
 assert.ok(html.includes('Your original feedback'));
 assert.ok(!html.includes('r-scope-form'));
 assert.ok(!html.includes('Planned approach &amp; acceptance checks'));
 assert.ok(!html.includes('Review detailed questions'));
 assert.ok(!html.includes(c.reviewFlow.questionDraft[1].text));
 assert.ok(!html.includes(c.reviewFlow.questionDraft[2].text));
 const team=UI.render(c,{role:'Website team'});
 assert.ok(team.includes('data-go="r-begin-detailed-questions"'));
 assert.ok(team.includes('data-go="r-finish-spec"'));
});

test('a requester can still read and correct understanding after the asynchronous team starts an unsent candidate',()=>{
 let c=shared(journey());
 for(const action of ['finish-spec','begin-check','prepare-result']){
  c=E.review(c,action);const html=UI.render(c,{role:'Requester'});
  assert.ok(html.includes('The PDF opens separately and this quote stays available.'));
  assert.ok(html.includes('data-go="r-correct-understanding"'));
  assert.ok(!html.includes('r-candidate-form'));
  assert.ok(!html.includes('data-go="r-deliver"'));
 }
 c=E.review(c,'deliver');const sent=UI.render(c,{role:'Requester'});
 assert.ok(!sent.includes('data-go="r-correct-understanding"'));
 assert.ok(sent.includes('data-go="r-adjust"'));
 assert.ok(sent.includes('Accept V1'));
});

test('initial and detailed customer question pages identify their exact batch and expose only the selected sent questions',()=>{
 let c=journey();c=E.review(E.review(c,'draft-questions'),'send-questions');
 const initial=UI.render(c,{role:'Requester'});
 assert.ok(initial.includes('Initial clarification · Q1'));
 c=E.review(c,'answer','Keep editing this quote');c=E.review(c,'confirm-scope',{...c.reviewFlow.suggestedScope,understanding:'Keep the same quote available.'});
 c=E.review(E.review(c,'begin-detailed-questions'),'send-questions');
 const detailed=UI.render(c,{role:'Requester'});
 assert.ok(detailed.includes('Detailed decisions · Q2'));
 assert.ok(detailed.includes('Where would you expect to find Go to Workflow'));
 assert.ok(!detailed.includes('r-questions-form'));
 assert.ok(!detailed.includes('Technical feasibility'));
 assert.ok(detailed.includes('Question rounds'));
});

test('a submitted preview keeps the frozen source quote even when current working context later changes',()=>{
 let c=journey();c.reviewFlow.context={origin:'business-page-demo',quote:'MW-1042',page:'Make PDF',simulated:true};
 c=E.review(E.review(E.review(shared(c),'finish-spec'),'prepare-result'),'deliver');
 assert.equal(c.versions[0].reviewFlow.context.quote,'MW-1042');
 c.reviewFlow.context.quote='FUTURE-999';
 const result=UI.result(c,{role:'Requester'});
 assert.ok(result.includes('Quote MW-1042'));
 assert.ok(!result.includes('FUTURE-999'));
});

test('a real detailed answer is not labelled as an example because the initial clarification used a sample answer',()=>{
 const frames=S.build({kind:'pdf',journey:true,ask:true,detailed:true,detailedAnswer:'At the page footer',adjust:false});
 const c=frames.find(f=>f.case.reviewFlow.phase==='answer-review'&&f.case.reviewFlow.sentBundle.round==='detailed').case;
 assert.equal(c.answerSimulated,true,'Initial clarification is still correctly marked as a sample.');
 assert.equal(c.reviewFlow.questionRounds.at(-1).answerSimulated,false,'The supplied detailed answer is actual input.');
 const html=UI.render(c,{role:'Website team'});
 assert.ok(!html.includes('<span>Requester’s answer · example</span><p>At the page footer</p>'));
 assert.ok(html.includes('<p>At the page footer</p>'));
});
