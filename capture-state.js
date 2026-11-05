(function(root){
'use strict';
const times={'just-now':'Just now','earlier-today':'Earlier today',yesterday:'Yesterday','not-sure':'Not sure'};
function createCase(engine,draft){
 const text=String(draft.text||'').trim();if(!text)throw Error('Describe what should be fixed or improved.');if(text.length>2000)throw Error('Keep feedback to 2,000 characters.');
 const c=engine.createReviewedCase(text,{journey:true,target:'WinQuote · Make PDF'});
 c.reviewFlow.context={origin:'business-page-demo',page:'Make PDF',quote:'MW-1042',occurredAt:times[draft.when]||'',previewIncluded:!!draft.includePreview,simulated:true};
 return c;
}
function updates(items,seen={}){return items.flatMap(({id,c,captureSubmission})=>{
 const f=c.reviewFlow;if(!captureSubmission||f?.context?.origin!=='business-page-demo')return [];
 let event,title,next,label,owner;
 if(f.phase==='awaiting-answer'){event=f.sentBundle.id;title=f.sentBundle.round==='detailed'?'One detail needs your input':'The team has a question';next=f.sentBundle.round==='detailed'?'Answer the detailed questions':'Answer the initial questions';label=f.sentBundle.round==='detailed'?'Answer detailed questions':'Answer initial questions';owner='You · Requester';}
 else if(f.phase==='review'){event='V'+c.rev;title='V'+c.rev+' is ready for review';next='Check the proposal against your feedback';label='Review V'+c.rev;owner='You · Requester';}
 else if(f.phase==='published'){event='receipt-V'+c.rev;title='V'+c.rev+' release simulated';next='No further action needed';label='View receipt';owner='Complete';}
 else if(f.sharedUnderstanding&&!f.sharedUnderstanding.needsRevision&&['spec-review','question-draft','answer-review','candidate','checking','ready'].includes(f.phase)){event=f.sharedUnderstanding.id;title='The team shared its understanding';next='Read it, or keep working while the team prepares the change';label='Read understanding';owner='Website team';}
 else return [];
 const key=id+':'+event;return [{key,id,title,owner,next,label,read:!!seen[key]}];
 });}
const api={createCase,updates,times};root.FlowCaptureState=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
