(() => {
'use strict';
const E=window.CaseEngine, P=window.CasePersonas, I=window.Glyph, $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stages={draft:'Draft',clarify:'Needs your input',processing:'In progress',blocked:'Needs team input',review:'Ready for review',release:'Awaiting authorization',authorized:'Authorized',published:'Release simulated'};
const actorModes={'Requester':['customer','lilac','Requester'],'Website team':['people','mint','Website team'],'Reviewer':['verify','amber','Reviewer'],'Site owner':['flag','rose','Site owner'],'Complete':['checks','mint','Complete']};
const examples=[['Homepage quote instructions',E.initialFeedback],['Specify a button label','Change the WinQuote homepage button label from “Create” to “Start a quote”.'],['Clarify a button label','New employees find the homepage quote button label confusing.'],['Pricing rule change','Change the homepage discount rules so staff can edit quote prices.']];
const navRows=[['clarify','ask','Needs your input'],['processing','clock','In progress'],['review','verify','Ready for review'],['release','release','Release approvals']];
const key='feedbackflow:casework:v2.1', viewKey='feedbackflow:walk:v2.1';
const createViewKey='feedbackflow:walk:create:v1';
const roleAnswerKey='feedbackflow:role-answer:v2';
const roleStoryVersion=2;
function savedRoleAnswer(){
  try{return sessionStorage.getItem(roleAnswerKey)||E.hesitationAnswers[0];}
  catch{return E.hesitationAnswers[0];}
}
let roleAnswer=savedRoleAnswer();
const transition=(c,acts)=>acts.reduce((a,x)=>E.transition(a,...x),c);
function init(){return {current:'WQ-017',serial:17,items:[{id:'WQ-017',c:E.createCase()},{id:'WQ-016',c:transition(E.createCase(examples[2][1]),[['submit']])},{id:'WQ-015',c:transition(E.createCase(examples[1][1]),[['submit'],['deliver']])}]}}
let data;
try {
  const stored=JSON.parse(localStorage.getItem(key));
  const valid=Array.isArray(stored?.items)&&stored.items.some(item=>item.id===stored.current);
  data=valid?window.CaseUpgrade.workspace(stored):init();
  if(valid){
    data.items=data.items.map(item=>({...item,c:E.resumeWorkingCase(item.c)}));
  }
} catch { data=init(); }
function savedTour(storageKey){
  try {
    const cached=JSON.parse(sessionStorage.getItem(storageKey));
    if(cached?.frames?.[cached.index]?.case&&cached.record===data.current){
      const validated=storageKey===createViewKey?cached:window.CaseUpgrade.walkthrough(cached);
      if(P.list.some(role=>role.id===validated.type)&&validated.roleStoryVersion!==roleStoryVersion){
        const frames=P.frames(validated.type,validated.scenarioAnswer||roleAnswer);
        return {...validated,frames,index:0,roleStoryVersion,playing:false};
      }
      if(validated.type==='mine'){
        for(const [index,frame] of validated.frames.entries()){
          const repaired=E.resumeWorkingCase(frame.case);
          if(repaired!==frame.case){
            const frames=[...validated.frames.slice(0,index),{case:repaired,title:'Clarify the requested wording'}];
            return {...validated,frames,index:Math.min(index,validated.index),playing:false};
          }
        }
      }
      return {...validated,playing:false};
    }
  } catch {}
  return null;
}
let tour=savedTour(createViewKey)||savedTour(viewKey);
let page='case',filter='all',tab='checks',search='',navOpen=false,asideOpen=false,activeSource=-1,timer=null,notifyTimer=null,priorOwner=null,panelStage=null;
const selected=()=>data.items.find(x=>x.id===data.current);
const here=()=>tour?tour.frames[tour.index].case:selected().c;
const clone=x=>JSON.parse(JSON.stringify(x));
function save(){try{localStorage.setItem(key,JSON.stringify(data));}catch{}}
function saveTour(){try{if(tour)sessionStorage.setItem(tour.type==='create'?createViewKey:viewKey,JSON.stringify({...tour,playing:false}));else sessionStorage.removeItem(viewKey);}catch{}}
const role=(who)=>actorModes[who]||['customer','lilac',who];
const avatar=(who,s=17)=>{const r=role(who);return '<span class="avatar '+r[1]+'" aria-hidden="true">'+I(r[0],s-5)+'</span>'};
const fileTag=()=>'<span class="wmark" aria-hidden="true">W</span>';
const btn=(action,txt,icon,cls='',extra='')=>'<button type="button" data-go="'+action+'" class="control '+cls+'" '+extra+'>'+(icon?I(icon):'')+esc(txt)+'</button>';
const iconbtn=(act,icon,label)=>'<button type="button" class="iconbtn" data-go="'+act+'" aria-label="'+esc(label)+'" title="'+esc(label)+'">'+I(icon)+'</button>';
const label=c=>{if(!c.text.trim())return 'New feedback';const v=E.derive(c);if(['button','hesitation'].includes(v.kind))return 'Homepage quote button';if(v.kind==='entry')return 'Homepage quote instructions';if(/rules?|discounts?|pric(?:e|ing)|规则|折扣|价格/i.test(c.text))return 'Homepage pricing rules';return 'Homepage feedback';};
const badge=c=>'<span class="state '+esc(c.stage)+'"><i></i>'+esc(stages[c.stage])+'</span>';
function matches(c,filter){
  if(filter==='all')return true;
  if(filter==='processing')return ['processing','blocked','authorized'].includes(c.stage);
  return c.stage===filter;
}

function announce(s){clearTimeout(notifyTimer);$('live').textContent=s;notifyTimer=setTimeout(()=>{$('live').textContent=''},2400);}
function renderNav(){
  const nav=$('nav');
  const queueLinks=navRows.map(([id,icon,title])=>{
    const count=data.items.filter(item=>matches(item.c,id)).length;
    return '<button class="navrow '+(filter===id?'selected':'')+'" data-go="filter:'+id+'">'+
      I(icon)+'<span>'+title+'</span><small>'+count+'</small></button>';
  }).join('');
  nav.innerHTML='<div class="brand"><span class="flowmark">'+FlowMark+'</span><strong>Feedback Flow</strong></div>'+
    '<div class="navgroup topnav">'+
      btn('find','Search feedback','search','navrow')+
      btn('filter:all','Feedback inbox','inbox','navrow '+(filter==='all'?'selected':''))+
      btn('new','New feedback','plus','navrow newlink')+'</div>'+
    '<div class="navgroup"><span class="navlabel">Queues</span>'+queueLinks+'</div>'+
    '<div class="navgroup project-group"><span class="navlabel">Projects</span><button class="navrow" data-go="project">'+fileTag()+'<span>WinQuote</span></button></div>'+
    '<div class="rail-end"><span class="navlabel">Walkthroughs</span>'+
      '<button class="navrow" data-go="create-tour">'+I('branch',16)+'Explore “Create”</button>'+
      '<button class="navrow" data-go="personas">'+I('play',15)+'Role walkthroughs</button>'+
      '<div class="local"><span class="local-dot"></span>Local demo workspace</div></div>';
  nav.classList.toggle('show',navOpen);
  $('shade').hidden=!navOpen;
}
function renderBar(){
  const c=here(),isCase=page==='case';
  const crumb=isCase?'<span class="slash">/</span><span class="crumbid">'+esc(tour&&tour.type!=='mine'?'Sample feedback':data.current)+'</span>':'';
  let tool='';
  if(isCase&&tour)tool=btn('exit','Exit walkthrough','cross','subtle');
  else if(isCase&&c.stage!=='published')tool=btn('walk','Play walkthrough','play','outline',c.text.trim()?'':'disabled');
  $('topbar').innerHTML='<div class="crumb">'+iconbtn('nav','menu','Open navigation')+
    '<span class="crumbicon">'+I('inbox',15)+'</span><button data-go="filter:all" class="txtbtn">Feedback inbox</button>'+
    crumb+'</div><div class="tools">'+tool+'</div>';
}
function sourceArea(c){
  const isEdit=!tour&&!c.versions.length;
  const example=isEdit&&c.stage==='draft'?btn('examples','Try an example','down','plainbtn revert'):'';
  const field=isEdit
    ? '<textarea id="source" rows="2" maxlength="2000" aria-label="Original feedback" placeholder="What would you change on the homepage?">'+esc(c.text)+'</textarea>'
    : '<div class="saved-source">'+esc(c.text||'No feedback yet')+'</div>';
  return '<section class="source-block"><div class="section-head"><h2>'+I('quote',15)+'Original feedback</h2>'+example+'</div>'+field+
    (isEdit?'<div class="edit-under"><span>'+I('edit',12)+'Editable</span><div id="quick"></div></div>':'')+'</section>';
}
function budgetToken(raw,limit){
  if(!Number.isInteger(limit)||limit<=0)return null;
  const amount='(?<!\\d)'+limit+'(?!\\d)';
  const unit='(?:\\s*(?:-\\s*)?(?:English\\s+)?words?\\b|\\s*(?:个?英文)?词)';
  const trailing=new RegExp(amount+'(?='+unit+')','gi');
  const prior=new RegExp('\\b(?:word (?:limit|count|budget)|maximum|max|limit)\\s*(?:of|is|to|:|=)?\\s*('+amount+')','gi');
  const found=[...raw.matchAll(trailing)].map(match=>match.index);
  for(const match of raw.matchAll(prior))found.push(match.index+match[0].length-match[1].length);
  return found.length?Math.max(...found):null;
}
function quick(v){
  if(v.kind!=='entry'||tour||here().versions.length||budgetToken(here().text,v.limit)===null)return '';
  const next=v.limit===10?3:v.limit===3?18:10;
  return btn('budget','Try '+next+' words','branch','quickbtn');
}
function fragCandidate(s){return (s.match(/[^.!?]+(?:[.!?]+|$)/g)||[s]).map(x=>x.trim()).filter(Boolean);}
function candidateLines(v){
const items=fragCandidate(v.candidate), span=(s,i)=>'<span class="'+(/^Add customer details next/i.test(s)?'retained':'')+'" data-frag="'+i+'">'+esc(s)+'</span>';
if(items.length>1&&v.kind==='entry'&&/^Add customer details next/i.test(items.at(-1))&&/^Standard/.test(items[0])){
const anchor='Standard quotes start with a template. Custom quotes start from scratch.';
return '<span class="anchored-prefix" data-reserve="'+anchor+'"><span>'+items.slice(0,-1).map(span).join(' ')+'</span></span>'+span(items.at(-1),items.length-1);
}
return items.map(span).join(' ');
}
function answerFields(q){
  return '<form id="touranswerform"><div class="opts concern-options">'+q.options.map(o=>'<button type="button" data-tour-opt="'+esc(o)+'">'+esc(o)+'</button>').join('')+'</div><label for="tourans">Or describe what made you hesitate</label><div class="input-actions"><input id="tourans" required maxlength="500" placeholder="In your own words…"><button class="control outline">Use answer</button></div></form>';
}
function proposalHTML(v){
  const p=v.proposal;
  return '<div class="proof team-proof" data-proposal-branch="'+esc(p.branch)+'"><div class="proof-label">'+(p.branch==='paths'?'Homepage · Quote entry points':'Homepage · Quote button')+'</div>'+
    (p.edited?'<p class="edited-proposal">'+esc(v.candidate)+'</p>':p.items.map(item=>'<div class="proposal-option"><span class="candidate-text button-proof">'+esc(item.label)+I('send',14)+'</span><p>'+esc(item.detail)+'</p></div>').join(''))+
    '<div class="review-prompt"><div>'+I('verify',14)+'Review question</div><p id="review-question">'+esc(p.reviewQuestion)+'</p></div></div>';
}
function candidateHTML(c,v){
let delivered=Boolean(c.versions.find(a=>a.rev===c.rev))&&!['processing','blocked','clarify'].includes(c.stage);
const revision='<span class="version">V'+c.rev+'</span>';
let head='<div class="section-head"><h2>'+I(v.question?'ask':'file',16)+(v.question?'Clarifying question':'Proposed copy')+(!v.question&&v.candidate?revision:'')+'</h2><span class="subtext">'+(v.question?'Needs an answer':delivered?'Submitted version':'Simulated AI draft')+'</span></div>';
if(c.stage==='clarify'&&v.question){
  let form;
  if(!tour){
    form='<form id="answerform"><div class="opts">'+v.question.options.map(o=>'<button type="button" data-answer="'+esc(o)+'">'+esc(o)+'</button>').join('')+'</div><label class="sr" for="answer">Your answer</label><div class="input-actions"><input id="answer" placeholder="Enter your answer" maxlength="500"><button class="control primary">Submit answer</button></div></form>';
  }else if(v.question.type==='wording-retry'){
    form='<form id="touranswerform"><div class="opts">'+v.question.options.map(o=>'<button type="button" data-tour-opt="'+esc(o)+'">'+esc(o)+'</button>').join('')+'</div><label class="sr" for="tourans">Your answer</label><div class="input-actions"><input id="tourans" required maxlength="500" placeholder="Enter a label for this walkthrough"><button class="control primary">Use answer</button></div></form>';
  }else if(v.question.type==='hesitation'){
    const sampled=tour.frames[tour.index+1]?.case.answerSimulated;
    const note=tour.playing?(sampled?'Autoplay will use the first sample answer.':'Autoplay will replay your chosen answer.'):(sampled?'Resume to watch the sample.':'Resume to replay your chosen answer.');
    form=answerFields(v.question)+'<span class="question-note">'+note+'</span>';
  }else{
    form='<span class="question-note">This walkthrough uses a sample answer.</span>'+(tour.type==='mine'?btn('tour-answer','Try a different answer','edit','answer-demo'):'');
  }
  return '<div class="question-pane">'+form+'</div>';
}
if(v.kind==='hesitation'&&v.manual&&v.blocked){
  return '<div class="section-head"><h2>'+I('people',16)+'Team investigation</h2><span class="subtext">Needs team input</span></div><p class="empty-copy">'+esc(v.reason)+'</p>';
}
if(v.question)return head+'<div class="question-pane"><p>'+esc(v.question.text)+'</p><span class="question-note">After submission, the requester answers this question.</span></div>';
if(!v.candidate){if(!tour&&c.candidateOverride!==null&&c.candidateOverride!==undefined&&c.stage==='blocked')head=head.replace('</div>',btn('edit-proof','Edit draft','edit','plainbtn')+'</div>');return head+'<p class="empty-copy">'+esc(v.reason||'Enter feedback to see a draft or a clarifying question.')+'</p>';}
const isButton=v.kind==='button';
if(!tour&&['processing','blocked'].includes(c.stage)&&!v.manual) head=head.replace('</div>',btn('edit-proof','Edit draft','edit','plainbtn')+'</div>');
if(v.proposal){
  head=head.replace('Proposed copy','Team proposal');
  return head+proposalHTML(v)+(v.blocked&&v.reason?'<p class="empty-copy">'+esc(v.reason)+'</p>':'');
}
return head+'<div class="proof '+(isButton?'proof-button':'')+'"><div class="proof-label">'+(isButton?'Homepage · Quote button':'Homepage · Quote instructions')+'</div><div class="candidate-text '+(isButton?'button-proof':'')+'" lang="en">'+(isButton?'<span>'+esc(v.candidate)+'</span>'+I('send',15):candidateLines(v))+'</div></div>';
}
function alternateAnswer(c,v){
  const explore=tour&&['create','mine','customer'].includes(tour.type)&&c.answer&&v.kind==='hesitation';
  return explore?btn('tour-answer','Try another answer','branch','swap-answer'):'';
}
function related(c,v){
  const concern=v.kind==='hesitation'&&c.answer;
  if(!concern&&!c.adjustment)return '';
  return '<div class="thread-notes">'+(concern?'<div>'+I('ask',14)+'<span>Requester’s concern</span><strong>'+esc(c.answer)+(c.answerSimulated?' (sample answer)':'')+'</strong></div>'+alternateAnswer(c,v):'')+
    (c.adjustment?'<div>'+I('branch',14)+'<span>Requested changes to V'+(c.rev-1)+'</span><strong>'+esc(c.adjustment)+'</strong></div>':'')+'</div>';
}
function actions(c,v){
if(tour?.frames[tour.index]?.handoff&&tour.index===tour.frames.length-1)return btn('exit','Finish walkthrough','check','outline');
if(tour)return v.kind==='hesitation'&&c.answer&&!tour.playing&&tour.index<tour.frames.length-1?btn('toggle','Continue walkthrough','play','outline'):'';let id,label,ico,extra='';
switch(c.stage){
case 'draft':id='submit';label='Submit feedback';ico='send';extra=c.text.trim()?'':'disabled';break;
case 'processing':id='deliver';label='Send V'+c.rev+' for review';ico='send';extra=v.blocked?'disabled':'';break;
case 'blocked':
  if(c.versions.length)return btn('revise-note','Revise request','edit','outline');
  if(v.manual&&!c.versions.length)return btn('refine','Refine the feedback','edit','outline');
  return '';
case 'review':return btn('adjust','Request changes','branch','outline')+btn('accept','Accept V'+c.rev,'check','primary');
case 'release':id='authorize';label='Authorize release';ico='verify';break;
case 'authorized':id='publish';label='Simulate release';ico='release';break;
default:return '';}
return btn(id,label,ico,c.stage==='draft'?'outline':'primary',extra);
}
function footer(c,v){
  const buttons=actions(c,v);
  return buttons?'<div class="action-strip"><div class="action-btns" id="actions">'+buttons+'</div></div>':'';
}
function transport(){
  if(!tour)return '';
  const last=tour.index===tour.frames.length-1;
  const waiting=last&&E.derive(here()).question?.type==='wording-retry';
  const playback=waiting?'Waiting for your answer':tour.playing?'Playing':last?(tour.frames[tour.index].handoff&&here().stage!=='published'?'Handoff complete':'Finished'):'Paused';
  const name=tour.type==='create'?'The “Create” walkthrough':tour.type==='mine'?'Your feedback walkthrough':
    P.list.find(item=>item.id===tour.type).label+' walkthrough';
  const previous=tour.index?iconbtn('walkback','back','Previous step'):'<span class="disabled-icon">'+I('back')+'</span>';
  const toggle=iconbtn('toggle',tour.playing?'pause':last?'replay':'play',tour.playing?'Pause':last?'Replay':'Resume');
  const next=last?'<span class="disabled-icon">'+I('next')+'</span>':iconbtn('walknext','next','Next step');
  const frame=tour.frames[tour.index];
  return '<div class="transport" role="group" aria-label="Walkthrough player"><span class="trackmark">'+I('play',14)+'</span>'+
    '<div class="tracktitle"><b>'+esc(name)+'</b><span>'+playback+'</span><span class="sr">'+
    'Frame '+(tour.index+1)+' of '+tour.frames.length+' · '+esc(frame.title)+'</span></div>'+
    '<div class="playtools">'+previous+toggle+next+'</div></div>';
}

const phases=['Request','Proposal','Review','Release'];
const phaseByStage={draft:0,clarify:0,processing:1,blocked:1,review:2,release:3,authorized:3,published:3};
const usesChecks=c=>['draft','processing','blocked','review'].includes(c.stage);

function progressRow(c){
  return '<ol class="flow-progress" aria-label="Feedback progress">'+phases.map((phase,i)=>{
    const state=c.stage==='published'||i<phaseByStage[c.stage]?'done':i===phaseByStage[c.stage]?'current':'upcoming';
    const reason=state==='current'&&c.stage==='clarify'?'Needs clarification':state==='current'&&c.stage==='blocked'?'Needs team input':state;
    return '<li data-phase="'+state+'"'+(state==='current'?' aria-current="step"':'')+'><span class="phase-index" aria-hidden="true">'+(state==='done'?I('check',12):i+1)+'</span><span class="phase-label">'+phase+'</span><span class="sr">: '+reason+'</span></li>';
  }).join('')+'</ol>';
}
function contextPanel(c,v){
  const sourceHeader='<div class="side-head"><h3>Original feedback</h3></div>';
  let source;
  if(c.stage==='draft'){
    source='<p class="context-note">You can edit the current request in the main workspace.</p>';
  }else if(!tour&&!c.versions.length){
    source='<label class="sr" for="source">Original feedback</label><textarea id="source" rows="3" maxlength="2000">'+esc(c.text)+'</textarea>';
  }else{
    source='<p class="context-source">'+esc(c.text||'No feedback yet')+'</p>';
  }
  const answer=c.answer?'<section class="history-copy"><h3>Requester’s answer</h3><p>'+esc(c.answer)+(c.answerSimulated?' (sample answer)':'')+'</p>'+
    (c.stage==='published'?alternateAnswer(c,v):'')+'</section>':'';
  const request=c.adjustment?'<section class="history-copy"><h3>Requested changes</h3><p>'+esc(c.adjustment)+'</p></section>':'';
  const versions=c.versions.length
    ? '<div class="version-list">'+[...c.versions].reverse().map(version=>{
        const preview=version.candidate.length>150?version.candidate.slice(0,147)+'…':version.candidate;
        return '<button data-go="ver:'+version.rev+'"><span><b>V'+version.rev+'</b><small>Submitted proposal</small></span>'+
          I('external',13)+'<p>'+esc(preview)+'</p></button>';
      }).join('')+'</div>'
    : '<p class="context-note">No versions have been submitted yet.</p>';
  const release=c.stage==='published'?'<section class="context-release"><h3>Release record</h3>'+receiptFacts(c)+'</section>':'';
  return '<div class="context-panel">'+release+'<section class="history-copy context-original">'+sourceHeader+source+'</section>'+
    answer+request+'<section class="history-copy"><h3>Version history</h3>'+versions+'</section></div>';
}
function stageCopy(c,v){
  const handoff=tour?.frames[tour.index]?.handoff;
  if(handoff&&tour.index===tour.frames.length-1)return ['Handoff',handoff.title,handoff.description];
  const rev='V'+c.rev;
  switch(c.stage){
    case 'draft':return ['Draft','Describe the change','Tell the team what was confusing or what you want to improve.'];
    case 'clarify':return ['Needs your input',v.question?.text||'Clarify your feedback',v.question?.type==='hesitation'?'Describe what gave you pause. The team will propose the wording.':v.question?.type==='wording-retry'?v.question.reason:'Answer this question so the website team can prepare a proposal.'];
    case 'processing':return ['In progress',c.rev>1?'Prepare the revised proposal':'Prepare the proposal','Check '+rev+' against the feedback, then send it to the reviewer.'];
    case 'blocked':return ['Needs team input','Resolve the open issue',v.manual?'The website team needs to clarify the request before it can go to review.':'Update the draft to meet the outstanding requirements before sending it for review.'];
    case 'review':return ['Ready for review','Review '+rev,'Accept this version or send it back to the website team with a change request.'];
    case 'release':return ['Awaiting authorization','Authorize the release','The reviewer accepted this version. The site owner decides whether it can be released.'];
    case 'authorized':return ['Authorized','Run the simulated release','The site owner authorized this version. The website team can now run the simulation.'];
  }
}
function receiptFacts(c){
  const target=c.receipt?.target||c.authorization?.target||'WinQuote homepage';
  const entries=[['Target',target],['Accepted by',c.accepted?c.accepted.actor+' · V'+c.accepted.rev:'Not recorded']];
  if(c.authorization)entries.push(['Authorized by',c.authorization.actor+' · V'+c.authorization.rev]);
  const saved=c.versions.find(x=>x.rev===(c.receipt?.rev??c.accepted?.rev??c.rev));
  let copy='';
  if(saved){
    const labels=saved.view?.proposal?.items?.map(item=>item.label);
    if(labels?.length)entries.unshift([labels.length===1?'Button label':'Button labels',labels.join(' / ')]);
    else if(saved.view?.kind==='button'&&saved.candidate.length<=100)entries.unshift(['Button label',saved.candidate]);
    else copy='<div><dt>Approved copy</dt><dd>'+btn('ver:'+saved.rev,'View V'+saved.rev+' copy','file','plainbtn')+'</dd></div>';
  }
  return '<dl class="receipt-facts">'+copy+entries.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>';
}
function candidateSection(c,v){
  return '<section class="candidate-block" id="candidate">'+candidateHTML(c,v)+'</section>';
}
function stageTask(c,v){
  const [label,title,lead]=stageCopy(c,v);
  const prefix=avatar(c.owner,18)+'<span class="person-prop">'+esc(role(c.owner)[2])+'</span><span aria-hidden="true">·</span>';
  let body='';
  if(c.stage==='draft')body=sourceArea(c)+footer(c,v)+candidateSection(c,v);
  else if(c.stage==='clarify')body=candidateSection(c,v);
  else if(usesChecks(c))body=related(c,v)+candidateSection(c,v)+footer(c,v);
  else body=receiptFacts(c)+footer(c,v)+
    (alternateAnswer(c,v)?'<div class="thread-notes">'+alternateAnswer(c,v)+'</div>':'');

  return '<section class="stage-task" data-stage="'+esc(c.stage)+'" aria-labelledby="task-title"><div class="stage-eyebrow">'+prefix+esc(label)+'</div><h2 class="stage-title" id="task-title">'+esc(title)+'</h2><p class="stage-lead">'+esc(lead)+'</p>'+body+'</section>';
}
function completion(c){
  const version=c.receipt?.rev??c.rev;
  const back=tour?btn('exit','Finish walkthrough','check','record-back'):
    btn('filter:all','Back to inbox','back','record-back');
  return '<section class="stage-task completion-result" data-stage="published" aria-labelledby="task-title">'+
    '<span class="receipt-mark" aria-hidden="true">'+I('check',17)+'</span>'+
    '<h1 class="stage-title" id="task-title">Release simulated</h1>'+
    '<p class="completion-context">'+esc(label(c))+' · V'+version+'</p>'+back+'</section>';
}
function doc(c,v){
  const complete=c.stage==='published';
  const content=complete?completion(c):
    '<header class="record-header"><div class="record-context">'+fileTag()+'<span>WinQuote</span><span aria-hidden="true">/</span><span>Feedback</span></div><h1 id="title">'+esc(label(c))+'</h1></header>'+
    progressRow(c)+stageTask(c,v);
  return '<div class="doc" id="doc"><div class="docbody flow-record">'+content+
    '<button id="mobaside" class="mobile-insight" data-go="mobileaside" aria-label="Open feedback details"></button></div></div>';
}
function evidenceList(v){
if(v.question)return '<div class="pending-proof">'+I('ask',19)+'<b>One question to resolve</b><p>Once the requester answers, the draft and its acceptance checks will appear here.</p></div>';
if(!v.checks.length)return '<div class="pending-proof">'+I('rulers',19)+'<b>Waiting for feedback</b><p>Checks will appear here once you describe the change.</p></div>';
return '<div class="checklist">'+v.checks.map((ck,i)=>{
const metric=ck.id==='word-limit'&&v.limit!==null;
const q=metric?'Word count':ck.label;
let n=ck.value;
if(v.proposal&&ck.id==='hesitation-review'){
  n=v.proposal.branch==='sending'
    ? 'Can the requester tell that opening the configurator does not send a quote?'
    : 'Can the requester choose the right starting point for a standard job and a custom job?';
}
return '<div class="checkrow '+ck.status+'"><button class="checktoggle" data-go="evidence:'+i+'" aria-expanded="'+(activeSource===i)+'"><span class="checkico">'+I(ck.status==='pass'?'check':ck.status==='fail'?'hold':'customer',12)+'</span><div class="checkbody"><b>'+esc(q)+'</b>'+(metric?'<span class="measure"><strong>'+v.wordCount+'</strong> / '+v.limit+' words</span>':'<span>'+(ck.status==='manual'?'<em class="manual-badge">Manual review</em>': '')+esc(n)+'</span>')+'</div><span class="chev">'+I('down',13)+'</span></button>'+(metric&&ck.status==='fail'?'<div class="shortfall">'+(v.wordCount-v.limit)+' words over the limit</div>':'')+(activeSource===i?'<div class="evidence-source"><b>'+esc(ck.sourceLabel||'Source')+'</b><p>'+esc(ck.source)+'</p></div>':'')+'</div>';}).join('')+'</div>';
}
function activity(c){
  const rows=[...c.trail].reverse();
  const list=rows.length?'<ol class="activities">'+rows.map(event=>{
    const date=new Date(event.at);
    const time=Number.isFinite(date.getTime())
      ? '<time datetime="'+esc(event.at)+'">'+esc(date.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))+'</time>':'';
    return '<li>'+avatar(event.actor)+'<div><b>'+esc(event.actor)+'</b>'+time+'<p>'+esc(event.text)+'</p></div></li>';
  }).join('')+'</ol>'
    : '<p class="context-note">Submissions, handoffs and review decisions will appear here.</p>';
  return '<div class="ins-section"><div class="side-head"><h2>Activity</h2><span class="sidecount">'+rows.length+'</span></div>'+list+'</div>';
}
function checkSummary(checks){
  const automatic=checks.filter(check=>check.status!=='manual');
  const manual=checks.length-automatic.length;
  const passed=automatic.filter(check=>check.status==='pass').length;
  const autoText=automatic.length?passed+'/'+automatic.length+' auto '+(automatic.length===1?'check':'checks')+' passed':'';
  return {autoText,manualText:manual?manual+' manual':'',hasFailed:automatic.some(check=>check.status==='fail')};
}
function mobileSummary(v){
  const {hasFailed}=checkSummary(v.checks);
  let detail='History & activity';
  if(usesChecks(here())&&v.limit!==null)detail=hasFailed?(v.wordCount-v.limit)+' words over':v.wordCount+' / '+v.limit+' words';
  return '<div class="ms-left">'+I('sidebar',15)+'<span>Feedback details</span></div><span class="ms-num">'+esc(detail)+I('next',12)+'</span>';
}
function inspectorContent(c,v){
  if(tab==='activity')return activity(c);
  if(tab==='context')return contextPanel(c,v);
  const {autoText,manualText}=checkSummary(v.checks);
  const title=v.question?'Awaiting clarification':(autoText||'Acceptance criteria');
  return '<div class="ins-section evidence"><div class="side-head"><h2>'+esc(title)+'</h2>'+
    '<span class="ai-label">'+(manualText||I('rulers',13)+'Live checks')+'</span></div>'+evidenceList(v)+'</div>';
}
function updateAside(c,v){const inner=$('sideinner');if(!inner)return;inner.innerHTML=inspectorContent(c,v);const b=$('mobaside');if(b){b.innerHTML=mobileSummary(v);b.classList.toggle('warn',v.checks.some(x=>x.status==='fail'));}}
function caseMain(){
  const c=here(),v=E.derive(c),checks=usesChecks(c);
  if(panelStage!==c.stage){
    tab=checks?'checks':'context';
    panelStage=c.stage;
  }
  if(!checks&&tab==='checks')tab='context';
  const tabs=(checks?btn('tab:checks','Checks','rulers','tab '+(tab==='checks'?'active':'')):'')+
    btn('tab:context','Details','source','tab '+(tab==='context'?'active':''))+
    btn('tab:activity','Activity','history','tab '+(tab==='activity'?'active':''));
  const inspector='<aside class="inspector '+(asideOpen?'aside-open':'')+'" id="inspector" aria-label="Feedback details">'+
    '<div class="tabs" role="group" aria-label="Feedback details views">'+tabs+
    '<button class="mobile-close iconbtn" data-go="mobileaside" aria-label="Close details">'+I('cross')+'</button></div>'+
    '<div id="sideinner"></div></aside>';
  $('main').innerHTML=transport()+'<div class="workspace">'+doc(c,v)+inspector+'</div>';
  if($('quick'))$('quick').innerHTML=quick(v);
  updateAside(c,v);
  if(priorOwner&&priorOwner!==c.owner)document.querySelector('.stage-eyebrow>.avatar')?.classList.add('handed');
  priorOwner=c.owner;
}
function inbox(){
const rows=data.items.filter(x=>matches(x.c,filter)&&(!search.trim()||(x.id+label(x.c)+x.c.text).toLowerCase().includes(search.trim().toLowerCase())));
const nm=navRows.find(x=>x[0]===filter)?.[2]||'Feedback inbox';
$('main').innerHTML='<div class="listpage"><div class="listhead"><div><h1>'+esc(nm)+'</h1><p>WinQuote <span>/</span> '+rows.length+' '+(rows.length===1?'feedback item':'feedback items')+'</p></div>'+btn('new','New feedback','plus','primary')+'</div><div class="listtools"><span>'+I('feedback')+'Feedback</span><label>'+I('search',15)+'<input id="searchbox" aria-label="Search feedback" placeholder="Search feedback…" value="'+esc(search)+'"></label></div><div class="listrows">'+(rows.length?rows.map(x=>'<button class="listitem" data-go="case:'+x.id+'"><span class="list-id">'+esc(x.id)+'</span><div><strong>'+esc(label(x.c))+'</strong><span>'+esc(x.c.text||'Empty draft')+'</span></div>'+badge(x.c)+I('next',15)+'</button>').join(''):'<div class="listempty">'+I('inbox',24)+'<p>No feedback here yet.</p>'+btn('filter:all','Back to inbox','','outline')+'</div>')+'</div></div>';
}
function render(){renderNav();renderBar();page==='case'?caseMain():inbox();}
function refreshDlgProof(){
const f=$('candidateedit');if(!f)return;const c=E.editCandidate(here(),f.value),v=E.derive(c),q=$('edit-status');
q.textContent=v.blocked?v.reason:(v.limit!==null?v.wordCount+' / '+v.limit+' words · ':'')+'Ready for team review.';
q.classList.toggle('warn',v.blocked);}
function dialog(body,title){$('dialog-body').innerHTML='<div class="dlghead"><h2>'+esc(title)+'</h2>'+iconbtn('close','cross','Close')+'</div>'+body;$('dialog').setAttribute('aria-label',title);if(!$('dialog').open)$('dialog').showModal();}
function close(){if($('dialog').open)$('dialog').close();}
function stop(){clearTimeout(timer);timer=null;}
function setPlay(on){
  if(!tour)return;
  tour.playing=on;stop();
  if(on){
    const choosing=here().stage==='clarify'&&E.derive(here()).question?.type==='hesitation';
    timer=setTimeout(auto,choosing?14000:4000);
  }
  saveTour();
}
function auto(){if(!tour?.playing)return;if(tour.index>=tour.frames.length-1){setPlay(false);render();return;}tour.index++;if(tour.index>=tour.frames.length-1)setPlay(false);else setPlay(true);saveTour();render();announce(tour.frames[tour.index].title);}
function endTour(restore=false){
  stop();
  const wasCreate=tour?.type==='create';
  if(wasCreate){try{sessionStorage.removeItem(createViewKey);}catch{}}
  tour=wasCreate&&restore?savedTour(viewKey):null;
  saveTour();tab='checks';activeSource=-1;asideOpen=false;
}
function appendSteps(frames,c){
  for(let i=0;i<15;i++){
    const next=E.step(c);if(c===next)break;
    c=next;frames.push({case:c,title:c.trail.at(-1)?.text||stages[c.stage]});
  }
  return frames;
}
function begin(type){
  if(type==='mine'&&!selected().c.text.trim())return;
  // The sample has its own transport and session. Exiting returns to the same work.
  if(type==='create'){stop();tab='checks';activeSource=-1;asideOpen=false;}
  else endTour();
  close();page='case';filter='all';
  let frames=[];
  if(type==='create'){
    const c=E.transition(E.createCase(E.hesitationFeedback),'submit');
    frames=appendSteps([{case:c,title:'Ask why the requester hesitated'}],c);
  }else if(type==='mine'){
    const c=clone(selected().c);
    frames=appendSteps([{case:c,title:'Read the feedback'}],c);
  }else{
    frames=P.frames(type,roleAnswer);
  }
  tour={record:data.current,type,frames,index:0,playing:false,
    ...(P.list.some(role=>role.id===type)?{roleStoryVersion,scenarioAnswer:roleAnswer}:{})};
  setPlay(frames.length>1);render();announce('Walkthrough started.');
}
function clarificationPrefix(){
  if(!tour||!['mine','create','customer'].includes(tour.type))return null;
  const index=tour.frames.slice(0,tour.index+1).findLastIndex(f=>f.case.stage==='clarify');
  if(index!==-1)return tour.frames.slice(0,index+1);
  // A personal walkthrough may start from an already answered, versioned record.
  const c=E.transition(E.createCase(here().text),'submit');
  return c.stage==='clarify'&&E.derive(c).question?.type==='hesitation'?[{case:c,title:'Ask why the requester hesitated'}]:null;
}
function answerTour(value){
  const raw=value.trim(),head=raw&&clarificationPrefix();if(!head)return;
  const before=head.at(-1).case,c=E.transition(before,'answer',raw);
  if(c===before)return;
  const choseConcern=E.derive(before).question.type==='hesitation';
  if(tour.type==='customer'){
    roleAnswer=raw;
    try{sessionStorage.setItem(roleAnswerKey,raw);}catch{}
    tour.frames=P.frames('customer',raw);
    tour.index=Math.max(0,tour.frames.findIndex(frame=>frame.case.answer===raw));
    tour.scenarioAnswer=raw;
    tour.roleStoryVersion=roleStoryVersion;
  }else{
    const index=head.length;
    head.push({case:c,title:choseConcern?(c.stage==='blocked'?'Website team investigates the concern':'Website team proposes new copy'):'Your walkthrough answer: '+raw});
    tour.frames=appendSteps(head,c);tour.index=index;
  }
  close();activeSource=-1;tab='checks';asideOpen=false;
  setPlay(!choseConcern&&tour.index<tour.frames.length-1);render();
  if(choseConcern){
    const target=$('candidate'),heading=target.querySelector('h2');
    target.classList.add('reconsidered');heading.tabIndex=-1;heading.focus({preventScroll:true});
    if(heading.getBoundingClientRect().top>=window.innerHeight)heading.scrollIntoView({block:'center'});
  }
  announce(c.stage==='clarify'?'Your answer is saved. The requester still needs to clarify the wording.':c.stage==='blocked'?'The website team needs to investigate this answer.':'The draft and checks now reflect your answer.');
}
function selectCase(id){endTour();if(!data.items.some(x=>x.id===id))return;data.current=id;save();page='case';filter='all';tab='checks';activeSource=-1;render();}
function newItem(text=''){endTour();const id='WQ-'+String(++data.serial).padStart(3,'0');data.items.unshift({id,c:E.createCase(text)});selectCase(id);if(!text)$('source')?.focus();}
function apply(action,val){
if(tour)return;const item=selected();const next=E.transition(item.c,action,val);
if(next===item.c){announce('This action is unavailable at the current stage.');return;}item.c=next;save();activeSource=-1;close();render();announce(next.trail.at(-1)?.text||stages[next.stage]);}
function syncSource(text){
  const item=selected(),c=item.c;if(tour||c.versions.length)return;
  const prior=E.derive(c),n=E.editSource(c,text),v=E.derive(n);item.c=n;save();
  if(c.stage!==n.stage||c.stage!=='draft'){
    const field=$('source'),wasFocused=document.activeElement===field;
    const selection=wasFocused?[field.selectionStart,field.selectionEnd,field.selectionDirection]:null;
    renderNav();caseMain();
    if(wasFocused&&n.stage!=='draft'&&tab!=='context'){
      tab='context';caseMain();
    }
    if(wasFocused&&n.stage==='draft'){
      asideOpen=false;$('inspector')?.classList.remove('aside-open');
    }
    if(selection&&$('source')){
      $('source').focus({preventScroll:true});$('source').setSelectionRange(...selection);
    }
  }else{
    const block=$('candidate');if(block)block.innerHTML=candidateHTML(n,v);
    $('title').textContent=label(n);
    const [,title,lead]=stageCopy(n,v);
    $('task-title').textContent=title;
    document.querySelector('.stage-lead').textContent=lead;
    if($('quick'))$('quick').innerHTML=quick(v);
    if(usesChecks(n))updateAside(n,v);
    const foot=document.querySelector('.action-strip');
    if(foot)foot.outerHTML=footer(n,v);
  }
  const w=document.querySelector('[data-go="walk"]');if(w)w.disabled=!text.trim();
  if(prior.candidate!==v.candidate||prior.limit!==v.limit){
    const oldFrags=fragCandidate(prior.candidate);
    document.querySelectorAll('[data-frag]').forEach(el=>{if(!oldFrags.includes(el.textContent))el.classList.add('pulse');});
    if(v.kind==='button')document.querySelector('.button-proof')?.classList.add('pulse');
    document.querySelectorAll('.checkrow').forEach((row,i)=>{if(v.checks[i]?.value!==prior.checks[i]?.value||v.checks[i]?.label!==prior.checks[i]?.label)row.classList.add('pulse');});
  }
}
function exampleMenu(){dialog('<div class="dlgrows">'+examples.map(([t,s],i)=>'<button data-go="sample:'+i+'">'+I(i===0?'file':i===1?'edit':i===2?'ask':'hold')+'<span><b>'+esc(t)+'</b><small>'+esc(s)+'</small></span>'+I('next',14)+'</button>').join('')+'</div>','Choose a feedback example');}
function personaMenu(){
  const roles=['Requester','Website team','Site owner'];
  const options=P.list.map((role,index)=>
    '<button data-go="persona:'+role.id+'">'+avatar(roles[index])+'<span><b>'+esc(role.label)+'</b><small>'+
    esc(role.description)+'</small></span>'+I('play',15)+'</button>').join('');
  dialog('<p class="dlgdesc">Follow the same feedback from your role. Sample actions play automatically, and each route stops at its handoff.</p>'+
    '<div class="dlgrows">'+options+'</div>','Choose your role');
}

function doAction(g){
const [k,arg]=g.split(':');if(!['nav','mobileaside'].includes(k)){navOpen=false;$('nav').classList.remove('show');$('shade').hidden=true;}
if(tour?.playing&&['tab','evidence','mobileaside','location','ver','refine'].includes(k)){setPlay(false);render();}
switch(k){
case 'close':close();return;
case 'nav':navOpen=!navOpen;renderNav();return;
case 'mobileaside':asideOpen=!asideOpen;$('inspector')?.classList.toggle('aside-open',asideOpen);(asideOpen?document.querySelector('.mobile-close'):$('mobaside'))?.focus({preventScroll:true});return;
case 'project':case 'filter':endTour();filter=k==='project'?'all':arg;page='list';search='';render();return;
case 'find':endTour();filter='all';search='';page='list';render();$('searchbox').focus();return;
case 'new':newItem();return;case 'case':selectCase(arg);return;case 'walk':begin('mine');return;case 'personas':personaMenu();return;case 'persona':begin(arg);return;
case 'create-tour':begin('create');return;
case 'exit':endTour(true);render();return;
case 'walkback':case 'walknext':if(!tour)return;setPlay(false);tour.index=Math.max(0,Math.min(tour.frames.length-1,tour.index+(k==='walkback'?-1:1)));saveTour();render();return;
case 'tour-answer':{
  const head=clarificationPrefix();if(!head)return;
  const q=E.derive(head.at(-1).case).question;
  setPlay(false);render();
  if(q.type==='hesitation'){
    dialog('<p class="answer-prompt">'+esc(q.text)+'</p>'+answerFields(q)+'<p class="dlgdesc">A new answer replays the team’s proposal in this walkthrough only.</p>','Try another answer');
    $('dialog').querySelector('[data-tour-opt]')?.focus();
  }else{
    dialog('<form id="touranswerform"><label for="tourans">'+esc(q.text)+'</label><div class="opts">'+q.options.map(o=>'<button type="button" data-tour-opt="'+esc(o)+'">'+esc(o)+'</button>').join('')+'</div><input id="tourans" required maxlength="500" placeholder="Enter an answer for this walkthrough"><div class="dlgfoot"><button class="control primary">Continue with this answer</button></div></form>','Change walkthrough answer');$('tourans').focus();
  }
  return;
}
case 'toggle':if(!tour)return;if(!tour.playing&&tour.index===tour.frames.length-1)tour.index=0;setPlay(!tour.playing&&tour.frames.length>1);render();return;
case 'tab':tab=arg;activeSource=-1;caseMain();document.querySelector('[data-go="tab:'+arg+'"]')?.focus({preventScroll:true});return;
case 'refine':
  tab='context';asideOpen=true;caseMain();
  $('source')?.focus({preventScroll:true});
  return;
case 'examples':exampleMenu();return;
case 'sample':close();if(!here().versions.length){syncSource(examples[+arg][1]);render();$('source')?.focus();}return;
case 'budget':{
  const source=$('source');if(!source)return;
  const previous=E.derive(here()).limit,at=budgetToken(source.value,previous);if(at===null)return;
  const next=previous===10?3:previous===3?18:10;
  source.value=source.value.slice(0,at)+next+source.value.slice(at+String(previous).length);
  syncSource(source.value);announce('Word limit changed to '+next+'. The draft and checks have been updated.');return;
}
case 'evidence':activeSource=activeSource===+arg?-1:+arg;updateAside(here(),E.derive(here()));document.querySelector('[data-go="evidence:'+arg+'"]')?.focus({preventScroll:true});return;
case 'location':dialog('<div class="loc-detail">'+fileTag()+'<div><b>WinQuote homepage</b><p>Quote entry · Standard and custom quotes</p></div></div><p class="dlgdesc">This feedback applies to the quote instructions on the homepage. Drafting and publishing are simulated locally.</p>','Linked page');return;
case 'ver':{const ver=here().versions.find(x=>x.rev===+arg);if(!ver)return;dialog('<p class="dlgdesc">The version sent to the reviewer.</p><p class="ver-copy" lang="en">'+esc(ver.candidate)+'</p>'+ver.checks.map(x=>'<div class="ver-check">'+I(x.status==='pass'?'checks':'customer',14)+esc(x.label)+'</div>').join(''),'Version history · V'+ver.rev);return;}
case 'adjust':dialog('<form id="adjustform"><label for="adj">What should change in the next version?</label><textarea id="adj" maxlength="1000" required placeholder="For example, keep the copy to 10 words."></textarea><div class="dlgfoot"><button type="button" class="control outline" data-go="close">Cancel</button><button class="control primary">Send request</button></div></form>','Request changes · V'+here().rev);$('adj').focus();return;
case 'revise-note':dialog('<p class="dlgdesc">'+esc(E.derive(here()).reason)+'</p><form id="revisionform"><label for="revision-note">What should this revision require?</label><textarea required maxlength="1000" id="revision-note">'+esc(here().adjustment)+'</textarea><div class="dlgfoot"><button class="control primary">Update request</button></div></form>','Revise V'+here().rev+' requirements');return;
case 'edit-proof':{const v=E.derive(here());dialog('<form id="proofeditform"><label for="candidateedit">Proposed copy · V'+here().rev+'</label><textarea id="candidateedit" maxlength="2000">'+esc(v.candidate)+'</textarea><p id="edit-status" class="dlgdesc" aria-live="polite"></p><div class="dlgfoot">'+btn('restore-proof','Restore AI draft','replay','plainbtn')+'<button class="control primary">Save draft</button></div></form>','Edit proposed copy');refreshDlgProof();return;}
case 'restore-proof':{const f=$('candidateedit');if(f){f.value=E.derive(E.editCandidate(here(),null)).candidate;refreshDlgProof();}return;}
case 'fork':{const text=here().text;close();newItem(text);return;}
case 'submit':case 'deliver':case 'accept':case 'authorize':case 'publish':apply(k);return;
}}
document.addEventListener('click',ev=>{const target=ev.target.closest('[data-go]');if(target){doAction(target.dataset.go);return;}const opt=ev.target.closest('[data-tour-opt]');if(opt){answerTour(opt.dataset.tourOpt);return;}const ans=ev.target.closest('[data-answer]');if(ans){apply('answer',ans.dataset.answer);return;}if(ev.target===$('shade')){navOpen=false;renderNav();}if(ev.target===$('dialog'))close();});
document.addEventListener('focusin',ev=>{
  if(!tour?.playing||!ev.target.closest('#touranswerform'))return;
  setPlay(false);
  const transportNode=document.querySelector('.transport');
  if(transportNode)transportNode.outerHTML=transport();
  const note=document.querySelector('.question-pane .question-note');
  if(note)note.textContent='Paused while you answer. Resume to keep watching.';
});
document.addEventListener('input',ev=>{if(ev.target.id==='source')syncSource(ev.target.value);if(ev.target.id==='candidateedit')refreshDlgProof();if(ev.target.id==='searchbox'){search=ev.target.value;inbox();const s=$('searchbox');s.focus();s.setSelectionRange(search.length,search.length);}});
document.addEventListener('submit',ev=>{if(ev.target.id==='touranswerform'){ev.preventDefault();answerTour($('tourans').value);return;}if(ev.target.id==='proofeditform'||ev.target.id==='revisionform'){ev.preventDefault();if(!tour){selected().c=ev.target.id==='proofeditform'?E.editCandidate(here(),$('candidateedit').value):E.reviseAdjustment(here(),$('revision-note').value);save();close();render();}return;}if(ev.target.id==='answerform'){ev.preventDefault();const val=$('answer').value.trim();if(val)apply('answer',val);else $('answer').focus();}if(ev.target.id==='adjustform'){ev.preventDefault();const s=$('adj').value.trim();if(s)apply('adjust',s);}});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){if($('dialog').open)return;if(navOpen){navOpen=false;renderNav();}else if(asideOpen){asideOpen=false;caseMain();}else if(tour){endTour(true);render();}}if(ev.code==='Space'&&tour&&!['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName)&&!$('dialog').open){ev.preventDefault();doAction('toggle');}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&tour?.playing){setPlay(false);render();}});
const launchURL=new URL(location.href);
const requestedWalkthrough=launchURL.searchParams.get('walkthrough');
if(requestedWalkthrough==='create'||P.list.some(role=>role.id===requestedWalkthrough)){
  launchURL.searchParams.delete('walkthrough');
  history.replaceState(history.state,'',launchURL.href);
  if(tour?.type===requestedWalkthrough)render();else begin(requestedWalkthrough);
}else render();
})();
