/* Read-only presentation of current and legacy CaseEngine records. Never a second case engine. */
(function(root){
  'use strict';
  const common=typeof module==='object'&&module.exports;
  const E=common?require('./engine.js'):root.CaseEngine;
  const Scenarios=common?require('./scenario-catalog.js'):root.FlowScenarios;
  const clone=value=>value===undefined?null:JSON.parse(JSON.stringify(value));
  const rows=value=>Array.isArray(value)?value:[];
  const lines=value=>String(value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const actorName=value=>value==='Reviewer'?'Requester':value;
  const publicActions=new Set(['submit','answer','send-questions','confirm-scope','edit-understanding','correct-understanding','deliver','adjust','accept','authorize','publish','publish-failed','retry-publish','request-release-changes']);
  const checked=value=>typeof value==='string'&&value.trim()?value:null;
  const excerpt=(value,size=180)=>String(value||'').trim().replace(/\s+/g,' ').slice(0,size);
  function safeView(c,snapshot){
    if(snapshot)return clone(snapshot.view)||{candidate:snapshot.candidate||snapshot.text||'',checks:clone(snapshot.checks)||[]};
    try{return E.derive(c);}catch{return {candidate:'',checks:[],manual:true,blocked:true,reason:'The team needs to review this saved record before continuing.'};}
  }
  function scenarioOf(c){
    const f=c.reviewFlow||{};
    if(f.scenarioId)return Scenarios?.get(f.scenarioId);
    return Scenarios?.list().find(s=>s.ticketId===f.source?.id)||null;
  }
  function knownTarget(c,scenario){return c.reviewFlow?.target||scenario?.target||c.authorization?.target||c.receipt?.target||'WinQuote homepage';}
  function title(c,scenario){
    if(scenario)return scenario.title;
    const view=safeView(c);
    if(view.proposal||['hesitation','button'].includes(view.kind))return 'Clarify the quote entry';
    if(view.kind==='entry')return 'Homepage quote instructions';
    return excerpt(c.text,110)||'Your WinQuote feedback';
  }
  function versionRows(c){
    const trail=rows(c.trail),latest=rows(c.versions).at(-1)?.rev;
    const versions=rows(c.versions).map(v=>{
      const event=action=>trail.find(t=>t.action===action&&t.rev===v.rev);
      const statuses=['submitted'];
      if(c.accepted?.rev===v.rev||event('accept'))statuses.push('accepted');
      if(c.authorization?.rev===v.rev||event('authorize'))statuses.push('authorized');
      if(c.receipt?.rev===v.rev||event('publish'))statuses.push('released');
      const statusKey=statuses.at(-1),label={submitted:'Submitted',accepted:'Accepted',authorized:'Release approved',released:'Released in simulation'}[statusKey];
      return {rev:v.rev,status:label,statusKey,statuses,at:event('deliver')?.at||v.deliveredAt||v.at||null,current:c.rev===v.rev,latestSubmitted:latest===v.rev,readOnly:true};
    });
    if(!versions.some(v=>v.rev===c.rev)&&!['draft'].includes(c.stage))versions.push({rev:c.rev,status:'Draft',statusKey:'draft',statuses:['draft'],at:null,current:true,latestSubmitted:false,readOnly:false});
    return versions.sort((a,b)=>b.rev-a.rev);
  }
  function why(item,{actor='Requester',rev}={}){
    const c=item?.c||{},scenario=scenarioOf(c),phase=c.reviewFlow?.phase||c.stage,view=safeView(c),version=rev||c.rev||1;
    const specifics={
      pdf:'The later PDF record already resolves navigation: open the saved PDF separately and keep Make PDF available. Avoid asking the customer to decide this again.',
      compartment:'The customer requested editable numbered titles; the owner also requested grouping. Keep those sources distinct while checking every compartment section.',
      refrigeration:'The saved flag, equipment and charges must agree. The team checks those facts; only the later equipment-choice policy needs a business decision when unresolved.',
    };
    const concern=view.proposal?.branch==='sending'?'The requester is worried that Create sends a quote. The candidate and check must explain what opens and what is sent.':view.proposal?.branch==='paths'?'The requester cannot choose an entry. The candidate and check must distinguish a template from starting from scratch.':'';
    const purpose={
      draft:'Describe the problem and preserve its context before asking the team to solve it.',
      triage:specifics[scenario?.id]||'Read the original feedback and supplied materials. The team should resolve known facts before asking for more context.',
      'question-draft':'These are private drafts. Screen out technical and already answered questions, then preview exactly what the requester will receive.',
      'awaiting-answer':c.reviewFlow?.sentBundle?.round==='detailed'?'The specification exposed a business choice. Answer this distinct batch; the team must confirm how it changes the scope.':'Only the requester knows the missing intent. The answer guides a team proposal; it does not accept a result.',
      clarify:'Describe the missing intent so the team can propose the solution instead of asking you to write it.',
      'answer-review':concern||'The actual answer changes a proposed scope, not an approved decision. The team checks the complete answer and any conflict before sharing an updated plan.',
      'spec-review':specifics[scenario?.id]||'The team has shared its understanding. Ask a second batch only for a new unresolved business decision; otherwise proceed without another customer reply.',
      candidate:concern||'Turn the confirmed scope and any requested change into the actual version '+version+' candidate and corresponding checks.',
      checking:'The result must demonstrate this exact candidate. A labelled simulation and team check are preparation for review, not proof of a live implementation.',
      ready:'Open the exact version '+version+' result and its checks before sending it. Sending freezes this candidate together with its evidence.',
      review:concern||'Try the delivered version '+version+' against the reported problem. Accepting it is separate from authorizing a release.',
      accepted:'The requester accepted version '+version+'. The site owner now reviews the same content and target before a separate authorization.',
      release:'The requester accepted version '+version+'. The site owner must separately authorize this exact version.',
      authorized:'Only the exact accepted and authorized version '+version+' can be released in this simulation.',
      'release-failed':'The failed attempt produced no success receipt. Retry the same authorized content or return the change to the team.',
      published:'This receipt identifies the accepted and authorized version '+version+'. The live WinQuote application was not changed.',
      blocked:'The saved input is retained. The team must resolve the unsupported or conflicting requirement instead of inventing a successful result.',
      processing:concern||'The website team prepares the actual candidate and checks from the supplied feedback. The requester can keep working.',
    };
    return {text:purpose[phase]||'Follow the current owner and check the exact current version before acting.',scenarioId:scenario?.id||null,phase,actor:actorName(actor),rev:version,source:scenario?.ticketId||'Original feedback'};
  }
  /** Material-specific, explicitly simulated organization; never analyzes an image or transcribes audio. */
  function preparation(item,stage=item?.ux?.preparation?.stage||'context-ready',{actor='Website team'}={}){
    const c=item?.c||{},f=c.reviewFlow||{},context=f.context||item?.ux?.context||{},attachments=rows(f.attachments||item?.ux?.attachments);
    const images=attachments.filter(a=>a.kind==='image').length,audio=attachments.filter(a=>a.kind==='audio').length;
    const items=[];
    const attachmentOnly=attachments.length&&/^See the attached (?:recording|image)\.$/.test(c.text||'');
    if(checked(c.text)&&!attachmentOnly)items.push({id:'request',label:'Requester’s words',text:excerpt(c.text,240),source:'Original feedback',status:'unconfirmed'});
    else if(attachmentOnly)items.push({id:'request',label:'Attachment-only feedback',text:'The requester supplied evidence without a written description.',source:'Submitted materials',status:'pending-team-review'});
    const page=context.page||context.route;if(page)items.push({id:'page',label:'Affected page',text:page,source:'Saved demo context',status:'captured'});
    if(context.quote||context.quoteId)items.push({id:'quote',label:'Quote',text:String(context.quote||context.quoteId),source:'Saved demo context',status:'captured'});
    if(context.selection?.label)items.push({id:'selection',label:'Selected area',text:context.selection.label,source:'Selected DOM context; not a screenshot',status:'captured'});
    if(images)items.push({id:'images',label:'Image evidence',text:images+' image'+(images===1?'':'s')+' retained for the team to inspect.',source:'Local originals',status:'unreviewed'});
    if(audio)items.push({id:'audio',label:'Voice evidence',text:audio+' voice note'+(audio===1?'':'s')+' retained. No automatic transcription or interpretation.',source:'Local originals',status:'unreviewed'});
    const scenario=scenarioOf(c);
    const later=stage==='team-review-pending',supported=scenario&&!f.needsMaterialReview&&Scenarios.matchesFeedback(scenario.id,c.text);
    let teamDraft=null;
    if(later&&supported){
      items.push({id:'records',label:'Preliminary reading',text:scenario.summary,source:scenario.ticketId+' · authored simulation, not a team decision',status:'pending-team-review'});
      teamDraft={kind:'plan',approach:scenario.scope.approach,checks:lines(scenario.scope.checks),questions:[],source:scenario.ticketId,status:'pending-team-review',simulated:true,shared:false};
    }else if(later&&!attachmentOnly){
      let original;try{original=E.derive(E.transition(E.createCase(c.text),'submit'));}catch{}
      if(original?.question)teamDraft={kind:'missing-context',approach:null,checks:[],questions:[original.question.text],source:'Original feedback · authored parser',status:'pending-team-review',simulated:true,shared:false};
      else if(original?.candidate&&!original.blocked&&!original.manual)teamDraft={kind:'plan',approach:original.candidate,checks:rows(original.checks).map(c=>c.value||c.label),questions:[],source:'Original feedback · authored parser',status:'pending-team-review',simulated:true,shared:false};
      else teamDraft={kind:'manual-review',approach:null,checks:[],questions:[],source:'Original materials',note:'The team must inspect this request and write the missing business question or proposal. No supported plan is inferred.',status:'pending-team-review',simulated:true,shared:false};
    }else if(later)teamDraft={kind:'material-review',approach:null,checks:[],questions:[],source:'Original attachments',note:'Inspect the original image or listen to the recording before drafting a business question or plan. No media meaning was inferred.',status:'pending-team-review',simulated:true,shared:false};
    const value={stage,title:stage==='context-ready'?'Your material is saved':later?'A preliminary plan is ready for team review':'Context brief ready',summary:stage==='context-ready'?'The request and available context stay together on this device.':later?supported?'A simulated plan and matching checks use the supported request and recorded context. The website team must confirm them before sharing the plan or sending questions.':'The supplied materials need a team decision. No automatic question or successful plan has been sent.':'The saved request, location and evidence are organized below. This brief does not interpret images or recordings.',items,facts:clone(items),questions:[],limitations:['Simulated preparation; pending team review.',...(images?['Images are retained for a person to inspect, not analyzed automatically.']:[]),...(audio?['Voice notes are not automatically transcribed.']:[])],simulated:true,pendingTeamReview:true,analyzedMedia:false};
    if(actor==='Website team'&&teamDraft){value.teamDraft=teamDraft;value.draftPlan=teamDraft;}
    return value;
  }
  /** Historical projections read ONLY the selected submitted snapshot. Missing data stays missing. */
  function describe(item,{rev,actor='Requester'}={}){
    if(!item?.c)return {missing:true,reason:'This feedback is unavailable.'};
    const c=item.c,historical=rev!==undefined&&rev!==null,snapshot=historical?rows(c.versions).find(v=>v.rev===Number(rev)):null;
    if(historical&&!snapshot)return {missing:true,historical:true,viewedRev:Number(rev),reason:'This submitted version is unavailable. Return to the current task.'};
    const view=safeView(c,snapshot),f=historical?(snapshot.reviewFlow||null):(c.reviewFlow||null);
    const presentationCase=historical?{...c,text:snapshot.source||'',reviewFlow:f||undefined,versions:[snapshot]}:c,scenario=scenarioOf(presentationCase);
    const text=historical?(snapshot.source??null):c.text;
    const context=historical?clone(f?.context||snapshot.evidence?.context):clone(f?.context||item.ux?.context);
    const attachments=historical?clone(f?.attachments||snapshot.evidence?.attachments)||[]:clone(f?.attachments||item.ux?.attachments)||[];
    const team=actor==='Website team',submitted=historical||['review','release','authorized','published'].includes(c.stage);
    // Delivery is the boundary: a submitted current version reads its own
    // immutable candidate, even if an older answer suggestion remains on f.
    const basisSnapshot=historical?snapshot:submitted?rows(c.versions).find(v=>v.rev===c.rev):null;
    const candidate=submitted?(basisSnapshot?.candidate??basisSnapshot?.text??''):(team?f?.candidateDraft?.approach||view.candidate||'':'');
    const checks=clone(submitted?basisSnapshot?.checks||basisSnapshot?.view?.checks||[]:team?view.checks:[])||[];
    const understanding=clone(f?.sharedUnderstanding);
    const pending=!submitted&&team&&f?.phase==='answer-review'&&!!f.suggestedScope;
    const editing=!submitted&&team&&['candidate','checking','ready'].includes(f?.phase);
    const scope=submitted?null:pending?f.suggestedScope:editing?f.candidateDraft:team?(f?.confirmedScope||f?.sharedUnderstanding||f?.scope):f?.sharedUnderstanding;
    const scopeText=submitted?candidate:scope?.text||scope?.approach||(!f&&team?candidate:'');
    const basisRev=basisSnapshot?.rev||c.rev;
    const basisStatus=submitted?'submitted-snapshot':pending?'pending-team-review':editing?'team-draft':f?.confirmedScope||understanding?'team-confirmed':'unconfirmed';
    const basisSource=submitted?{id:'V'+basisRev,kind:'submitted-version',label:'Submitted V'+basisRev,rev:basisRev}:pending?{id:f.sentBundle?.id||null,kind:'answer-proposal',label:'Requester answer · awaiting team confirmation',rev:c.rev}:editing?{id:'draft-V'+c.rev,kind:'team-draft',label:'Team draft V'+c.rev,rev:c.rev}:{id:f?.sharedUnderstanding?.id||null,kind:'team-scope',label:f?.sharedUnderstanding?'Team-shared understanding':'Team scope draft',rev:c.rev};
    const basis=lines(scopeText).map((text,index)=>({id:'basis-'+index,text,status:basisStatus,source:clone(basisSource)}));
    let sourceTrail=rows(c.trail);
    if(historical){const delivery=sourceTrail.findIndex(t=>t.action==='deliver'&&t.rev===snapshot.rev);sourceTrail=delivery>=0?sourceTrail.slice(0,delivery+1):sourceTrail.filter(t=>t.rev<=snapshot.rev);}
    const sentEvents=sourceTrail.filter(t=>t.action==='send-questions'),answerEvents=sourceTrail.filter(t=>t.action==='answer');
    let answers=rows(f?.questionRounds).filter(r=>r.answered).flatMap((r,index)=>rows(r.questions).map(q=>({id:r.id+':'+q.id,bundleId:r.id,round:r.round,scopeCycle:r.scopeCycle,question:q.text,text:q.text,answer:clone(r.answers?.[q.id]),value:clone(r.answers?.[q.id]),note:r.answerNotes?.[q.id]||'',simulated:r.answerSimulated===true,at:r.answeredAt||answerEvents[index]?.at||null})));
    const answer=historical?snapshot.answer:c.answer;
    if(!answers.length&&checked(answer))answers=[{id:'legacy-answer',round:'initial',question:'Requester’s clarification',text:'Requester’s clarification',answer,value:answer,simulated:(historical?snapshot.answerSimulated:c.answerSimulated)===true,at:answerEvents.at(-1)?.at||null}];
    let activity=sourceTrail;
    activity=activity.map((t,index)=>({...clone(t),id:'activity-'+index,actor:actorName(t.actor),at:t.at||null})).filter(t=>team||publicActions.has(t.action)).reverse();
    const decisions=rows(f?.source?.history).map((decision,index)=>({...clone(decision),id:'decision-'+index,superseded:decision.status==='superseded'||(f?.source?.id==='fb_2026-07-11_002'&&decision.date==='2026-07-16'&&rows(f.source.history).some(later=>later.date==='2026-08-05')),status:decision.status||(f?.source?.id==='fb_2026-07-11_002'&&decision.date==='2026-07-16'?'superseded':'historical-record')}));
    const questionRounds=rows(f?.questionRounds).map((r,index)=>({id:r.id,round:r.round,scopeCycle:r.scopeCycle,questions:clone(r.questions),answers:clone(r.answers),answerText:r.answerText||'',answered:r.answered===true,simulated:r.answerSimulated===true,at:r.sentAt||r.at||sentEvents[index]?.at||null}));
    if(!questionRounds.length&&f?.sentBundle)questionRounds.push({id:f.sentBundle.id,round:f.sentBundle.round||'initial',questions:clone(f.sentBundle.questions),answers:clone(f.answers),answered:f.phase!=='awaiting-answer',at:f.sentBundle.at||null});
    const projection={legacy:!c.reviewFlow||!c.reviewFlow.scenarioId,historical,currentRev:c.rev,viewedRev:historical?snapshot.rev:c.rev,
      phase:historical?'history':c.reviewFlow?.phase||c.stage,kind:f?.kind||view.kind||'other',title:title(presentationCase,scenario),target:historical?(f?.target||null):knownTarget(c,scenario),
      request:{text,context,attachments,at:context?.capturedAt||sourceTrail.find(t=>t.action==='submit')?.at||(historical?null:item.ux?.createdAt)||null,unavailable:historical&&(!f||text===null),source:clone(f?.source)},understanding,basis,answers,
      candidate,checks,proposal:team||submitted?clone(view.proposal):null,versions:versionRows(c),recordedDecisions:decisions,questionRounds,
      activity,adjustment:historical?snapshot.adjustment:c.adjustment,adjustmentEvidence:clone(f?.adjustmentEvidence||(historical?snapshot.evidence?.adjustment:item.ux?.adjustmentEvidence)),preview:E.reviewPreview(historical?snapshot:c),
      why:why(item,{actor,rev:historical?snapshot.rev:undefined}),preparation:historical?null:preparation(item,undefined,{actor})};
    if(historical)projection.why={...projection.why,scenarioId:scenario?.id||null,source:f?.source?.id||'Submitted snapshot',text:'Read-only V'+snapshot.rev+' and its saved evidence. Newer material and later decisions are not substituted into this snapshot.'};
    return projection;
  }
  const api={describe,why,preparation,activity:(item,options)=>describe(item,options).activity||[],publicActions:[...publicActions]};
  root.FeedbackPresentation=api;if(common)module.exports=api;
})(globalThis);
