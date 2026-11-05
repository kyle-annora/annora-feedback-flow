(function(root){
'use strict';
const E=typeof module==='object'&&module.exports?require('./engine.js'):root.CaseEngine;
const clone=x=>JSON.parse(JSON.stringify(x));
const options=['Keep editing this quote','Move on to next workflow step'];
const scenes={
 intro:['Requester','Start the PDF walkthrough',0,'From feedback to an approved change.','One request. The right questions. A change you can confidently review.'],
 report:['Requester','Submit the feedback',0,'Tell us what got in your way.','You generated a quote PDF, but it did not open. Report the problem without leaving your work.'],
 submitted:['Website team','Review the feedback',1,'You can keep working.','Your feedback and quote context are together. The team takes it from here.'],
 screen:['Website team','Review and send the question',1,'Ask only what matters.','AI prepares a question. The team decides whether it is useful before the customer sees it.'],
 notify:['Requester','Open the question',2,'Pick up where you left off.','You have left the feedback page. A reminder brings you back to the same request.'],
 answer:['Requester','Answer the team’s question',2,'What would you do next?', 'Tell us your intention. The team will work out the solution.'],
 plan:['Website team','Review and share the plan',3,'Your answer shapes the proposal.','AI suggests the behavior and checks. The team reviews both before sharing the plan.'],
 shared:['Website team','Prepare and send V1',3,'Here’s the plan we’re working from.','The customer can read the shared plan. No extra approval is needed while the team prepares the change.'],
 review:['Requester','Review the submitted version',4,'Does this version solve the problem?','Try the proposal, then accept it or ask for an adjustment. Acceptance does not authorize release.'],
 adjust:['Requester','Describe the remaining change',4,'What still needs to change?','Keep the same request. Tell the team what the next version needs to resolve.'],
 revise:['Website team','Edit and send the next version',3,'Refine the next version.','The original answer and the requested adjustment stay with the work. Edit the proposal before sending it back.'],
 release:['Site owner','Approve this version for release',5,'Approve the version they accepted.','The customer has accepted this exact version. Release is a separate decision for the site owner.'],
 authorized:['Website team','Run the simulated release',5,'Approved. Back with the team.','The site owner authorized this version. The team can now carry out the simulated release.'],
 done:['Complete','No further action needed',5,'A clear finish, on the same request.','The receipt connects the released version, customer acceptance and owner approval.']
};
function fresh(){return {schema:1,scene:'intro',id:null,c:null,history:[],historyIndex:null,feedback:E.pdfFeedback,answer:'',includeQuestion:true,editing:false,previewOpen:false,draftQuestion:'',draftScope:null,adjustment:'Make Go to Workflow easier to find beside the PDF result.'};}
function snapshot(s){const {history,historyIndex,...frame}=s;return clone(frame);}
function step(input,action,value={}){
 const s=clone(input);if(s.historyIndex!==null&&!['back','current'].includes(action))throw Error('Return to the current step to continue.');
 if(action==='back'){if(!s.history.length)throw Error('There is no earlier step.');s.historyIndex=s.historyIndex===null?s.history.length-1:Math.max(0,s.historyIndex-1);return s;}
 if(action==='current'){s.historyIndex=null;return s;}
 const allowed={start:['intro'],submit:['report'],'next-team':['submitted'],'send-question':['screen'],'open-question':['notify'],answer:['answer'],'edit-plan':['plan'],'share-plan':['plan'],'next-candidate':['shared'],adjust:['review'],'send-adjustment':['adjust'],deliver:['revise'],accept:['review'],authorize:['release'],publish:['authorized'],'open-preview':['review','release','authorized','done']};
 if(!allowed[action]?.includes(s.scene))throw Error('This action is not available at the current step.');
 if(['accept','authorize','publish','send-adjustment'].includes(action)&&value.rev!==undefined&&value.rev!==s.c.rev)throw Error('This decision belongs to an older version. Review the current version first.');
 const previous=snapshot(s),run=(a,v)=>{s.c=E.review(s.c,a,v);};
 if(action==='start')s.scene='report';
 if(action==='submit'){
  const feedback=String(value.feedback??s.feedback).trim();if(!feedback||feedback.length>2000)throw Error('Add a short description of the PDF problem.');
  if(!value.id)throw Error('A feedback record is required.');s.id=value.id;s.feedback=feedback;
  s.c=E.createReviewedCase(feedback,{sourceId:'fb_2026-07-11_002',journey:true,target:'WinQuote · Make PDF'});
  s.c.reviewFlow.context={origin:'business-page-demo',page:'Make PDF',quote:'MW-1042',simulated:true,curated:true};s.scene='submitted';
 }
 if(action==='next-team'){run('draft-questions');s.draftQuestion=s.c.reviewFlow.questionDraft[0].text;s.scene='screen';}
 if(action==='send-question'){
  s.includeQuestion=value.includeQuestion??s.includeQuestion;
  if(!s.includeQuestion){run('close-questions');const f=s.c.reviewFlow;run('confirm-scope',{...f.scope,understanding:'Open the saved PDF and keep the current quote in place. Workflow remains a separate action.'});s.scene='shared';}
  else {s.draftQuestion=String(value.question??s.draftQuestion).trim();const qs=clone(s.c.reviewFlow.questionDraft);qs[0]={...qs[0],text:s.draftQuestion,options,screened:true};run('save-questions',qs);run('preview-questions');run('send-questions');s.scene='notify';}
 }
 if(action==='open-question')s.scene='answer';
 if(action==='answer'){
  const answer=value.answer??s.answer;if(!options.includes(answer))throw Error('Choose what you would do next.');run('answer',answer);s.answer=answer;s.draftScope=clone(s.c.reviewFlow.suggestedScope);s.draftScope.understanding=understanding(answer);s.scene='plan';
 }
 if(action==='edit-plan')s.editing=!s.editing;
 if(action==='share-plan'){s.draftScope={...s.draftScope,...value};run('confirm-scope',s.draftScope);s.editing=false;s.scene='shared';}
 if(action==='next-candidate'){run('finish-spec');run('prepare-result');run('deliver');s.scene='review';}
 if(action==='adjust'){s.scene='adjust';s.previewOpen=false;}
 if(action==='send-adjustment'){
  s.adjustment=String(value.reason??s.adjustment).trim();run('adjust',{rev:s.c.rev,reason:s.adjustment});
  // A revision starts from the exact submitted version. The team edits it, rather than silently applying a guessed fix.
  s.draftScope=clone(s.c.reviewFlow.candidateDraft);s.scene='revise';
 }
 if(action==='deliver'){s.draftScope={...s.draftScope,...value};run('edit-candidate',s.draftScope);run('prepare-result');run('deliver');s.scene='review';}
 if(action==='accept'){run('accept',{rev:s.c.rev});s.c.accepted.simulated=true;s.scene='release';s.previewOpen=false;}
 if(action==='authorize'){run('authorize',{rev:s.c.rev});s.c.authorization.simulated=true;s.scene='authorized';}
 if(action==='publish'){run('publish',{rev:s.c.rev});s.scene='done';}
 if(action==='open-preview')s.previewOpen=!s.previewOpen;
 if(s.scene!==input.scene)s.history.push(previous);
 return s;
}
function understanding(answer){return answer===options[1]?'Open the PDF and make the next workflow step easy to find, while leaving navigation in your control.':'Open the PDF without losing your place, so you can keep editing the current quote.';}
function view(input){
 const s=input.historyIndex!==null?input.history[input.historyIndex]:input;
 const [owner,next,progress,title,description]=scenes[s.scene];let f=s.c?.reviewFlow,scope=s.draftScope||f?.candidateDraft||f?.scope||{approach:'',checks:''};
 if(s.scene==='answer'&&options.includes(s.answer))scope=E.review(s.c,'answer',s.answer).reviewFlow.suggestedScope;
 if(['review','adjust','release','authorized','done'].includes(s.scene)&&s.c?.versions.length)scope=s.c.versions.at(-1).reviewFlow.candidateDraft;
 return {...s,owner,next,title,description,progress,options,scope,understanding:f?.sharedUnderstanding?.text||s.draftScope?.understanding||understanding(s.answer),question:f?.sentBundle?.questions[0]?.text||s.draftQuestion,
  rev:s.c?.rev||1,acceptedRev:s.c?.accepted?.rev,revisionDraft:s.draftScope||scope,sentQuestions:f?.sentBundle?.questions||[],canBack:input.history.length>0,historyViewing:input.historyIndex!==null,
  previewSupported:s.c?E.reviewPreview(s.c).interactive:false,previewReason:s.c?E.reviewPreview(s.c).reason:'',
  reason:s.answer===options[1]?'You want to move on, so the proposal makes the next step explicit. The PDF still opens without redirecting your quote.':s.answer?'You want to keep editing, so the proposal protects your place in the same quote.':'The team will use your answer to propose the behavior and acceptance checks.'};
}
const api={fresh,step,view,options,scenes};root.ShowcaseModel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
