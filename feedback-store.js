/* One current ticket per record. Presentation cursors never carry case copies. */
(function(root){
  'use strict';
  const common=typeof module==='object'&&module.exports;
  const E=common?require('./engine.js'):root.CaseEngine;
  const WS=common?require('./workspace-state.js'):root.WorkspaceState;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const client='winquote', key='feedbackflow:casework:v2.1';
  function migrate(value){
    const base=value&&Array.isArray(value.items)?clone(value):{items:[],serial:20,current:null};
    const migrated=WS.migrate(base);
    return {...migrated,serial:Math.max(20,Number(base.serial)||0,...base.items.map(i=>/^WQ-\d+$/.test(i.id)?Number(i.id.slice(3)):0)),feedbackExperience:{schema:1,read:[],clockOffset:0,...base.feedbackExperience},items:migrated.items.map(i=>({...i,sequence:i.sequence||0}))};
  }
  const now=data=>new Date(Date.now()+(data.feedbackExperience?.clockOffset||0)).toISOString();
  const get=(data,id)=>data.items.find(i=>i.id===id&&(Object.prototype.hasOwnProperty.call(i,'clientId')?i.clientId:client)===client);
  const customerItems=data=>WS.items(data.items,client);
  const phase=item=>item?.c?.reviewFlow?.phase||item?.c?.stage;
  function status(item,clock){
    if(!item)return {owner:'Requester',label:'Ready when you are',next:'Choose a workflow to try.',why:'Start with a real business problem, in the page where it happens.'};
    const c=item.c,f=c.reviewFlow||{},p=phase(item),v='V'+c.rev;
    const states={
      triage:['Website team','Reviewing your feedback','The team will review the evidence. You can keep working.','The team checks what is already known before asking you to repeat it.'],
      'question-draft':['Website team','Preparing questions','The team is screening the questions.','AI suggests questions; the team removes anything the records or a technical check can answer.'],
      'awaiting-answer':['Requester','Needs your input','Answer the questions from the team.','Your business context resolves the decisions the team cannot make for you.'],
      'answer-review':['Website team','Answer received','The team will update the plan using your answer.','An answer becomes a proposed change; the team is responsible for confirming its scope.'],
      'spec-review':['Website team','Preparing the specification','The team is turning the shared plan into a result.','Resolve any remaining business choice before preparing the result.'],
      candidate:['Website team','Preparing '+v,'The team is preparing a result for you to try.','A concrete result and relevant checks make the proposed change reviewable.'],
      checking:['Website team','Checking '+v,'The team is checking the proposed result.','Checks must match the exact candidate being sent.'],
      ready:['Website team',v+' ready to send','The team will send this version for your review.','The result and its checks travel together in one frozen version.'],
      review:['Requester','Ready for review','Try '+v+', then accept it or request a change.','You can inspect the exact result against the problem you reported.'],
      accepted:['Site owner','Waiting for release approval','The site owner will approve the accepted version.','Accepting a result and authorizing its release are separate decisions.'],
      authorized:['Website team','Release authorized','The team can run the simulated release.','Only the accepted and authorized version can be released.'],
      'release-failed':['Website team','Release needs attention','The team can retry the same authorized version.','A failed attempt does not create a success receipt or change the approved content.'],
      published:['Complete','Release simulated','No action is needed.','The receipt records which version was released in this simulation.'],
      clarify:['Requester','Needs your input','Answer the team’s question.','Only missing context needs an answer.'],
      release:['Site owner','Waiting for release approval','The site owner will approve this version.','Acceptance does not automatically publish the change.'],
      draft:['Requester','Draft','Finish your feedback.','Describe the problem without needing to write the solution.'],
    };
    const s=states[p]||['Website team','With the team','The team will review the next step.','The team owns the next decision.'];
    const t=item.ux?.timing||{};
    return {owner:s[0],label:s[1],next:s[2],why:s[3],updatedAt:t.updatedAt||c.trail?.at(-1)?.at||null,nextUpdate:t.nextUpdateAt||null,overdue:!!(t.nextUpdateAt&&Date.parse(clock||new Date())>Date.parse(t.nextUpdateAt)&&s[0]==='Website team'),delayReason:t.delayReason||null};
  }
  function add(data,scenario,payload,options={}){
    const next=migrate(data);
    const prior=payload.captureId&&next.items.find(i=>i.clientId===client&&i.ux?.captureId===payload.captureId);
    if(prior){next.current=prior.id;return {data:next,item:prior,duplicate:true};}
    const id='WQ-'+String(++next.serial).padStart(3,'0'),at=now(next);
    const text=String(payload.text||'').trim();
    if(!text&&!payload.attachments?.length)throw Error('Add a description, image or recording before submitting.');
    const c=E.createReviewedCase(text||'See the attached '+(payload.attachments.some(a=>a.kind==='audio')?'recording':'image')+'.',{sourceId:scenario.ticketId,scenarioId:scenario.id,journey:true,target:scenario.target});
    c.reviewFlow.context=clone(payload.context||{});c.reviewFlow.attachments=clone(payload.attachments||[]);
    c.reviewFlow.sourceNote=scenario.sourceNote;
    if(!text){c.reviewFlow.needsMaterialReview=true;c.reviewFlow.scope={approach:'',checks:''};}
    const item={id,clientId:client,demoOnly:options.example===true,submissionOrigin:options.example?'example':'customer',captureSubmission:!options.example,sequence:1,c,ux:{captureId:payload.captureId||null,scenarioId:scenario.id,createdAt:at,preparation:{stage:'context-ready',at,simulated:true},context:clone(payload.context||{}),attachments:clone(payload.attachments||[]),occurredAt:payload.occurredAt||'Just now',events:[],drafts:{},timing:{updatedAt:at,nextUpdateAt:new Date(Date.parse(at)+2*3600000).toISOString()},walk:{mode:'practice',open:false,history:null}}};
    next.items.push(item);next.current=id;return {data:next,item};
  }
  const permitted={
    Requester:['answer','correct-understanding','adjust','accept'],
    'Website team':['edit-scope','draft-questions','begin-detailed-questions','save-questions','edit-questions','close-questions','preview-questions','send-questions','confirm-scope','edit-understanding','finish-spec','edit-candidate','begin-check','prepare-result','deliver','publish','publish-failed','retry-publish'],
    'Site owner':['authorize','request-release-changes'],
  };
  function notification(item,action,at){
    const f=item.c.reviewFlow,v=item.c.rev;
    const types={
      'send-questions':['Question from the website team','Answer the questions','Requester',f.sentBundle?.id],
      'confirm-scope':['The team shared a plan','Read the shared plan','Requester',null],
      deliver:['V'+v+' is ready for review','Review V'+v,'Requester',null],
      accept:['V'+v+' was accepted','Approve the release','Site owner',null],
      publish:['V'+v+' release simulated','View the receipt','Requester',null],
      'publish-failed':['Release needs attention','Read the update','Requester',null],
    };
    const spec=types[action];if(!spec)return null;
    return {id:item.id+':'+item.sequence+':'+action,ticketId:item.id,action,title:spec[0],cta:spec[1],recipient:spec[2],bundleId:spec[3],rev:v,at,simulated:true};
  }
  function commit(data,id,command){
    const next=clone(data),item=get(next,id);
    if(!item)throw Error('This feedback is not available in this workspace.');
    if(item.sequence!==command.expectedSequence)throw Error('This feedback has changed. Review its latest version before continuing.');
    if(!permitted[command.actor]?.includes(command.action))throw Error('This action belongs to a different role.');
    item.c=E.review(item.c,command.action,command.value);
    item.sequence+=1;const at=now(next);if(item.c.trail?.length)item.c.trail.at(-1).at=at;
    item.ux=item.ux||{events:[],drafts:{},attachments:[]};
    const owner=status(item).owner;
    const previousTiming=item.ux.timing||{};
    const privateEdit=['edit-scope','draft-questions','save-questions','edit-questions','preview-questions','close-questions','edit-candidate','begin-detailed-questions'].includes(command.action);
    item.ux.timing={...previousTiming,updatedAt:privateEdit?previousTiming.updatedAt:at,nextUpdateAt:owner==='Website team'?(previousTiming.nextUpdateAt||new Date(Date.parse(at)+2*3600000).toISOString()):null};
    if(command.simulated){
      item.c.trail.at(-1).simulated=true;item.c.trail.at(-1).text='Walkthrough simulation · '+item.c.trail.at(-1).text;
      const f=item.c.reviewFlow;
      if(command.action==='answer'){
        if(!f.journey?.enabled||f.sentBundle.round==='initial')item.c.answerSimulated=true;
        if(f.questionRounds)f.questionRounds=f.questionRounds.map(r=>r.id===f.sentBundle.id?{...r,answerSimulated:true}:r);
      }
      if(command.action==='accept')item.c.accepted.simulated=true;
      if(command.action==='authorize')item.c.authorization.simulated=true;
    }
    const event=notification(item,command.action,at);if(event)item.ux.events=[...(item.ux.events||[]),event];
    if(command.action==='send-questions')delete item.ux.drafts.answers;
    next.current=id;return {data:next,item,event};
  }
  function updates(data){
    const read=new Set(data.feedbackExperience?.read||[]);
    return customerItems(data).flatMap(i=>(i.ux?.events||[]).map(e=>({...e,read:read.has(e.id),ticketTitle:i.c.reviewFlow?.target||'Your feedback'}))).sort((a,b)=>b.at.localeCompare(a.at));
  }
  function resolve(data,ticketId,eventId){
    const item=get(data,ticketId);if(!item)return {missing:true,message:'This feedback is not available on this device. Return to My feedback to continue.'};
    const event=(item.ux?.events||[]).find(e=>e.id===eventId),f=item.c.reviewFlow;
    let stale=false,message='';
    if(eventId&&!event)message='This update is no longer available. You are viewing the current feedback.';
    if(event?.bundleId&&(f.sentBundle?.id!==event.bundleId||f.phase!=='awaiting-answer')){stale=true;message='This question has already been answered or replaced. You are viewing the current task.';}
    if(event&&event.rev!==item.c.rev){stale=true;message='V'+event.rev+' is an earlier version. You are viewing the current V'+item.c.rev+'.';}
    return {item,event,stale,message};
  }
  function markRead(data,eventId){const next=clone(data);next.feedbackExperience.read=[...new Set([...(next.feedbackExperience.read||[]),eventId])];return next;}
  function advance(data,hours=3){const next=clone(data);next.feedbackExperience.clockOffset=(next.feedbackExperience.clockOffset||0)+hours*3600000;return next;}
  const api={key,client,migrate,get,customerItems,now,status,add,commit,updates,resolve,markRead,advance};
  root.FeedbackStore=api;if(common)module.exports=api;
})(globalThis);
