/* One current ticket per record. Presentation cursors never carry case copies. */
(function(root){
  'use strict';
  const common=typeof module==='object'&&module.exports;
  const E=common?require('./engine.js'):root.CaseEngine;
  const WS=common?require('./workspace-state.js'):root.WorkspaceState;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const client='winquote', key='feedbackflow:casework:v2.1';
  const fail=message=>{throw Error(message);};
  const experience=data=>data.feedbackExperience||(data.feedbackExperience={schema:1,read:[],clockOffset:0});
  const publicNotificationActions=new Set(['send-questions','confirm-scope','deliver','accept','authorize','publish','publish-failed','delay','update-expectation']);
  const visibleEvents=item=>(item.ux?.events||[]).filter(e=>publicNotificationActions.has(e.action));
  function publicTrailEvents(item){
    const c=item.c||{},rounds=c.reviewFlow?.questionRounds||[];let sentIndex=0;
    return (c.trail||[]).flatMap((t,index)=>{
      const f=c.reviewFlow||{},round=t.action==='send-questions'?rounds[sentIndex++]:null;
      const titles={deliver:'V'+t.rev+' is ready for review',accept:'V'+t.rev+' was accepted',authorize:'V'+t.rev+' release authorized',publish:'V'+t.rev+' release simulated','send-questions':'Question from the website team','confirm-scope':'The team shared a plan','publish-failed':'Release needs attention'};
      if(!titles[t.action])return [];
      return [{id:item.id+':legacy:'+index+':'+t.action,ticketId:item.id,action:t.action,title:titles[t.action],cta:t.action==='send-questions'?'Answer the questions':t.action==='deliver'?'Review V'+t.rev:t.action==='accept'?'Approve the release':'View feedback',recipient:t.action==='accept'?'Site owner':'Requester',bundleId:round?.id||null,rev:t.rev,at:t.at||null,simulated:true,legacy:true}];
    });
  }
  function migrate(value){
    const base=value&&Array.isArray(value.items)?clone(value):{items:[],serial:20,current:null};
    const migrated=WS.migrate(base);
    for(const item of migrated.items){
      const flow=item.c?.reviewFlow;
      if(flow&&flow.evidenceFirst===undefined){
        flow.evidenceFirst=true;
        // Historical deliveries stay frozen; only the current unscreened task gains the new decision step.
        flow.planPrepared=!['triage','answer-review','question-draft','awaiting-answer'].includes(flow.phase);
      }
    }
    return {...migrated,serial:Math.max(20,Number(base.serial)||0,...base.items.map(i=>/^WQ-\d+$/.test(i.id)?Number(i.id.slice(3)):0)),feedbackExperience:{schema:1,read:[],clockOffset:0,...base.feedbackExperience},items:migrated.items.map(i=>({...i,sequence:i.sequence||0,ux:{...i.ux,events:Array.isArray(i.ux?.events)?i.ux.events:publicTrailEvents(i),drafts:i.ux?.drafts||{},walk:i.ux?.walk||{mode:'practice',role:'Requester',open:false},timing:i.ux?.timing||{updatedAt:i.c?.trail?.at(-1)?.at||null,nextUpdateAt:null}}}))};
  }
  const now=data=>new Date(Date.now()+(data.feedbackExperience?.clockOffset||0)).toISOString();
  const get=(data,id)=>data.items.find(i=>i.id===id&&(Object.prototype.hasOwnProperty.call(i,'clientId')?i.clientId:client)===client);
  const customerItems=data=>WS.items(data.items,client);
  const phase=item=>item?.c?.reviewFlow?.phase||(item?.c?.stage==='authorized'&&item.ux?.releaseAttempt?.status==='failed'?'release-failed':item?.c?.stage);
  function status(item,clock){
    if(!item)return {owner:'Requester',label:'Ready when you are',next:'Report a problem or follow your feedback.',why:'Every example follows the same feedback process, from the page where it happens.'};
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
      processing:['Website team','Preparing V'+c.rev,'The team is preparing a candidate from your feedback. You can keep working.','The team connects the actual request to a candidate and its checks.'],
      blocked:['Website team','Needs team review','The team needs to resolve the unsupported or conflicting requirement.','Keep the original input and evidence; do not invent a successful result.'],
    };
    const s=states[p]||['Website team','With the team','The team will review the next step.','The team owns the next decision.'];
    const t=item.ux?.timing||{};
    const P=common?require('./feedback-presentation.js'):root.FeedbackPresentation;
    return {owner:s[0],label:s[1],next:s[2],why:P?.why(item)?.text||s[3],phase:p,needsInput:['clarify','awaiting-answer','review'].includes(p),updatedAt:t.updatedAt||c.trail?.at(-1)?.at||null,nextUpdate:t.nextUpdateAt||null,overdue:!!(t.nextUpdateAt&&Date.parse(clock||new Date())>Date.parse(t.nextUpdateAt)&&s[0]==='Website team'),delayReason:t.delayReason||null};
  }
  function add(data,scenario,payload,options={}){
    const next=migrate(data);
    const prior=payload.captureId&&next.items.find(i=>i.clientId===client&&i.ux?.captureId===payload.captureId);
    if(prior){next.current=prior.id;return {data:next,item:prior,duplicate:true};}
    const id='WQ-'+String(++next.serial).padStart(3,'0'),at=now(next);
    const text=String(payload.text||'').trim();
    if(!text&&!payload.attachments?.length)throw Error('Add a description, image or recording before submitting.');
    const c=E.createReviewedCase(text||'See the attached '+(payload.attachments.some(a=>a.kind==='audio')?'recording':'image')+'.',{sourceId:scenario.ticketId,scenarioId:scenario.id,journey:true,evidenceFirst:true,target:scenario.target});
    c.reviewFlow.context=clone(payload.context||{});c.reviewFlow.attachments=clone(payload.attachments||[]);
    c.reviewFlow.sourceNote=scenario.sourceNote;
    if(!text){c.reviewFlow.needsMaterialReview=true;c.reviewFlow.scope={approach:'',checks:''};}
    const item={id,clientId:client,demoOnly:options.example===true,submissionOrigin:options.example?'example':'customer',captureSubmission:!options.example,sequence:1,c,ux:{captureId:payload.captureId||null,scenarioId:scenario.id,createdAt:at,preparation:{stage:'context-ready',at,simulated:true},context:clone(payload.context||{}),attachments:clone(payload.attachments||[]),occurredAt:payload.occurredAt||'Just now',events:[],drafts:{},timing:{updatedAt:at,nextUpdateAt:new Date(Date.parse(at)+2*3600000).toISOString()},walk:{mode:'practice',open:false,history:null}}};
    next.items.push(item);next.current=id;return {data:next,item};
  }
  const permitted={
    Requester:['submit','answer','correct-understanding','adjust','accept'],
    'Website team':['draft-plan','edit-scope','draft-questions','reopen-clarification','begin-detailed-questions','save-questions','edit-questions','close-questions','preview-questions','send-questions','confirm-scope','edit-understanding','finish-spec','edit-candidate','begin-check','prepare-result','deliver','publish','publish-failed','retry-publish'],
    'Site owner':['authorize','request-release-changes'],
  };
  function notification(item,action,at){
    const f=item.c.reviewFlow||{},v=item.c.rev;
    const types={
      'send-questions':['Question from the website team','Answer the questions','Requester',f.sentBundle?.id],
      'confirm-scope':['The team shared a plan','Read the shared plan','Requester',null],
      deliver:['V'+v+' is ready for review','Review V'+v,'Requester',null],
      accept:['V'+v+' was accepted','Approve the release','Site owner',null],
      authorize:['V'+v+' release authorized','View feedback','Requester',null],
      publish:['V'+v+' release simulated','View the receipt','Requester',null],
      'publish-failed':['Release needs attention','Read the update','Requester',null],
    };
    const spec=types[action];if(!spec)return null;
    return {id:item.id+':'+item.sequence+':'+action,ticketId:item.id,action,title:spec[0],cta:spec[1],recipient:spec[2],bundleId:spec[3],rev:v,at,simulated:true};
  }
  function exactLegacy(c,value,action){
    if(value?.rev!==c.rev||c.versions?.at(-1)?.rev!==c.rev)fail(action+' must identify the exact current submitted version V'+c.rev+'.');
  }
  function legacyCommand(item,command){
    const c=item.c,{action,value}=command;
    if(['accept','authorize','publish','adjust','request-release-changes','publish-failed','retry-publish'].includes(action))exactLegacy(c,value,action);
    if(action==='authorize'&&c.accepted?.rev!==c.rev)fail('Authorize only the exact accepted version.');
    if(['publish','publish-failed','retry-publish'].includes(action)&&(c.accepted?.rev!==c.rev||c.authorization?.rev!==c.rev))fail('Execute only the exact accepted and authorized version.');
    if(action==='publish'&&item.ux?.releaseAttempt?.status==='failed')fail('A failed release requires an explicit retry first.');
    if(action==='publish-failed'){
      if(c.stage!=='authorized'||!value?.reason?.trim())fail('Record a simulated failure only for an authorized version, with a reason.');
      item.ux.releaseAttempt={rev:c.rev,target:c.authorization.target,status:'failed',reason:value.reason,simulated:true};return {...clone(c),trail:[...(c.trail||[]),{action,actor:'Website team',rev:c.rev,text:'Simulated release failed: '+value.reason,simulated:true,at:null}]};
    }
    if(action==='retry-publish'){
      if(c.stage!=='authorized'||item.ux?.releaseAttempt?.rev!==c.rev||item.ux.releaseAttempt.status!=='failed')fail('Retry only the failed release of this exact authorized version.');
      item.ux.releaseAttempt={...item.ux.releaseAttempt,status:'retrying'};return {...clone(c),trail:[...(c.trail||[]),{action,actor:'Website team',rev:c.rev,text:'Retrying the same authorized version in simulation.',simulated:true,at:null}]};
    }
    if(action==='request-release-changes'){
      if(!['release','authorized'].includes(c.stage)||c.accepted?.rev!==c.rev||!value.reason?.trim())fail('The site owner can request meaningful changes only to the accepted version.');
      const reopened={...clone(c),stage:'review',owner:'Reviewer',accepted:null,authorization:null,receipt:null};
      const next=E.transition(reopened,'adjust',value.reason);next.trail.at(-1).actor='Site owner';next.adjustments.at(-1).actor='Site owner';item.ux.releaseAttempt=null;return next;
    }
    let next;
    if(action==='edit-candidate')next=E.editCandidate(c,typeof value==='string'?value:value?.approach);
    else if(action==='answer'){
      const answer=typeof value==='string'?value:value?.answer??Object.values(value?.answers||{})[0];
      if(typeof answer!=='string'||!answer.trim())fail('Answer the current saved question before continuing.');next=E.transition(c,'answer',answer);
    }else next=E.transition(c,action,action==='adjust'?value.reason:value);
    if(JSON.stringify(next)===JSON.stringify(c))fail('This action is unavailable for the current saved feedback. Review its current task.');
    return next;
  }
  function legacyAdjustmentEvidence(item,command){
    const value=command.value||{},attachments=value.attachments||[];
    if(!Array.isArray(attachments)||attachments.some(a=>!a||!['image','audio'].includes(a.kind)||typeof(a.id||a.attachmentId)!=='string'||a.blob!==undefined||a.dataUrl!==undefined))fail('Pass local image or audio manifest references for this adjustment, not binary originals.');
    const hasEvidence=['attachments','context','captureId'].some(k=>Object.prototype.hasOwnProperty.call(value,k));
    const evidence=hasEvidence?{rev:value.rev,actor:command.actor,attachments:clone(attachments),...(value.captureId?{captureId:value.captureId}:{}),...(value.context?{context:clone(value.context)}:{})}:null;
    item.ux.adjustmentEvidence=evidence;
    if(evidence&&item.c.adjustments?.length)item.c.adjustments.at(-1).evidence=clone(evidence);
  }
  function commit(data,id,command){
    const next=clone(data),item=get(next,id);
    if(!item)throw Error('This feedback is not available in this workspace.');
    if(item.sequence!==command.expectedSequence)throw Error('This feedback has changed. Review its latest version before continuing.');
    if(!permitted[command.actor]?.includes(command.action))throw Error('This action belongs to a different role.');
    item.ux=item.ux||{events:[],drafts:{},attachments:[]};
    const legacy=!item.c.reviewFlow;
    item.c=item.c.reviewFlow?E.review(item.c,command.action,command.value):legacyCommand(item,command);
    if(legacy&&['adjust','request-release-changes'].includes(command.action))legacyAdjustmentEvidence(item,command);
    if(legacy&&command.action==='deliver')item.c.versions.at(-1).evidence={context:clone(item.ux.context||{}),attachments:clone(item.ux.attachments||[]),adjustment:clone(item.ux.adjustmentEvidence||null)};
    item.sequence+=1;const at=now(next);if(item.c.trail?.length)item.c.trail.at(-1).at=at;
    item.ux=item.ux||{events:[],drafts:{},attachments:[]};
    const owner=status(item).owner;
    const previousTiming=item.ux.timing||{};
    const privateEdit=['draft-plan','edit-scope','draft-questions','reopen-clarification','save-questions','edit-questions','preview-questions','close-questions','edit-candidate','begin-detailed-questions'].includes(command.action);
    // A completed task consumes its return prompt; retaining it would point at the previous owner/action.
    if(!privateEdit)delete item.ux.sinceLastVisit;
    item.ux.timing={...previousTiming,updatedAt:privateEdit?previousTiming.updatedAt:at,nextUpdateAt:owner==='Website team'?(previousTiming.nextUpdateAt||new Date(Date.parse(at)+2*3600000).toISOString()):null};
    if(command.simulated){
      item.c.trail.at(-1).simulated=true;item.c.trail.at(-1).text='Walkthrough simulation · '+item.c.trail.at(-1).text;
      const f=item.c.reviewFlow;
      if(command.action==='answer'){
        if(!f?.journey?.enabled||f.sentBundle.round==='initial')item.c.answerSimulated=true;
        if(f?.questionRounds)f.questionRounds=f.questionRounds.map(r=>r.id===f.sentBundle.id?{...r,answerSimulated:true}:r);
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
    return customerItems(data).flatMap(i=>visibleEvents(i).map(e=>({...e,read:read.has(e.id),ticketTitle:i.c.reviewFlow?.target||'Your feedback'}))).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))||String(b.id).localeCompare(String(a.id)));
  }
  function resolve(data,ticketId,eventId){
    const item=get(data,ticketId);if(!item)return {missing:true,message:'This feedback is not available on this device. Return to My feedback to continue.'};
    const event=(item.ux?.events||[]).find(e=>e.id===eventId),f=item.c.reviewFlow;
    let stale=false,message='';
    if(eventId&&!event)message='This update is no longer available. You are viewing the current feedback.';
    if(event?.bundleId&&(f?.sentBundle?.id!==event.bundleId||f?.phase!=='awaiting-answer')){stale=true;message='This question has already been answered or replaced. You are viewing the current task.';}
    if(event&&event.rev!==item.c.rev){stale=true;message='V'+event.rev+' is an earlier version. You are viewing the current V'+item.c.rev+'.';}
    return {item,event,stale,message};
  }
  function markRead(data,eventId){const next=clone(data);if(!updates(next).some(e=>e.id===eventId))return next;experience(next).read=[...new Set([...(next.feedbackExperience.read||[]),eventId])];return next;}
  function advance(data,hours=3){if(typeof hours!=='number'||!Number.isFinite(hours)||hours<0)fail('Advance the local simulation by a finite nonnegative number of hours.');const next=clone(data);experience(next).clockOffset=(next.feedbackExperience.clockOffset||0)+hours*3600000;return next;}
  /** Visit cursors are customer metadata. Opening a ticket never marks an answer, approval, or update read. */
  function visit(data,id){
    const next=clone(data),item=get(next,id);if(!item)fail('This feedback is not available in this workspace.');
    const fx=experience(next),clients=fx.clients||{},settings=clients[client]||{},visits=settings.visits||{},previous=Object.prototype.hasOwnProperty.call(visits,id)?visits[id]:null;
    const events=visibleEvents(item),seen=new Set(previous?.eventIds||[]),unseen=previous?events.filter(e=>!seen.has(e.id)):[];
    const delivered=unseen.filter(e=>e.action==='deliver').map(e=>'V'+e.rev),asked=unseen.filter(e=>e.action==='send-questions').length,delayed=unseen.some(e=>e.action==='delay'),released=unseen.some(e=>e.action==='publish');
    const descriptions=[];if(delivered.length)descriptions.push(delivered.join(', ')+' '+(delivered.length===1?'is':'are')+' ready for review');if(asked)descriptions.push(asked+(asked===1?' question batch was':' question batches were')+' sent');if(delayed)descriptions.push('an update was delayed');if(released)descriptions.push('the release was simulated');
    const other=unseen.length-unseen.filter(e=>['deliver','send-questions','delay','publish'].includes(e.action)).length;
    if(other)descriptions.push(other+(other===1?' other update':' other updates'));
    const text=descriptions.length?descriptions.join('; ')+'. '+status(item,now(next)).next:'';
    const summary=previous&&unseen.length?{text,count:unseen.length,eventIds:unseen.map(e=>e.id),fromAt:previous.at,toAt:now(next),newVersionIds:delivered}:null;
    fx.clients={...clients,[client]:{...settings,visits:{...visits,[id]:{at:now(next),eventIds:events.map(e=>e.id),lastSubmittedRev:item.c.versions?.at(-1)?.rev||null}}}};
    item.ux||={};item.ux.sinceLastVisit=text||null;
    return {data:next,item,summary};
  }
  /** One digest per customer ticket; events remain independently addressable for stale-link checks. */
  function groupedUpdates(data,list,taskIds){
    const groups=new Map();
    for(const event of list){
      if(!groups.has(event.ticketId))groups.set(event.ticketId,[]);groups.get(event.ticketId).push(event);
    }
    return [...groups.entries()].map(([ticketId,events])=>{
      const latest=events[0],item=get(data,ticketId),state=status(item,now(data)),unreadCount=events.filter(e=>!e.read).length;
      return {...latest,id:ticketId+':digest',ticketId,eventId:latest.id,latestEventId:latest.id,events:clone(events),count:events.length,unreadCount,read:unreadCount===0,
        title:events.length===1?latest.title:events.length+' updates · '+(item?.c.reviewFlow?.target||'Your feedback'),summary:latest.title+'. '+state.next,body:latest.title+'. '+state.next,status:state,cta:(taskIds?taskIds.has(ticketId):state.needsInput)?'Open current task':'View feedback',at:latest.at,rev:item?.c.rev};
    }).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))||a.ticketId.localeCompare(b.ticketId));
  }
  function digest(data){return groupedUpdates(data,updates(data));}
  /** Role-scoped demo presentation, not authentication or a new workflow engine.
   * A task is derived from the current case, never from whether an event was read.
   * Opening this projection does not visit a ticket or consume its return summary.
   */
  function attention(data,{actor='Requester'}={}){
    const items=customerItems(data),supported=Object.prototype.hasOwnProperty.call(permitted,actor),clock=now(data);
    const tasks=supported?items.flatMap(item=>{
      const state=status(item,clock),c=item.c,f=c.reviewFlow||{},v='V'+c.rev;
      if(state.owner!==actor)return [];
      const actions={
        clarify:['answer','Answer the question'],
        'awaiting-answer':['answer','Answer the questions'],
        review:['review','Review '+v],
        accepted:['approve-release','Approve '+v+' for release'],
        release:['approve-release','Approve '+v+' for release'],
        triage:['review-evidence',f.planPrepared?'Review the draft plan':'Review the evidence'],
        'question-draft':['screen-questions','Review the questions'],
        'answer-review':['update-plan',f.planPrepared?'Review the updated plan':'Draft an updated plan'],
        'spec-review':['prepare-version','Confirm the plan for '+v],
        candidate:['prepare-version','Prepare '+v],
        checking:['prepare-version','Check '+v],
        ready:['send-review','Send '+v+' for review'],
        authorized:['release','Run the approved '+v+' release'],
        'release-failed':['retry-release','Retry the '+v+' release'],
        processing:['prepare-version','Prepare '+v],
        blocked:['review-evidence','Review the blocked plan'],
      };
      const action=actions[state.phase];
      // A local report draft is resumable, but is not a team-assigned task.
      // Unknown phases must not create an apparent actionable assignment.
      if(!action)return [];
      return [{ticketId:item.id,title:f.target||'Your feedback',owner:state.owner,phase:state.phase,
        action:action[0],actionLabel:action[1],rev:c.rev,bundleId:state.phase==='awaiting-answer'?f.sentBundle?.id||null:null,
        sequence:item.sequence,updatedAt:state.updatedAt,nextUpdate:state.nextUpdate,overdue:state.overdue,status:state}];
    }):[];
    tasks.sort((a,b)=>Number(b.overdue)-Number(a.overdue)||String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))||a.ticketId.localeCompare(b.ticketId));
    const relevantUpdates=supported?updates(data).filter(event=>event.recipient===actor):[];
    const unreadCount=relevantUpdates.filter(event=>!event.read).length;
    const taskIds=new Set(tasks.map(task=>task.ticketId));
    const unreadFyiCount=relevantUpdates.filter(event=>!event.read&&!taskIds.has(event.ticketId)).length;
    return {actor,items,tasks,taskCount:tasks.length,updates:relevantUpdates,
      updateGroups:groupedUpdates(data,relevantUpdates,taskIds),unreadCount,hasUnread:unreadCount>0,unreadFyiCount,hasUnreadFyi:unreadFyiCount>0};
  }
  function metadataItem(data,id){const next=clone(data),item=get(next,id);if(!item)fail('This feedback is not available in this workspace.');item.ux||={events:[],drafts:{}};return {next,item};}
  function metadataEvent(item,action,title,at,eventId){
    return {id:eventId,ticketId:item.id,action,title,cta:'Read the update',recipient:'Requester',bundleId:null,rev:item.c.rev,at,simulated:true};
  }
  /** An explicit scheduling decision; ordinary private draft saves never call this. */
  function setExpectation(data,id,{at,reason='',eventId}={}){
    const {next,item}=metadataItem(data,id);
    if(at!==null&&(!at||!Number.isFinite(Date.parse(at))))fail('Set a valid update time, or explicitly leave it unset.');
    if(typeof reason!=='string'||reason.length>2000)fail('Keep the update explanation to 2,000 characters.');
    const timestamp=now(next),eventKey=eventId||id+':expectation:'+String(at)+':'+reason;
    if((item.ux.events||[]).some(e=>e.id===eventKey))return {data:next,item,event:null,duplicate:true};
    const old=item.ux.timing||{},changed=old.nextUpdateAt!==at;
    item.ux.timing={...old,nextUpdateAt:at,delayReason:reason||null,updatedAt:timestamp,
      expectationHistory:[...(old.expectationHistory||[]),...(changed&&old.nextUpdateAt?[{at:old.nextUpdateAt,replacedAt:timestamp,reason:old.delayReason||null}]:[])]};
    const event=metadataEvent(item,'update-expectation',at?'The team set the next update':'The next update time is not set',timestamp,eventKey);event.expectedAt=at;event.reason=reason;
    item.ux.events=[...(item.ux.events||[]),event];return {data:next,item,event,duplicate:false};
  }
  /** Record a disclosed delay once per promised checkpoint. It never moves that checkpoint. */
  function recordDelay(data,id,{reason='The team has not set a revised update time yet.',eventId}={}){
    const {next,item}=metadataItem(data,id),timing=item.ux.timing||{},promised=timing.nextUpdateAt;
    if(typeof reason!=='string'||!reason.trim()||reason.length>2000)fail('Explain the delay in 1 to 2,000 characters.');
    if(!promised||Date.parse(promised)>=Date.parse(now(next)))fail('A delayed update needs an existing overdue checkpoint.');
    const eventKey=eventId||id+':delay:'+promised;
    if((item.ux.events||[]).some(e=>e.id===eventKey))return {data:next,item,event:null,duplicate:true};
    item.ux.timing={...timing,delayReason:reason,delayedFor:promised,updatedAt:now(next)};
    const event=metadataEvent(item,'delay','The next update is delayed',now(next),eventKey);event.expectedAt=promised;event.reason=reason;
    item.ux.events=[...(item.ux.events||[]),event];return {data:next,item,event,duplicate:false};
  }
  /** Presentation state may contain read-only scene snapshots. It cannot overwrite item.c. */
  function saveWalk(data,id,patch={}){
    const {next,item}=metadataItem(data,id);
    if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.prototype.hasOwnProperty.call(patch,'c')||Object.prototype.hasOwnProperty.call(patch,'case'))fail('Save walkthrough metadata separately from the canonical case.');
    if(patch.mode!==undefined&&!['watch','practice'].includes(patch.mode))fail('Choose Watch or Practice.');
    if(patch.role!==undefined&&!['Requester','Website team','Site owner'].includes(patch.role))fail('Choose a supported demo perspective.');
    if(patch.scenes!==undefined&&(!Array.isArray(patch.scenes)||patch.scenes.length>512))fail('Keep walkthrough history within 512 read-only scenes.');
    item.ux.walk={...(item.ux.walk||{}),...clone(patch)};return {data:next,item,walk:clone(item.ux.walk)};
  }
  /** Store a useful local simulated intermediate without sending questions or changing business state. */
  function preparation(data,id,stage='draft-ready'){
    const {next,item}=metadataItem(data,id);
    if(!['context-ready','draft-ready','team-review-pending'].includes(stage))fail('Choose a supported simulated preparation stage.');
    const P=common?require('./feedback-presentation.js'):root.FeedbackPresentation;
    const value=P.preparation(item,stage);item.ux.preparation={...value,at:now(next)};
    return {data:next,item,preparation:clone(item.ux.preparation)};
  }
  const api={key,client,migrate,get,customerItems,now,status,add,commit,updates,resolve,markRead,advance,visit,digest,attention,setExpectation,recordDelay,saveWalk,preparation};
  root.FeedbackStore=api;if(common)module.exports=api;
})(globalThis);
