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
