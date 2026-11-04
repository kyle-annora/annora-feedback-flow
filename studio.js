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
const dockKey='feedbackflow:walkthrough-resume:v1';
const teamPracticeKey='feedbackflow:website-team-practice:v1';
const roleAnswerKey='feedbackflow:role-answer:v2';
const roleStoryVersion=3;
const practiceKey='feedbackflow:requester-practice:v3';
let practice=null;
try {
  const saved=JSON.parse(sessionStorage.getItem(practiceKey));
  const frame=saved?.frames?.[saved.frontier];
  if(frame?.case&&(frame.personaId==='customer'||(frame.personaId==='publisher'&&frame.case.accepted)))practice=saved;
}catch{}
function writePractice(){
  try{if(practice)sessionStorage.setItem(practiceKey,JSON.stringify(practice));else sessionStorage.removeItem(practiceKey);}catch{}
}
function isPractice(){return tour?.type==='customer'&&tour.inputMode==='practice';}
function isTeamPractice(current=tour){return current?.type==='team'&&current.inputMode==='practice';}
function isHandsOn(current=tour){return current?.inputMode==='practice'&&['customer','team'].includes(current.type);}
function inOwnerView(current=tour){return isHandsOn(current)&&teamPerspective(current)==='publisher';}
function teamPerspective(current=tour){return current.frames[current.index].personaId;}
function practiceFrontier(){return isTeamPractice()?tour.frames.length-1:practice?.frontier;}
function inPracticeHistory(){return (isTeamPractice()||isPractice())&&tour.index<practiceFrontier();}
function decisionPoint(){return isTeamPractice()||inOwnerView()||(isPractice()&&['draft','clarify','review'].includes(here().stage));}
function rememberPractice(reset=false,current=tour){
  if(current?.type!=='customer'||current.inputMode!=='practice')return;
  const frontier=reset?current.index:Math.max(current.index,Math.min(practice?.frontier??0,current.frames.length-1));
  practice={frames:current.frames,index:frontier,frontier,answer:current.scenarioAnswer};
  writePractice();
}
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
    const durable=storageKey===dockKey;
    const stored=(durable?localStorage:sessionStorage).getItem(storageKey)||
      (storageKey===teamPracticeKey?localStorage.getItem(teamPracticeKey):null);
    const cached=JSON.parse(stored);
    if(cached?.frames?.[cached.index]?.case&&data.items.some(item=>item.id===cached.record)){
      const validated=cached.type==='create'?cached:window.CaseUpgrade.walkthrough(cached);
      // A new tab starts in the workspace. Its saved walkthrough stays one click away.
      if(durable)validated.minimized=true;
      if(isTeamPractice(validated)){
        if(!validated.frames.every(f=>f.case&&f.items?.length===2))return null;
        return {...validated,index:validated.frames.length-1,playing:false};
      }
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
      // Older sessions sometimes saved the displayed history frame as the resume point.
      if(!durable&&validated.type==='customer'&&validated.inputMode==='practice'&&
        practice&&practice.answer===validated.scenarioAnswer&&practice.frontier>validated.index&&
        validated.frames[practice.frontier]?.case)return {...validated,index:practice.frontier,playing:false};
      return {...validated,playing:false};
    }
  } catch {}
  return null;
}
const previousTour=savedTour(createViewKey)||savedTour(viewKey)||savedTour(dockKey);
let tour=previousTour?.minimized?null:previousTour;
let parkedTour=previousTour?.minimized?previousTour:null;
if(previousTour&&!practice)rememberPractice(true,previousTour);
let page=parkedTour?'list':'case',filter='all',tab='checks',search='',navOpen=false,asideOpen=false,activeSource=-1,timer=null,notifyTimer=null,priorOwner=null,panelStage=null;
const selected=()=>data.items.find(x=>x.id===data.current);
const here=()=>tour?tour.frames[tour.index].case:selected().c;
const clone=x=>JSON.parse(JSON.stringify(x));
function save(){try{localStorage.setItem(key,JSON.stringify(data));}catch{}}
function saveTour(){
  const current=tour||parkedTour;
  const resumeIndex=inPracticeHistory()?practiceFrontier():current?.index;
  const snapshot=current?JSON.stringify({...current,index:resumeIndex,minimized:!tour,playing:false}):null;
  try{
    if(snapshot){
      sessionStorage.setItem(current.type==='create'?createViewKey:viewKey,snapshot);
      if(isTeamPractice(current))sessionStorage.setItem(teamPracticeKey,snapshot);
    }
    else{sessionStorage.removeItem(createViewKey);sessionStorage.removeItem(viewKey);}
  }catch{}
  try{
    if(snapshot){
      localStorage.setItem(dockKey,snapshot);
      if(isTeamPractice(current))localStorage.setItem(teamPracticeKey,snapshot);
    }else localStorage.removeItem(dockKey);
  }catch{}
}
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
  const crumb=isCase?'<span class="slash">/</span><span class="crumbid">'+esc(tour?(tour.type==='mine'?tour.record:'Sample feedback'):data.current)+'</span>':'';
  let navigation='<span class="crumbicon">'+I('inbox',15)+'</span><span>Feedback inbox</span>';
  if(isCase){
    const destination=tour?.index?'Back to the previous step: '+tour.frames[tour.index-1].title:'Back to the feedback inbox';
    navigation=btn(tour?'walkback':'filter:all',tour?'Back':'Back to inbox','back','workspace-back',
      'title="'+esc(destination)+'" aria-describedby="back-destination"')+
      '<span id="back-destination" class="sr">'+esc(destination)+'</span>';
  }
  let tool='';
  if(isCase&&tour)tool=btn('minimize-tour','Minimize walkthrough','down','subtle walk-minimize','aria-expanded="true" aria-controls="main"');
  else if(isCase&&c.stage!=='published')tool=btn('walk','Play walkthrough','play','outline',c.text.trim()?'':'disabled');
  $('topbar').innerHTML='<div class="crumb">'+iconbtn('nav','menu','Open navigation')+
    navigation+crumb+'</div><div class="tools">'+tool+'</div>';
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
function answerFields(q,draft=''){
  return '<form id="touranswerform"><div class="opts concern-options">'+q.options.map(o=>'<button type="button" data-tour-opt="'+esc(o)+'">'+esc(o)+'</button>').join('')+'</div><label for="tourans">Or describe what made you hesitate</label><div class="input-actions"><input id="tourans" required maxlength="500" placeholder="In your own words…" value="'+esc(draft)+'"><button class="control outline">Use answer</button></div></form>';
}
function reviewSource(c,v){
  const teamFirstDraft=isTeamPractice()&&c.stage==='processing'&&c.rev===1;
  if((c.stage!=='review'&&!teamFirstDraft)||!c.answer)return '';
  const snapshot=c.versions.find(version=>version.rev===c.rev);
  const answer=snapshot?.answer??c.answer;
  const sample=snapshot?.answerSimulated??c.answerSimulated;
  const change=snapshot?.adjustment??c.adjustment;
  const requesterView=tour?.type==='customer'||(isTeamPractice()&&teamPerspective()==='customer');
  const sourceLabel=sample?'Sample requester answer':requesterView?'Your answer':'Requester’s answer';
  return '<div class="proposal-source"><div class="proposal-source-head"><span>'+I('quote',13)+
    esc(sourceLabel)+'</span>'+alternateAnswer(c,v)+'</div><blockquote>'+esc(answer)+'</blockquote>'+
    (change?'<p class="proposal-change"><b>Requested change to V'+(c.rev-1)+'</b> '+esc(change)+'</p>':'')+'</div>';
}
function proposalHTML(c,v,shownRevision=c.rev){
  const p=v.proposal;
  let items=p.items;
  if(p.edited&&!items.length){
    const blocks=v.candidate.trim().split(/\n\s*\n/).map(block=>block.split(/\r?\n/).map(line=>line.trim()).filter(Boolean));
    const expectedCount=p.branch==='paths'?2:1;
    if(blocks.length===expectedCount&&blocks.every(lines=>lines.length>1&&lines[0].length<=80)){
      items=blocks.map(([label,...detail])=>({label,detail:detail.join(' ')}));
    }
  }
  const revisionQuestion=v.checks.find(check=>check.id==='revision'&&check.status==='manual');
  const reviewQuestion=revisionQuestion?.value||p.reviewQuestion;
  const source=reviewSource(c,v);
  return '<div class="proof team-proof'+(source?' review-proof':'')+'" data-proposal-branch="'+esc(p.branch)+'">'+source+
    '<div class="proposal-preview"><div class="proof-label">Proposed homepage copy · V'+shownRevision+'</div>'+
    (items.length>1?'<p class="proposal-scope">Both entry points are part of this proposal.</p>':'')+'<div class="proposal-options">'+
    (items.length?items.map(item=>'<div class="proposal-option"><span class="candidate-text button-proof">'+esc(item.label)+I('send',14)+'</span><p>'+esc(item.detail)+'</p></div>').join(''):'<p class="edited-proposal">'+esc(v.candidate)+'</p>')+'</div></div>'+
    '<div class="review-prompt"><div>'+I('verify',14)+'Review question</div><p id="review-question">'+esc(reviewQuestion)+'</p></div></div>';
}
function isEditingTeamDraft(c){
  return isTeamPractice()&&!inPracticeHistory()&&c.rev>1&&['processing','blocked'].includes(c.stage);
}
function teamEditor(c){
  const draft=teamDraftState();
  const items=draft.items.map((item,i)=>{
    const number=i+1;
    const label='team-label-'+number,detail='team-detail-'+number;
    return '<fieldset class="team-entry"><legend>'+['Standard walk-in','Custom walk-in'][i]+'</legend>'+
      '<div><label for="'+label+'">Button label</label><input data-team-field id="'+label+'" type="text" maxlength="80" required value="'+esc(item.label)+'"></div>'+
      '<div><label for="'+detail+'">Description</label><textarea data-team-field id="'+detail+'" rows="2" required>'+esc(item.detail)+'</textarea></div></fieldset>';
  }).join('');
  const changeLabel=(c.rev===2?'Simulated requester':'Requester')+' · Changes to V'+(c.rev-1);
  return '<div class="team-edit"><div class="proposal-source"><div class="proposal-source-head"><span>'+I('quote',13)+
    esc(changeLabel)+'</span></div><blockquote>'+esc(c.adjustment)+'</blockquote></div>'+
    '<div class="team-copy-fields">'+items+'</div></div>'+
    '<p class="team-edit-status" id="team-edit-status" aria-live="polite">'+esc(draft.reason||'Ready to send V'+c.rev+' for review.')+'</p>';
}
function candidateHTML(c,v){
if(isEditingTeamDraft(c))return teamEditor(c);
let delivered=Boolean(c.versions.find(a=>a.rev===c.rev))&&!['processing','blocked','clarify'].includes(c.stage);
const awaitingRevision=c.stage==='blocked'&&c.adjustment&&c.candidateOverride===null&&c.versions.length;
const teamEdited=typeof c.candidateOverride==='string';
const shownRevision=awaitingRevision?c.rev-1:c.rev;
const revision='<span class="version">V'+shownRevision+'</span>';
const heading=v.question?'Clarifying question':v.proposal?(awaitingRevision?'Previous proposal':delivered?'Team proposal':teamEdited?'Team revision':'AI draft'):'Proposed copy';
const provenance=v.question?'Needs an answer':delivered?'Submitted version':awaitingRevision?'Awaiting team revision':teamEdited?(tour&&!isTeamPractice()?'Sample team revision':'Team revision'):'Simulated AI draft';
let head='<div class="section-head"><h2>'+I(v.question?'ask':'file',16)+heading+(!v.question&&v.candidate?revision:'')+'</h2><span class="subtext">'+provenance+'</span></div>';
if(c.stage==='clarify'&&v.question){
  if(inPracticeHistory()){
    const answered=tour.frames[tour.index+1].case;
    return answered.answer?'<div class="question-pane"><span class="question-note">'+
      (answered.answerSimulated?'Example answer':'Your answer')+'</span><p>'+esc(answered.answer)+'</p></div>':'';
  }
  let form;
  if(!tour){
    form='<form id="answerform"><div class="opts">'+v.question.options.map(o=>'<button type="button" data-answer="'+esc(o)+'">'+esc(o)+'</button>').join('')+'</div><label class="sr" for="answer">Your answer</label><div class="input-actions"><input id="answer" placeholder="Enter your answer" maxlength="500"><button class="control primary">Submit answer</button></div></form>';
  }else if(v.question.type==='wording-retry'){
    form='<form id="touranswerform"><div class="opts">'+v.question.options.map(o=>'<button type="button" data-tour-opt="'+esc(o)+'">'+esc(o)+'</button>').join('')+'</div><label class="sr" for="tourans">Your answer</label><div class="input-actions"><input id="tourans" required maxlength="500" placeholder="Enter a label for this walkthrough" value="'+esc(tour.answerDraft)+'"><button class="control primary">Use answer</button></div></form>';
  }else if(v.question.type==='hesitation'){
    const note=tour.inputMode==='practice'?'Your answer will update the proposed copy and review question.':tour.playing?
      'Autoplay will use a sample answer. Choose or enter your own answer to take over.':
      'Resume to watch the sample answer, or choose your own to take over.';
    form=answerFields(v.question,tour.answerDraft)+'<span class="question-note">'+note+'</span>';
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
  const showBlockReason=v.blocked&&v.reason&&tour?.type!=='customer';
  return head+proposalHTML(c,v,shownRevision)+(showBlockReason?'<p class="empty-copy">'+esc(v.reason)+'</p>':'');
}
return head+'<div class="proof '+(isButton?'proof-button':'')+'"><div class="proof-label">Proposed homepage copy · V'+shownRevision+'</div><div class="candidate-text '+(isButton?'button-proof':'')+'" lang="en">'+(isButton?'<span>'+esc(v.candidate)+'</span>'+I('send',15):candidateLines(v))+'</div></div>';
}
function alternateAnswer(c,v){
  if(isHandsOn()&&['release','authorized','published'].includes(c.stage))return '';
  const explore=tour&&!inPracticeHistory()&&['create','mine','customer'].includes(tour.type)&&c.answer&&v.kind==='hesitation';
  return explore?btn('tour-answer','Try another answer','branch','swap-answer'):'';
}
function related(c,v){
  if(isEditingTeamDraft(c)||(isTeamPractice()&&c.stage==='processing'&&c.rev===1))return '';
  if(c.stage==='review'&&v.proposal&&c.answer)return '';
  const concern=v.kind==='hesitation'&&c.answer;
  if(!concern&&!c.adjustment)return '';
  return '<div class="thread-notes">'+(concern?'<div>'+I('ask',14)+'<span>Requester’s concern</span><strong>'+esc(c.answer)+(c.answerSimulated?' (sample answer)':'')+'</strong></div>'+alternateAnswer(c,v):'')+
    (c.adjustment?'<div>'+I('branch',14)+'<span>Requested changes to V'+(c.rev-1)+'</span><strong>'+esc(c.adjustment)+'</strong></div>':'')+'</div>';
}
function actions(c,v){
if(inPracticeHistory())return '';
if(isHandsOn()&&c.stage==='release'){
  const rev=c.accepted?.rev;
  if(rev!==c.rev||!c.versions.some(version=>version.rev===rev))return '';
  if(inOwnerView())return btn('approve-release:'+rev,'Approve simulated release of V'+rev,'verify','primary');
  if(P.canOpenOwner(tour.frames[tour.index]))return btn('view-site-owner:'+rev,'View as Site owner','flag','primary');
  return '';
}
if(isHandsOn()&&c.stage==='authorized')return '';
if(isHandsOn()&&c.stage==='published'){
  return btn('filter:all','Back to inbox','back','record-back')+
    (isTeamPractice()?btn('team-restart','Start a new team practice','replay','subtle'):'');
}
if(isTeamPractice()){
  if(['processing','blocked'].includes(c.stage)){
    const ready=teamDraftState().ready;
    return btn('team-deliver','Send V'+c.rev+' for review','send','primary',ready?'':'disabled aria-describedby="team-edit-status"');
  }
  if(c.stage==='review'){
    if(teamPerspective()==='customer'){
      return btn('practice-adjust','Request changes','branch','outline')+btn('practice-accept','Accept V'+c.rev,'check','primary');
    }
    return c.rev===1?'':btn('team-view-requester','View as Requester','customer','primary');
  }
  return '';
}
if(tour?.type==='customer'&&c.stage==='review'){
  return btn('practice-adjust','Request changes','branch','outline')+btn('practice-accept','Accept V'+c.rev,'check','primary');
}
if(isPractice()&&c.stage==='draft')return btn('practice-submit','Submit feedback','send','primary');
if(tour?.frames[tour.index]?.handoff&&tour.index===tour.frames.length-1)return btn('exit','Finish walkthrough','check','outline');
if(tour)return !isPractice()&&v.kind==='hesitation'&&c.answer&&!tour.playing&&tour.index<tour.frames.length-1?btn('toggle','Play example','play','outline'):'';
let id,label,ico,extra='';
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
function walkExplanation(frame){
  if(isHandsOn())return '';
  const explanation=P.explain(frame);
  return '<section class="walk-explanation" aria-label="About this walkthrough step">'+
    '<p class="walk-purpose"><b>Why this step</b> '+esc(explanation.purpose)+'</p>'+
    '<details id="walk-explanation"'+(tour.explanationOpen?' open':'')+'><summary>What to notice'+I('down',12)+'</summary>'+
    '<div class="walk-notes"><p class="walk-notice">'+esc(explanation.notice)+'</p>'+
    '<p class="walk-next"><b>'+esc(explanation.actor)+'</b><span>'+esc(explanation.next)+'</span></p></div></details></section>';
}
function transport(){
  if(!tour)return '';
  if(isTeamPractice()||(isHandsOn()&&['release','authorized','published'].includes(here().stage))){
    const history=inPracticeHistory();
    const status=history?'Earlier step · Read only':inOwnerView()?'Site owner view':
      tour.type==='customer'||teamPerspective()==='customer'?'Requester view':'Website team view';
    const historyTools=history?btn('walkcurrent','Return to current step',null,'walk-current')+iconbtn('walknext','next','Next step'):
      isTeamPractice()&&P.canOpenOwner(tour.frames[tour.index])?btn('team-restart','Start a new team practice',null,'walk-mode'):'';
    return '<div class="transport'+(history?' is-history':'')+'" role="group" aria-label="Walkthrough player">'+
      '<span class="trackmark">'+I(history?'history':inOwnerView()?'flag':'people',14)+'</span><div class="tracktitle"><b>'+
      (isTeamPractice()?'Team practice':'Requester practice')+'</b><span>'+esc(status)+'</span></div>'+
      '<div class="playtools">'+historyTools+'</div></div>';
  }
  const last=tour.index===tour.frames.length-1;
  const watching=!isHandsOn();
  const waiting=last&&E.derive(here()).question?.type==='wording-retry';
  const playback=waiting?'Waiting for your answer':tour.playing?'Playing':last?(tour.frames[tour.index].handoff&&here().stage!=='published'?'Handoff complete':'Finished'):'Paused';
  const name=tour.type==='create'?'The “Create” walkthrough':tour.type==='mine'?'Your feedback walkthrough':
    P.list.find(item=>item.id===tour.type).label+' walkthrough';
  const history=inPracticeHistory();
  const gate=decisionPoint();
  const toggleLabel=tour.playing?'Pause':last?'Replay':'Resume';
  const toggle=history||gate||(isPractice()&&last)?'':watching?
    btn('toggle',toggleLabel,tour.playing?'pause':last?'replay':'play','walk-play'):
    iconbtn('toggle',tour.playing?'pause':last?'replay':'play',toggleLabel);
  const next=history||(!last&&!gate)?(watching?btn('walknext','Next','next','walk-next-step'):iconbtn('walknext','next','Next step')):'';
  const modeSwitch=history?btn('walkcurrent','Return to current step',null,'walk-current'):
    tour.type==='customer'?btn(isPractice()?'reset-example':'take-control',isPractice()?'Restart example':'Try it yourself',null,'walk-mode'):
    tour.type==='team'?btn('team-practice','Try it yourself',null,'walk-mode'):'';
  const sample=P.list.some(role=>role.id===tour.type);
  const status=history?'Earlier step · Read only':isPractice()?(gate?'Your turn':last?playback:tour.playing?'Team working':'Paused'):
    sample?(tour.fromPractice?'Your practice':'Watching example')+' · '+playback:playback;
  const frame=tour.frames[tour.index];
  const player='<span class="trackmark">'+I(history?'history':'play',14)+'</span>'+
    '<div class="tracktitle"><b>'+esc(name)+'</b><span>'+esc(status)+(watching?' · '+(tour.index+1)+' of '+tour.frames.length:'')+'</span><span class="sr">'+
    'Frame '+(tour.index+1)+' of '+tour.frames.length+' · '+esc(frame.title)+'</span></div>'+
    '<div class="playtools">'+modeSwitch+toggle+next+'</div>';
  return '<div class="transport'+(watching?' with-explanation':'')+(history?' is-history':'')+'" role="group" aria-label="Walkthrough player">'+
    (watching?'<div class="walk-player">'+player+'</div>'+walkExplanation(frame):player)+'</div>';
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
  if(c.stage==='draft'&&!tour){
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
  const release=c.stage==='published'&&!isHandsOn()?'<section class="context-release"><h3>Release record</h3>'+receiptFacts(c)+'</section>':'';
  return '<div class="context-panel">'+release+'<section class="history-copy context-original">'+sourceHeader+source+'</section>'+
    answer+request+'<section class="history-copy"><h3>Version history</h3>'+versions+'</section></div>';
}
function stageCopy(c,v){
  const handoff=tour?.frames[tour.index]?.handoff;
  const rev='V'+c.rev;
  if(inPracticeHistory()){
    const titles={draft:'Original request',clarify:v.question?.text||'Clarification',review:rev+' review',
      processing:c.rev>1?'The team revised '+rev:'The team prepared '+rev,
      blocked:c.adjustment?'Changes requested to V'+(c.rev-1):'Team investigation',
      release:inOwnerView()?'Release approval for '+rev:rev+' accepted',authorized:rev+' release authorized'};
    const status=dockStatus({...tour,index:practiceFrontier()});
    return ['Earlier step',titles[c.stage]||stages[c.stage],'Current step · '+status.join(' · ')];
  }
  if(isHandsOn()){
    if(c.stage==='release'){
      if(inOwnerView())return ['Your turn','Approve '+rev+' for release','Check the accepted copy and its destination before approving the simulated release.'];
      return ['Awaiting release approval',rev+' accepted','The site owner decides whether to release this version.'];
    }
    if(c.stage==='authorized')return ['Running simulation','Release authorized','The website team is running the '+rev+' simulation. Its receipt will appear here.'];
  }
  if(isTeamPractice()){
    switch(c.stage){
      case 'processing':case 'blocked':
        return c.rev===1?['Your turn','Check the first proposal','Check that the two entry points address the requester’s concern, then send V1 for review.']:
          ['Your turn','Edit the '+rev+' draft','Update the entry copy to address the requested change. Both options start with the wording from V'+(c.rev-1)+'.'];
      case 'review':
        if(teamPerspective()==='customer')return ['Your turn','Review '+rev,'Read the two options and the review question. Accept this version or ask the team for another change.'];
        return c.rev===1?['Simulated review','V1 is with the requester','A simulated requester will respond to these two entry options. There’s nothing for you to send while you wait.']:
          ['Waiting for review',rev+' is with the requester','The requester has the version you sent. Open their view to review its exact copy.'];
    }
  }
  if(handoff&&tour.index===tour.frames.length-1)return ['Handoff',handoff.title,handoff.description];
  const practicing=tour?.inputMode==='practice';
  if(tour?.type==='customer'){
    switch(c.stage){
      case 'draft':return [practicing?'Your turn':'Sample request','Describe the problem','Tell the team what felt unclear. You do not need to write the replacement copy.'];
      case 'clarify':return ['Your turn',v.question?.text||'Clarify your feedback','Describe what gave you pause. The team will propose the wording.'];
      case 'processing':return ['With the website team',c.rev>1?'The team has revised '+rev:'The team is preparing '+rev,
        'No action is needed from you until '+rev+' is sent for your review.'];
      case 'blocked':return ['With the website team',c.adjustment?'Changes requested — waiting for the team':'The team is reviewing your concern',
        c.adjustment?'Your change request is saved. The team needs to revise the draft before you review '+rev+'.':
        'The team needs to confirm this concern before there is a proposal for you to review.'];
      case 'review':return [practicing?'Your turn':'Sample review','Review '+rev,practicing?
        'Check the copy against your concern. Accept '+rev+' or tell the team what still needs to change.':
        (tour.frames[tour.index+1]?.case.accepted?
          'The example requester will accept '+rev+'. Choose an action below to make your own decision.':
          'The example requester will ask for changes. Choose an action below to make your own decision.')];
      case 'release':return ['With the site owner',rev+' accepted — awaiting release approval','Your review is complete. The site owner decides whether to authorize release.'];
      case 'authorized':return ['With the website team','Release authorized','The site owner has authorized '+rev+'. No further action is needed from you while the team simulates release.'];
    }
  }
  if(tour?.type==='team'){
    switch(c.stage){
      case 'processing':return [practicing?'Your turn':'Sample team work',c.rev>1?'Check the revised '+rev:'Check the AI draft',
        'Check '+rev+' against the requester’s concern, then send it to the reviewer.'];
      case 'blocked':return [practicing?'Your turn':'Sample team work','Revise the proposal',
        'Use the reviewer’s change request to update the draft before sending '+rev+' for review.'];
      case 'review':return ['With the reviewer','Waiting for the reviewer',rev+' is with the reviewer. Wait for acceptance or a request for changes.'];
    }
  }
  if(tour?.type==='publisher'){
    switch(c.stage){
      case 'release':return [practicing?'Your turn':'Sample release approval','Authorize the release',
        'Check the accepted '+rev+' and its target before separately authorizing release.'];
      case 'authorized':return ['With the website team','Release authorized',
        'Your authorization is recorded for '+rev+'. The website team now runs the simulated release.'];
    }
  }
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
  const acceptedBy=c.accepted&&P.list.some(role=>role.id===tour?.type)&&c.accepted.actor==='Reviewer'?
    (((tour.type==='customer'&&isPractice())||(isTeamPractice()&&teamPerspective()==='customer'))&&!c.accepted.simulated?'You (requester)':'Requester'):c.accepted?.actor;
  const entries=[['Target',target],['Accepted by',c.accepted?acceptedBy+' · V'+c.accepted.rev:'Not recorded']];
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
function releasePacket(c){
  const rev=c.receipt?.rev??c.authorization?.rev??c.accepted?.rev;
  const snapshot=c.versions.find(version=>version.rev===rev);
  if(!snapshot)return '';
  const target=c.receipt?.target??c.authorization?.target??'WinQuote homepage';
  const items=snapshot.view?.proposal?.items;
  const copy=items?.length?'<dl class="release-options">'+items.map(item=>'<div><dt>'+esc(item.label)+'</dt><dd>'+esc(item.detail)+'</dd></div>').join('')+'</dl>':
    '<p class="release-exact-copy">'+esc(snapshot.candidate)+'</p>';
  const acceptedBy=c.accepted.actor==='Reviewer'?'Requester':c.accepted.actor;
  const facts=[['Accepted by',acceptedBy+' · V'+c.accepted.rev]];
  if(c.authorization)facts.push(['Approved by',c.authorization.actor+' · V'+c.authorization.rev]);
  const published=c.receipt&&c.trail.find(event=>event.action==='publish'&&event.rev===rev);
  if(published){
    const when=new Date(published.at);
    const at=Number.isFinite(when.getTime())?' · '+when.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
    facts.push(['Simulated by',published.actor+' · V'+rev+at]);
  }
  return '<section class="release-packet" aria-label="Accepted copy V'+rev+'"><div class="release-packet-head">'+
    '<h3>Accepted copy <span class="version">V'+rev+'</span></h3><p class="release-target">'+I('target',14)+esc(target)+'</p></div>'+copy+
    '<dl class="release-signatures">'+facts.map(([key,value])=>'<div><dt>'+esc(key)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl></section>';
}
function candidateSection(c,v){
  return '<section class="candidate-block" id="candidate">'+candidateHTML(c,v)+'</section>';
}
function stageTask(c,v){
  const [label,title,lead]=stageCopy(c,v);
  const isRequesterView=tour?.type==='customer'||(isTeamPractice()&&teamPerspective()==='customer');
  const actingAsRequester=isRequesterView&&['Requester','Reviewer'].includes(c.owner);
  const actingAsTeam=tour?.type==='team'&&c.owner==='Website team'&&!inOwnerView();
  const actingAsOwner=(tour?.type==='publisher'||inOwnerView())&&c.owner==='Site owner';
  const ownerLabel=actingAsRequester?'You · Requester':actingAsTeam?'You · Website team':actingAsOwner?'You · Site owner':
    isTeamPractice()&&c.owner==='Reviewer'?'Requester':role(c.owner)[2];
  const prefix=avatar(c.owner,18)+'<span class="person-prop">'+esc(ownerLabel)+'</span><span aria-hidden="true">·</span>';
  let body='';
  if(c.stage==='draft')body=sourceArea(c)+footer(c,v)+(tour?.type==='customer'?'':candidateSection(c,v));
  else if(c.stage==='clarify')body=candidateSection(c,v);
  else if(usesChecks(c))body=related(c,v)+candidateSection(c,v)+footer(c,v);
  else if(isHandsOn()&&['release','authorized'].includes(c.stage)){
    body=(inOwnerView()?releasePacket(c):'')+footer(c,v);
  }
  else body=receiptFacts(c)+footer(c,v)+
    (alternateAnswer(c,v)?'<div class="thread-notes">'+alternateAnswer(c,v)+'</div>':'');

  return '<section class="stage-task" data-stage="'+esc(c.stage)+'" aria-labelledby="task-title"><div class="stage-eyebrow">'+prefix+esc(label)+'</div><h2 class="stage-title" id="task-title">'+esc(title)+'</h2><p class="stage-lead">'+esc(lead)+'</p>'+body+'</section>';
}
function completion(c){
  const version=c.receipt?.rev??c.rev;
  if(isHandsOn()&&c.receipt){
    return '<section class="stage-task completion-result" data-stage="published" aria-labelledby="task-title">'+
      '<span class="receipt-mark" aria-hidden="true">'+I('check',17)+'</span>'+
      '<h1 class="stage-title" id="task-title">Simulated release receipt</h1>'+
      '<p class="completion-context">The simulation is complete for V'+version+'.</p>'+
      releasePacket(c)+footer(c,E.derive(c))+'</section>';
  }
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
    const attribution=tour&&event.simulated?' · Example action':'';
    return '<li>'+avatar(event.actor)+'<div><b>'+esc(event.actor+attribution)+'</b>'+time+'<p>'+esc(event.text)+'</p></div></li>';
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
function displayedView(c){return isEditingTeamDraft(c)?teamDraftState().view:E.derive(c);}
function syncWalkthroughHeight(){
  const height=document.querySelector('.transport')?.offsetHeight||0;
  $('main').style.setProperty('--walkthrough-height',height+'px');
}
function caseMain(){
  const c=here(),v=displayedView(c),checks=usesChecks(c);
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
  syncWalkthroughHeight();
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
function dockStatus(current){
  if(!current)return ['Requester','Try the requester role'];
  const c=current.frames[current.index].case;
  const rev='V'+c.rev;
  if(isHandsOn(current)){
    if(c.stage==='release')return inOwnerView(current)?['You · Site owner','Approve '+rev+' for simulation']:['Site owner','View '+rev+' as Site owner'];
    if(c.stage==='authorized')return ['Website team','Wait for the '+rev+' simulation receipt'];
    if(c.stage==='published')return ['Complete','View the '+rev+' simulation receipt'];
  }
  if(isTeamPractice(current)){
    switch(c.stage){
      case 'processing':case 'blocked':return ['You · Website team',c.rev===1?'Check and send V1':'Edit and send '+rev];
      case 'review':
        if(teamPerspective(current)==='customer')return ['You · Requester','Review '+rev];
        return ['Requester',c.rev===1?'Await the sample reply':'View '+rev+' as requester'];
    }
  }
  if(current.type!=='customer'||current.inputMode!=='practice'){
    // These routes show example actions. Opening a paused example never takes that action.
    const next={draft:'Watch feedback submission',clarify:'Watch the clarification',processing:'Watch '+rev+' preparation',
      blocked:'View the open request',review:'Watch '+rev+' review',release:'View '+rev+' awaiting approval',
      authorized:'View '+rev+' release authorization',published:'View the '+rev+' release receipt'};
    return [c.owner,next[c.stage]];
  }
  switch(c.stage){
    case 'draft':return ['You · Requester','Submit feedback'];
    case 'clarify':return ['You · Requester','Answer one question'];
    case 'processing':return ['Website team','Wait for '+rev];
    case 'blocked':return ['Website team',c.adjustment?'Wait for the '+rev+' revision':'Wait for team input'];
    case 'review':return ['You · Requester','Review '+rev];
    case 'release':return ['Site owner','Await '+rev+' release approval'];
    case 'authorized':return ['Website team','Await simulated release of '+rev];
    case 'published':return ['Complete','View the '+rev+' release receipt'];
  }
}
function renderDock(){
  const dock=$('walkthrough-dock');
  const visible=!tour;
  dock.hidden=!visible;
  dock.parentElement.classList.toggle('has-walk-dock',visible);
  dock.parentElement.classList.toggle('has-parked-tour',visible&&Boolean(parkedTour));
  if(!visible)return;
  if(!dock.firstElementChild){
    dock.innerHTML='<button class="walk-dock-button" data-go="open-walkthrough" type="button" aria-controls="main" aria-expanded="false">'+
      '<span class="walk-dock-icon">'+I('play',15)+'</span><span class="walk-dock-copy"><strong class="walk-dock-name">Walkthrough</strong>'+
      '<span class="walk-dock-status"><span class="walk-dock-owner"></span> <span class="walk-dock-separator" aria-hidden="true">·</span> <span class="walk-dock-action"></span></span></span>'+
      '<span class="walk-dock-arrow">'+I('next',14)+'</span></button>';
  }
  const [owner,action]=dockStatus(parkedTour);
  dock.querySelector('.walk-dock-owner').textContent=owner;
  dock.querySelector('.walk-dock-action').textContent=action;
}
function render(){renderNav();renderBar();page==='case'?caseMain():inbox();renderDock();}
function refreshDlgProof(){
const f=$('candidateedit');if(!f)return;const c=E.editCandidate(here(),f.value),v=E.derive(c),q=$('edit-status');
q.textContent=v.blocked?v.reason:(v.limit!==null?v.wordCount+' / '+v.limit+' words · ':'')+'Ready for team review.';
q.classList.toggle('warn',v.blocked);}
function dialog(body,title){$('dialog-body').innerHTML='<div class="dlghead"><h2>'+esc(title)+'</h2>'+iconbtn('close','cross','Close')+'</div>'+body;$('dialog').setAttribute('aria-label',title);if(!$('dialog').open)$('dialog').showModal();}
function close(){if($('dialog').open)$('dialog').close();}
function stop(){clearTimeout(timer);timer=null;}
function teamDraftState(){
  const frame=tour.frames[tour.index];
  return P.teamDraft(frame,inPracticeHistory()?null:tour.teamInputs);
}
function appendPracticeSteps(current,steps){
  if(!steps.length||current.index!==current.frames.length-1)return false;
  current.frames=current.frames.concat(steps);current.index=current.frames.length-1;
  delete current.teamInputs;
  rememberPractice(true,current);saveTour();return true;
}
function schedulePracticeEvent(current){
  const frame=current.frames[current.index];
  if(current.index!==current.frames.length-1)return;
  const c=frame.case;
  const execution=inOwnerView(current)&&c.stage==='authorized';
  const firstReply=isTeamPractice(current)&&frame.personaId==='team'&&c.stage==='review'&&c.rev===1;
  if(!execution&&!firstReply)return;
  timer=setTimeout(()=>{
    if(current!==(tour||parkedTour)||frame!==current.frames[current.index])return;
    const steps=execution?P.releaseSteps(frame,'execute',c.rev):P.teamSteps(frame,'sample-change');
    if(!appendPracticeSteps(current,steps))return;
    if(tour){render();focusTask();}else renderDock();
    announce(execution?'The website team completed the simulated release of V'+c.rev+'.':
      'The example requester asked for changes. The website team owns V2.');
  },4000);
}
function teamAction(action,value){
  if(!isTeamPractice()||inPracticeHistory())return;
  const steps=P.teamSteps(tour.frames[tour.index],action,value);
  if(!appendPracticeSteps(tour,steps))return;
  close();setPlay(false);render();focusTask();announce(steps.at(-1).title);
}
function ownerAction(action,revision){
  if(!isHandsOn()||inPracticeHistory())return;
  const steps=P.releaseSteps(tour.frames[tour.index],action,revision);
  if(!appendPracticeSteps(tour,steps))return;
  close();setPlay(false);render();focusTask();announce(steps[0].title);
}
function updateTeamDraft(){
  if(!isTeamPractice()||inPracticeHistory()||teamPerspective()!=='team')return;
  tour.teamInputs=[1,2].map(index=>({label:$('team-label-'+index).value,detail:$('team-detail-'+index).value}));
  const draft=teamDraftState();
  const send=document.querySelector('[data-go="team-deliver"]');
  if(send)send.disabled=!draft.ready;
  const status=$('team-edit-status');
  if(status){status.textContent=draft.reason||'Ready to send V'+here().rev+' for review.';status.classList.toggle('warn',!draft.ready);}
  updateAside(here(),draft.view);
  saveTour();
}
function setPlay(on){
  if(!tour)return;
  if(on&&!isHandsOn())tour.explanationOpen=false;
  if(isTeamPractice()||inOwnerView()){stop();tour.playing=false;saveTour();schedulePracticeEvent(tour);return;}
  tour.playing=Boolean(on&&!inPracticeHistory()&&!decisionPoint()&&tour.index<tour.frames.length-1);stop();
  if(tour.playing){
    const choosing=here().stage==='clarify'&&E.derive(here()).question?.type==='hesitation';
    const exampleReview=tour.type==='customer'&&here().stage==='review';
    timer=setTimeout(auto,choosing?14000:exampleReview?9000:isHandsOn()?4000:8000);
  }
  saveTour();
}
function focusTask(){
  const title=$('task-title');
  if(title){title.tabIndex=-1;title.focus({preventScroll:true});}
}
function auto(){
  if(!tour?.playing)return;
  if(tour.index>=tour.frames.length-1){setPlay(false);render();return;}
  tour.index++;rememberPractice();setPlay(tour.index<tour.frames.length-1);render();
  if(decisionPoint())focusTask();
  announce(tour.frames[tour.index].title);
}
function endTour(restore=false){
  stop();
  const parent=restore&&tour?.type==='create'?savedTour(viewKey):null;
  try{sessionStorage.removeItem(createViewKey);}catch{}
  tour=parent?.minimized?null:parent;
  parkedTour=parent?.minimized?parent:null;
  saveTour();tab='checks';activeSource=-1;asideOpen=false;
  if(parkedTour){page='list';scheduleParkedStep();}
}
function scheduleParkedStep(){
  const current=parkedTour;
  if(isTeamPractice(current)||inOwnerView(current)){schedulePracticeEvent(current);return;}
  if(current?.type!=='customer'||current.inputMode!=='practice')return;
  const c=current.frames[current.index].case;
  if(!['processing','blocked'].includes(c.stage)||current.index>=current.frames.length-1)return;
  stop();
  timer=setTimeout(()=>{
    if(parkedTour!==current)return;
    current.index++;
    rememberPractice(false,current);saveTour();renderDock();
    if(current.frames[current.index].case.stage==='review')announce('The website team sent V'+current.frames[current.index].case.rev+' for your review. Open Walkthrough to review it.');
    scheduleParkedStep();
  },4000);
}
function parkActive(){
  if(!tour)return;
  stop();tour.playing=false;
  if(isPractice()||isTeamPractice())tour.index=practiceFrontier();
  parkedTour=tour;tour=null;
  asideOpen=false;tab='checks';activeSource=-1;panelStage=null;priorOwner=null;
  saveTour();scheduleParkedStep();
}
function minimizeWalkthrough(){
  if(!tour)return;
  parkActive();page='list';filter='all';search='';render();
  $('walkthrough-dock').firstElementChild?.focus({preventScroll:true});
}
function openWalkthrough(){
  if(!parkedTour){begin('customer',false,true);focusTask();return;}
  stop();tour=parkedTour;parkedTour=null;
  page='case';filter='all';tab='checks';activeSource=-1;asideOpen=false;panelStage=null;
  if(isPractice())rememberPractice(true);
  setPlay(isPractice()&&!decisionPoint());render();focusTask();
}
function appendSteps(frames,c){
  for(let i=0;i<15;i++){
    const next=E.step(c);if(c===next)break;
    c=next;frames.push({case:c,title:c.trail.at(-1)?.text||stages[c.stage]});
  }
  return frames;
}
function begin(type,reset=false,startPractice=false,watchTeamExample=false){
  if(type==='team'&&startPractice){
    const saved=reset?null:savedTour(teamPracticeKey);
    endTour();close();page='case';filter='all';
    tour=saved||{record:data.current,type:'team',inputMode:'practice',roleStoryVersion,
      frames:[P.teamStart()],index:0,playing:false};
    setPlay(false);render();focusTask();announce('Website team practice. '+tour.frames[tour.index].title);
    return;
  }
  if(reset){practice=null;writePractice();}
  if(type==='mine'&&!selected().c.text.trim())return;
  // The sample has its own transport and session. Exiting returns to the same work.
  if(type==='create'){stop();parkedTour=null;tab='checks';activeSource=-1;asideOpen=false;}
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
    frames=watchTeamExample?P.frames('team',E.hesitationAnswers[0]):practice&&type==='customer'?practice.frames:
      practice?P.from(type,practice.frames[practice.frontier]):P.frames(type,roleAnswer);
  }
  tour={record:data.current,type,frames,index:0,playing:false,
    ...(P.list.some(role=>role.id===type)?{roleStoryVersion,scenarioAnswer:roleAnswer}:{})};
  if(type==='customer'&&practice){tour.inputMode='practice';tour.index=practice.frontier;tour.scenarioAnswer=practice.answer;}
  else if(P.list.some(role=>role.id===type)){tour.inputMode='watch';tour.fromPractice=!watchTeamExample&&Boolean(practice);}
  if(type==='customer'&&startPractice){tour.inputMode='practice';rememberPractice();}
  setPlay(frames.length>1&&(!isPractice()||!decisionPoint()));render();announce('Walkthrough started.');
}
function clarificationPrefix(){
  if(!tour||inPracticeHistory()||inOwnerView()||!['mine','create','customer'].includes(tour.type))return null;
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
  delete tour.answerDraft;
  const choseConcern=E.derive(before).question.type==='hesitation';
  if(tour.type==='customer'){
    roleAnswer=raw;
    try{sessionStorage.setItem(roleAnswerKey,raw);}catch{}
    tour.inputMode='practice';
    tour.frames=P.frames('customer',raw,{personalAnswer:true});
    tour.index=Math.max(0,tour.frames.findIndex(frame=>frame.case.answer===raw));
    tour.scenarioAnswer=raw;
    tour.roleStoryVersion=roleStoryVersion;
    rememberPractice(true);
  }else{
    const index=head.length;
    head.push({case:c,title:choseConcern?(c.stage==='blocked'?'Website team investigates the concern':'Website team proposes new copy'):'Your walkthrough answer: '+raw});
    tour.frames=appendSteps(head,c);tour.index=index;
  }
  close();activeSource=-1;tab='checks';asideOpen=false;
  setPlay((isPractice()||!choseConcern)&&tour.index<tour.frames.length-1);render();
  if(choseConcern&&$('candidate')?.querySelector('h2')){
    const target=$('candidate'),heading=target.querySelector('h2');
    target.classList.add('reconsidered');heading.tabIndex=-1;heading.focus({preventScroll:true});
    if(heading.getBoundingClientRect().top>=window.innerHeight)heading.scrollIntoView({block:'center'});
  }
  announce(c.stage==='clarify'?'Your answer is saved. The requester still needs to clarify the wording.':c.stage==='blocked'?'The website team needs to investigate this answer.':'The draft and checks now reflect your answer.');
}
function takeControl(){
  if(tour?.type!=='customer')return;
  tour.inputMode='practice';
  if(tour.index===tour.frames.length-1&&here().stage!=='review')tour.index=0;
  rememberPractice(true);setPlay(!decisionPoint());render();announce('You are trying the requester role.');
}
function chooseReview(choice,note){
  if(isTeamPractice()){teamAction(choice,note);return;}
  if(tour?.type!=='customer'||inPracticeHistory()||here().stage!=='review')return;
  const index=tour.index,frames=P.decide(tour.frames,index,choice,note);
  if(frames===tour.frames||!frames[index+1])return;
  tour.inputMode='practice';tour.frames=frames;tour.index=index+1;
  rememberPractice(true);close();setPlay(tour.index<frames.length-1);render();focusTask();announce(frames[tour.index].title);
}
function selectCase(id){if(!data.items.some(x=>x.id===id))return;parkActive();data.current=id;save();page='case';filter='all';tab='checks';activeSource=-1;render();}
function newItem(text=''){const id='WQ-'+String(++data.serial).padStart(3,'0');data.items.unshift({id,c:E.createCase(text)});selectCase(id);if(!text)$('source')?.focus();}
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
  const reached=practice?.frames[practice.frontier]?.case;
  const descriptions={
    customer:reached?'Return to your request and review decisions.':'Explain your concern and decide whether the team’s proposal resolves it.',
    team:reached?'See the team’s work on your current request.':'Prepare a proposal, revise it, and send it back for review.',
    publisher:reached?(reached.accepted?'Check the accepted V'+reached.accepted.rev+' before authorizing its simulated release.':'See what still needs acceptance before release.'):'Check the accepted version and authorize its simulated release.'
  };
  const options=P.list.map((role,index)=>
    (role.id==='team'?'<button data-go="team-practice">'+avatar('Website team')+
      '<span><b>Practice as the website team</b><small>Send V1, revise the two entry points, and hand V2 to the requester.</small></span>'+I('next',15)+'</button>':'')+
    '<button data-go="persona:'+role.id+'">'+avatar(roles[index])+'<span><b>'+esc(role.id==='team'?'Watch the website team example':
      role.id==='publisher'?'Watch the site owner example':role.label)+'</b><small>'+
    esc(descriptions[role.id])+'</small></span>'+I('play',15)+'</button>').join('');
  dialog('<p class="dlgdesc">Practice the team’s edits and handoffs, try the requester’s decisions, or watch a role example.</p>'+
    '<div class="dlgrows">'+options+'</div>','Choose your role');
}

function viewWalkStep(index,control){
  if(!tour)return;
  if(index<0){minimizeWalkthrough();return;}
  if(index>=tour.frames.length)return;
  const returning=inPracticeHistory()&&index===practiceFrontier();
  if(isPractice()&&index>practice.frontier&&decisionPoint())return;
  tour.index=index;
  if(isPractice()&&index>practice.frontier)rememberPractice();
  setPlay(returning&&!decisionPoint());render();
  const navigation=control&&document.querySelector('[data-go="'+control+'"]');
  if(navigation)navigation.focus({preventScroll:true});else focusTask();
}
function doAction(g){
const [k,arg]=g.split(':');if(!['nav','mobileaside'].includes(k)){navOpen=false;$('nav').classList.remove('show');$('shade').hidden=true;}
if(inPracticeHistory()&&['practice-submit','practice-accept','practice-adjust','team-deliver','team-view-requester','tour-answer','toggle','reset-example','take-control'].includes(k))return;
if(tour?.playing&&['tab','evidence','mobileaside','location','ver','refine'].includes(k)){setPlay(false);render();}
switch(k){
case 'close':close();return;
case 'nav':navOpen=!navOpen;renderNav();return;
case 'mobileaside':asideOpen=!asideOpen;$('inspector')?.classList.toggle('aside-open',asideOpen);(asideOpen?document.querySelector('.mobile-close'):$('mobaside'))?.focus({preventScroll:true});return;
case 'project':case 'filter':parkActive();filter=k==='project'?'all':arg;page='list';search='';render();return;
case 'find':parkActive();filter='all';search='';page='list';render();$('searchbox').focus();return;
case 'new':newItem();return;case 'case':selectCase(arg);return;case 'walk':begin('mine');return;case 'personas':personaMenu();return;case 'persona':begin(arg);return;
case 'team-practice':begin('team',false,true);return;
case 'team-restart':if(isTeamPractice()&&!inPracticeHistory()&&(P.canOpenOwner(tour.frames[tour.index])||
  (here().stage==='published'&&here().receipt)))begin('team',true,true);return;
case 'view-site-owner':ownerAction('view-owner',Number(arg));return;
case 'approve-release':ownerAction('approve',Number(arg));return;
case 'team-deliver':teamAction('deliver',tour?.teamInputs);return;
case 'team-view-requester':teamAction('view-requester');return;
case 'create-tour':begin('create');return;
case 'minimize-tour':minimizeWalkthrough();return;
case 'open-walkthrough':openWalkthrough();return;
case 'exit':endTour(true);render();return;
case 'take-control':takeControl();return;
case 'reset-example':begin('customer',true);return;
case 'practice-submit':if(isPractice()&&here().stage==='draft'){tour.index++;rememberPractice();setPlay(false);render();focusTask();}return;
case 'practice-accept':chooseReview('accept');return;
case 'practice-adjust':{
  if((tour?.type!=='customer'&&!(isTeamPractice()&&teamPerspective()==='customer'))||here().stage!=='review')return;
  setPlay(false);render();
  dialog('<form id="practicechange"><label for="adj">What still needs to be clearer?</label><textarea id="adj" maxlength="1000" required>'+esc(P.suggestChange(here()))+'</textarea><p class="dlgdesc">Edit this suggestion or describe your own change. The team will review your note.</p><div class="dlgfoot">'+btn('close','Cancel',null,'outline')+'<button class="control primary">Send change request</button></div></form>','Request changes to V'+here().rev);
  $('adj').focus();return;
}
case 'walkback':if(tour)viewWalkStep(tour.index-1,k);return;
case 'walknext':if(tour)viewWalkStep(tour.index+1,k);return;
case 'walkcurrent':if(inPracticeHistory())viewWalkStep(practiceFrontier());return;
case 'tour-answer':{
  const head=clarificationPrefix();if(!head)return;
  const q=E.derive(head.at(-1).case).question;
  setPlay(false);render();
  if(q.type==='hesitation'){
    dialog('<p class="answer-prompt">'+esc(q.text)+'</p>'+answerFields(q)+'<p class="dlgdesc">Choosing an answer starts a new proposal for this walkthrough.</p>','Try another answer');
    $('dialog').querySelector('[data-tour-opt]')?.focus();
  }else{
    dialog('<form id="touranswerform"><label for="tourans">'+esc(q.text)+'</label><div class="opts">'+q.options.map(o=>'<button type="button" data-tour-opt="'+esc(o)+'">'+esc(o)+'</button>').join('')+'</div><input id="tourans" required maxlength="500" placeholder="Enter an answer for this walkthrough"><div class="dlgfoot"><button class="control primary">Continue with this answer</button></div></form>','Change walkthrough answer');$('tourans').focus();
  }
  return;
}
case 'toggle':if(!tour||decisionPoint()||(isPractice()&&tour.index===tour.frames.length-1))return;if(!tour.playing&&tour.index===tour.frames.length-1)tour.index=0;setPlay(!tour.playing&&tour.frames.length>1);render();return;
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
case 'evidence':activeSource=activeSource===+arg?-1:+arg;updateAside(here(),displayedView(here()));document.querySelector('[data-go="evidence:'+arg+'"]')?.focus({preventScroll:true});return;
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
  if(!tour?.playing||!ev.target.closest('#touranswerform, [data-go="practice-adjust"], [data-go="practice-accept"]'))return;
  setPlay(false);
  const transportNode=document.querySelector('.transport');
  if(transportNode)transportNode.outerHTML=transport();
  const note=document.querySelector('.question-pane .question-note');
  if(note)note.textContent='Paused while you answer. Resume to keep watching.';
});
document.addEventListener('input',ev=>{if(ev.target.matches('[data-team-field]'))updateTeamDraft();if(ev.target.id==='tourans'&&tour&&!$('dialog').open&&!inPracticeHistory()){tour.answerDraft=ev.target.value;saveTour();}if(ev.target.id==='source')syncSource(ev.target.value);if(ev.target.id==='candidateedit')refreshDlgProof();if(ev.target.id==='searchbox'){search=ev.target.value;inbox();const s=$('searchbox');s.focus();s.setSelectionRange(search.length,search.length);}});
document.addEventListener('submit',ev=>{if(ev.target.id==='practicechange'){ev.preventDefault();const note=$('adj').value.trim();if(note)chooseReview('adjust',note);else $('adj').focus();return;}if(ev.target.id==='touranswerform'){ev.preventDefault();answerTour($('tourans').value);return;}if(ev.target.id==='proofeditform'||ev.target.id==='revisionform'){ev.preventDefault();if(!tour){selected().c=ev.target.id==='proofeditform'?E.editCandidate(here(),$('candidateedit').value):E.reviseAdjustment(here(),$('revision-note').value);save();close();render();}return;}if(ev.target.id==='answerform'){ev.preventDefault();const val=$('answer').value.trim();if(val)apply('answer',val);else $('answer').focus();}if(ev.target.id==='adjustform'){ev.preventDefault();const s=$('adj').value.trim();if(s)apply('adjust',s);}});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){if($('dialog').open)return;if(navOpen){navOpen=false;renderNav();}else if(asideOpen){asideOpen=false;caseMain();}else if(tour){minimizeWalkthrough();}}if(ev.code==='Space'&&tour&&!['INPUT','TEXTAREA','BUTTON','SUMMARY'].includes(document.activeElement.tagName)&&!$('dialog').open){ev.preventDefault();doAction('toggle');}});
document.addEventListener('toggle',event=>{
  const details=event.target;
  if(details.id!=='walk-explanation'||!tour||isHandsOn())return;
  if(Boolean(tour.explanationOpen)===details.open)return;
  tour.explanationOpen=details.open;
  if(details.open){
    setPlay(false);
    render();
    $('walk-explanation')?.querySelector('summary')?.focus({preventScroll:true});
  }else{
    saveTour();
    syncWalkthroughHeight();
  }
},true);
window.addEventListener('resize',syncWalkthroughHeight);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&tour?.playing){setPlay(false);render();}});
const launchURL=new URL(location.href);
const requestedWalkthrough=launchURL.searchParams.get('walkthrough');
if(requestedWalkthrough==='create'||P.list.some(role=>role.id===requestedWalkthrough)){
  const startPractice=['team','customer'].includes(requestedWalkthrough)&&launchURL.searchParams.get('mode')==='practice';
  if(startPractice)launchURL.searchParams.delete('mode');
  launchURL.searchParams.delete('walkthrough');
  history.replaceState(history.state,'',launchURL.href);
  const watchTeam=requestedWalkthrough==='team'&&!startPractice;
  const sameRoute=current=>current?.type===requestedWalkthrough&&
    (requestedWalkthrough!=='team'||isTeamPractice(current)===startPractice)&&(!watchTeam||!current.fromPractice);
  if(sameRoute(parkedTour))openWalkthrough();
  else if(sameRoute(tour)){setPlay(isPractice()&&!decisionPoint());render();}
  else begin(requestedWalkthrough,false,startPractice,watchTeam);
  if(watchTeam&&tour&&!tour.playing){
    if(tour.index===tour.frames.length-1)tour.index=0;
    setPlay(true);render();
  }
  if(startPractice&&requestedWalkthrough==='customer'&&!isPractice())takeControl();
}else{
  if(tour&&(isPractice()||isTeamPractice()))setPlay(!decisionPoint());
  if(parkedTour)scheduleParkedStep();
  render();
}
})();
