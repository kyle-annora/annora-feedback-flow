(() => {
'use strict';
const E=window.CaseEngine, P=window.CasePersonas, I=window.Glyph, $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stages={draft:'Draft',clarify:'Needs your input',processing:'In progress',blocked:'Needs team input',review:'Ready for review',release:'Awaiting authorization',authorized:'Authorized',published:'Release simulated'};
const actorModes={'Requester':['customer','lilac','Requester'],'Website team':['people','mint','Website team'],'Reviewer':['verify','amber','Reviewer'],'Site owner':['flag','rose','Site owner'],'Complete':['checks','mint','Complete']};
const meta={draft:'Submit your feedback when it’s ready.',clarify:'Answer the question so the team can draft the copy.',processing:'Check the draft against the requirements, then send it to the reviewer.',blocked:'Resolve the outstanding requirements before sending this for review.',review:'Read this version, then accept it or request changes.',release:'The reviewer accepted this version. The site owner can now authorize release.',authorized:'The site owner authorized release. The website team can now run the simulation.',published:'The simulated release is complete.'};
const examples=[['Homepage quote instructions',E.initialFeedback],['Specify a button label','Change the WinQuote homepage button label from “Create” to “Start a quote”.'],['Clarify a button label','New employees find the homepage quote button label confusing.'],['Pricing rule change','Change the homepage discount rules so staff can edit quote prices.']];
const navRows=[['clarify','ask','Needs your input'],['processing','clock','In progress'],['review','verify','Ready for review'],['release','release','Release approvals']];
const key='feedbackflow:casework:v2.1', viewKey='feedbackflow:walk:v2.1';
const createViewKey='feedbackflow:walk:create:v1';
const transition=(c,acts)=>acts.reduce((a,x)=>E.transition(a,...x),c);
function init(){return {current:'WQ-017',serial:17,items:[{id:'WQ-017',c:E.createCase()},{id:'WQ-016',c:transition(E.createCase(examples[2][1]),[['submit']])},{id:'WQ-015',c:transition(E.createCase(examples[1][1]),[['submit'],['deliver']])}]}}
let data;
try {
  const stored=JSON.parse(localStorage.getItem(key));
  const valid=Array.isArray(stored?.items)&&stored.items.some(item=>item.id===stored.current);
  data=valid?window.CaseUpgrade.workspace(stored):init();
} catch { data=init(); }
function savedTour(storageKey){
  try {
    const cached=JSON.parse(sessionStorage.getItem(storageKey));
    if(cached?.frames?.[cached.index]?.case&&cached.record===data.current){
      const validated=storageKey===createViewKey?cached:window.CaseUpgrade.walkthrough(cached);
      return {...validated,playing:false};
    }
  } catch {}
  return null;
}
let tour=savedTour(createViewKey)||savedTour(viewKey);
let page='case',filter='all',tab='checks',search='',navOpen=false,asideOpen=false,activeSource=-1,timer=null,notifyTimer=null,priorOwner=null;
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
function matches(c,f){return f==='all'||c.stage===f||f==='processing'&&c.stage==='blocked'||f==='release'&&['release','authorized','published'].includes(c.stage);}

function announce(s){clearTimeout(notifyTimer);$('live').textContent=s;notifyTimer=setTimeout(()=>{$('live').textContent=''},2400);}
function renderNav(){
const n=$('nav');n.innerHTML='<div class="brand"><span class="flowmark">'+FlowMark+'</span><strong>Feedback Flow</strong></div><div class="navgroup topnav">'+btn('find','Search feedback','search','navrow','title="Search feedback"')+btn('filter:all','Feedback inbox','inbox','navrow '+(filter==='all'?'selected':''), '')+btn('new','New feedback','plus','navrow newlink')+'</div><div class="navgroup"><span class="navlabel">Queues</span>'+navRows.map(([f,ic,l])=>'<button class="navrow '+(filter===f?'selected':'')+'" data-go="filter:'+f+'">'+I(ic)+'<span>'+l+'</span><small>'+data.items.filter(x=>matches(x.c,f)).length+'</small></button>').join('')+'</div><div class="navgroup project-group"><span class="navlabel">Projects</span><button class="navrow" data-go="project">'+fileTag()+'<span>WinQuote</span></button></div><div class="rail-end"><button data-go="personas" class="navrow"><span class="tour-ico">'+I('play',13)+'</span>Role walkthroughs</button><div class="local"><span class="local-dot"></span>Local demo workspace</div></div>';
n.classList.toggle('show',navOpen);$('shade').hidden=!navOpen;}
function renderBar(){
const c=here(),isCase=page==='case';
$('topbar').innerHTML='<div class="crumb">'+iconbtn('nav','menu','Open navigation')+'<span class="crumbicon">'+I('inbox',15)+'</span><button data-go="filter:all" class="txtbtn">Feedback inbox</button>'+(isCase?'<span class="slash">/</span><span class="crumbid">'+esc(tour&&tour.type!=='mine'?'Sample feedback':data.current)+'</span>':'')+'</div><div class="tools">'+(isCase?(tour?btn('exit','Exit walkthrough','cross','subtle'):btn('walk','Play walkthrough','play','walkbtn',c.text.trim()?'':'disabled')):'')+'</div>';
}
function cover(){return '<div class="cover" role="img" aria-label="Engineering drawing of a WinQuote walk-in cooler"><div class="cover-brand"><span class="cover-w">W</span> WinQuote</div><div class="cover-caption">Walk-in cooler <span>/</span> Assembly drawing</div></div>';}
function sourceArea(c){const isEdit=!tour&&!c.versions.length,example=isEdit?btn('examples','Try an example','down','plainbtn revert'):'';
return '<section class="source-block"><div class="section-head"><h2>'+I('quote',15)+'Original feedback</h2>'+example+'</div>'+(isEdit?'<textarea id="source" rows="2" maxlength="2000" aria-label="Original feedback" placeholder="What would you change on the homepage?">'+esc(c.text)+'</textarea>':'<div class="saved-source">'+esc(c.text||'No feedback yet')+'</div>')+(isEdit?'<div class="edit-under"><span>'+I('edit',12)+'Editable</span><div id="quick"></div></div>':'')+'</section>';}
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
if(v.question?.type==='hesitation'&&tour&&c.stage==='clarify'){
  const sampled=tour.frames[tour.index+1]?.case.answerSimulated;
  const cue=tour.playing?(sampled?'Autoplay will use the first sample answer.':'Autoplay will replay your chosen answer.'):(sampled?'Resume to watch the sample.':'Resume to replay your chosen answer.');
  return '<div class="section-head"><h2>'+I('ask',16)+'Annora asks</h2><span class="subtext">Requester’s turn</span></div><div class="question-pane"><p>'+esc(v.question.text)+'</p>'+answerFields(v.question)+'<span class="question-note">'+cue+' Choose an answer to explore it at your pace.</span></div>';
}
if(v.kind==='hesitation'&&v.manual&&v.blocked){
  return '<div class="section-head"><h2>'+I('people',16)+'Team investigation</h2><span class="subtext">Needs team input</span></div><p class="empty-copy">'+esc(v.reason)+'</p>';
}
if(v.question)return head+'<div class="question-pane"><p>'+esc(v.question.text)+'</p>'+(c.stage==='clarify'&&!tour?'<form id="answerform"><div class="opts">'+v.question.options.map(o=>'<button type="button" data-answer="'+esc(o)+'">'+esc(o)+'</button>').join('')+'</div><label class="sr" for="answer">Your answer</label><div class="input-actions"><input id="answer" placeholder="Enter your answer" maxlength="500"><button class="control primary">Submit answer</button></div></form>':'<span class="question-note">'+(tour?(tour.type==='mine'&&c.stage==='clarify'?'This walkthrough will use a sample answer.':'This walkthrough uses a sample answer.'):'After submission, the requester answers this question.')+'</span>'+(tour?.type==='mine'&&c.stage==='clarify'?btn('tour-answer','Try a different answer','edit','answer-demo'):'') )+'</div>';
if(!v.candidate){if(!tour&&c.candidateOverride!==null&&c.candidateOverride!==undefined&&c.stage==='blocked')head=head.replace('</div>',btn('edit-proof','Edit draft','edit','plainbtn')+'</div>');return head+'<p class="empty-copy">'+esc(v.reason||'Enter feedback to see a draft or a clarifying question.')+'</p>';}
const isButton=v.kind==='button';
if(!tour&&['processing','blocked'].includes(c.stage)&&!v.manual) head=head.replace('</div>',btn('edit-proof','Edit draft','edit','plainbtn')+'</div>');
if(v.proposal){
  head=head.replace('Proposed copy','Team proposal');
  return head+proposalHTML(v)+(v.blocked&&v.reason?'<p class="empty-copy">'+esc(v.reason)+'</p>':'');
}
return head+'<div class="proof '+(isButton?'proof-button':'')+'"><div class="proof-label">'+(isButton?'Homepage · Quote button':'Homepage · Quote instructions')+'</div><div class="candidate-text '+(isButton?'button-proof':'')+'" lang="en">'+(isButton?'<span>'+esc(v.candidate)+'</span>'+I('send',15):candidateLines(v))+'</div></div>';
}
function related(c,v){
  const explore=Boolean(tour&&['create','mine'].includes(tour.type)&&c.answer&&v.kind==='hesitation');
  const clarification=v.kind==='hesitation'?'Requester’s concern':'Clarification';
  return (c.answer||c.adjustment)?'<div class="thread-notes">'+(c.answer?'<div>'+I('ask',14)+'<span>'+clarification+'</span><strong>'+esc(c.answer)+(c.answerSimulated?' (sample answer)':'')+'</strong></div>':'')+(explore?btn('tour-answer','Try another answer','branch','swap-answer'):'')+(c.adjustment?'<div>'+I('branch',14)+'<span>Requested changes</span><strong>'+esc(c.adjustment)+'</strong></div>':'')+'</div>':'';
}
function actions(c,v){if(tour)return v.kind==='hesitation'&&c.answer&&!tour.playing&&tour.index<tour.frames.length-1?btn('toggle','Continue walkthrough','play','outline'):'';let id,label,ico,extra='';
switch(c.stage){
case 'draft':id='submit';label='Submit feedback';ico='send';extra=c.text.trim()?'':'disabled';break;
case 'processing':id='deliver';label='Send V'+c.rev+' for review';ico='send';extra=v.blocked?'disabled':'';break;
case 'blocked':if(c.versions.length) return btn('revise-note','Revise request','edit','outline');return '';
case 'review':return btn('adjust','Request changes','branch','outline')+btn('accept','Accept V'+c.rev,'check','primary');
case 'release':id='authorize';label='Authorize release';ico='verify';break;
case 'authorized':id='publish';label='Simulate release';ico='release';break;
default:return '';}
return btn(id,label,ico,c.stage==='draft'?'outline':'primary',extra);
}
function footer(c,v){
const next=v.kind==='hesitation'?({clarify:'Describe what gave you pause. The team will propose the wording.',processing:'Check the proposal against the requester’s concern, then send it for review.',review:'Use the review question with the requester, then accept this version or ask for changes.'}[c.stage]||meta[c.stage]):meta[c.stage];
return '<div class="action-strip"><div class="ownerline">'+avatar(c.owner)+'<div><b>'+esc(role(c.owner)[2])+'</b><p>'+esc(next)+'</p></div></div><div class="action-btns" id="actions">'+actions(c,v)+'</div></div>';}
function revisionList(c){return c.versions.length?'<div class="revision-list"><span>'+I('history',14)+'Version history</span>'+c.versions.map(a=>btn('ver:'+a.rev,'V'+a.rev,'file','revision-tag')).join('')+'</div>':'';}
function transport(){if(!tour)return '';
const f=tour.frames[tour.index];
return '<div class="transport"><span class="trackmark">'+I('play',14)+'</span><div class="tracktitle"><b>'+esc(tour.type==='create'?'The “Create” walkthrough':tour.type==='mine'?'Your feedback walkthrough':P.list.find(x=>x.id===tour.type).label+' walkthrough')+'</b><span>'+(tour.index+1)+' / '+tour.frames.length+' · '+esc(f.title)+'</span></div><div class="playtools">'+(tour.index?iconbtn('walkback','back','Previous step'):'<span class="disabled-icon">'+I('back')+'</span>')+iconbtn('toggle',tour.playing?'pause':tour.index===tour.frames.length-1?'replay':'play',tour.playing?'Pause':tour.index===tour.frames.length-1?'Replay':'Resume')+(tour.index<tour.frames.length-1?iconbtn('walknext','next','Next step'):'<span class="disabled-icon">'+I('next')+'</span>')+'</div><div class="t-progress" style="--done:'+((tour.index+1)/tour.frames.length*100)+'%"></div></div>';}
function createEntry(){
  return '<button class="case-tour-link" data-go="create-tour"><span class="tour-ico">'+I('play',12)+'</span><span><b>Explore “Create”</b><small>One unclear button, two different concerns</small></span>'+I('next',14)+'</button>';
}
function doc(c,v){
return '<div class="doc" id="doc">'+cover()+'<div class="docbody"><h1 id="title">'+esc(label(c))+'</h1><div class="properties"><span class="project-prop">'+fileTag()+'WinQuote</span><span class="prop-sep"></span>'+badge(c)+'<span class="prop-sep"></span><span class="person-prop">'+avatar(c.owner,16)+esc(role(c.owner)[2])+'</span></div>'+(tour?'':createEntry())+sourceArea(c)+related(c,v)+'<section class="candidate-block" id="candidate">'+candidateHTML(c,v)+'</section><button id="mobaside" class="mobile-insight" data-go="mobileaside" aria-label="View acceptance checks"></button>'+footer(c,v)+decisionDetail(c)+revisionList(c)+'</div></div>';
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
function activity(c){const rows=[...c.trail].reverse();return '<div class="ins-section"><div class="side-head"><h2>Activity log</h2><span class="sidecount">'+rows.length+'</span></div>'+(rows.length?'<ol class="activities">'+rows.map(x=>'<li>'+avatar(x.actor)+'<div><b>'+esc(x.actor)+'</b><p>'+esc(x.text)+'</p></div></li>').join('')+'</ol>':'<div class="pending-proof">'+I('history',20)+'<b>No activity yet</b><p>Submissions, handoffs, reviews and release decisions will appear here.</p></div>')+'</div>';}
function checkSummary(checks){
  const automatic=checks.filter(check=>check.status!=='manual');
  const manual=checks.length-automatic.length;
  const passed=automatic.filter(check=>check.status==='pass').length;
  const autoText=automatic.length?passed+'/'+automatic.length+' auto '+(automatic.length===1?'check':'checks')+' passed':'';
  return {autoText,manualText:manual?manual+' manual':'',hasFailed:automatic.some(check=>check.status==='fail')};
}
function mobileSummary(v){
  const {autoText,manualText,hasFailed}=checkSummary(v.checks);
  const label=v.question?'Awaiting clarification':([autoText,manualText].filter(Boolean).join(' · ')||'Acceptance checks');
  let detail='Details';
  if(v.limit!==null)detail=v.wordCount>v.limit?(v.wordCount-v.limit)+' words over':v.wordCount+' / '+v.limit+' words';
  return '<div class="ms-left">'+I(hasFailed?'hold':'rulers',15)+'<span>'+label+'</span></div><span class="ms-num">'+detail+I('next',12)+'</span>';
}
function inspectorContent(c,v){
if(tab==='activity')return activity(c);
const {autoText,manualText}=checkSummary(v.checks);
const title=v.question?'Awaiting clarification':(autoText||'Acceptance criteria');
const nextOwner={draft:'Website team',clarify:'Website team',processing:'Reviewer',blocked:'Website team',review:'Site owner',release:'Website team',authorized:'Complete',published:null}[c.stage];
const roles='<div class="ownership"><span class="handoff-avatar">'+avatar(c.owner,24)+'</span><div><b>'+esc(role(c.owner)[2])+'</b><span>Current owner</span></div></div>';
return '<div class="ins-section evidence"><div class="side-head"><h2>'+esc(title)+'</h2><span class="ai-label">'+(manualText||I('rulers',13)+'Live checks')+'</span></div>'+evidenceList(v)+'</div><div class="ins-section owner-section"><div class="side-head"><h2>Handoff</h2>'+I('branch',14)+'</div>'+roles+'<div class="handoff-next">'+(nextOwner&&nextOwner!==c.owner?I('branch',14)+'<span>Up next · '+esc(role(nextOwner)[2])+'</span>':'<span>'+(c.stage==='published'?'Simulated release recorded':'The website team is working on this')+'</span>')+'</div>'+(c.stage==='review'?'<p class="aside-note">Requesting changes sends this back to the website team.</p>':'')+'</div><div class="ins-section location"><div class="side-head"><h2>Page location</h2></div><button class="locator" data-go="location">'+fileTag()+'<span><b>WinQuote homepage</b><small>Quote entry</small></span>'+I('target',15)+'</button></div>';
}
function updateAside(c,v){$('sideinner').innerHTML=inspectorContent(c,v);const b=$('mobaside');if(b){b.innerHTML=mobileSummary(v);b.classList.toggle('warn',v.checks.some(x=>x.status==='fail'));}}
function decisionDetail(c){
if(!['release','authorized','published'].includes(c.stage))return '';
const label=c.stage==='published'?'Simulated release receipt':c.stage==='authorized'?'Release authorized':'Release request';
return '<div class="decision-detail">'+I(c.stage==='published'?'checks':'release',16)+'<div><b>'+label+' · V'+c.rev+'</b><p>'+esc(c.stage==='published'?'The release was simulated for the WinQuote homepage.':c.stage==='authorized'?'The site owner authorized release. The website team can run the simulation.':'Review complete. Awaiting release authorization.')+'</p></div></div>';
}
function caseMain(){
const c=here(), v=E.derive(c);
$('main').innerHTML=transport()+'<div class="workspace">'+doc(c,v)+'<aside class="inspector '+(asideOpen?'aside-open':'')+'" id="inspector" aria-label="Feedback panel"><div class="tabs" role="group" aria-label="Feedback panel tabs">'+btn('tab:checks','Acceptance checks','rulers','tab '+(tab==='checks'?'active':''))+btn('tab:activity','Activity','history','tab '+(tab==='activity'?'active':''))+'<button class="mobile-close iconbtn" data-go="mobileaside" aria-label="Close panel">'+I('cross')+'</button></div><div id="sideinner"></div></aside></div>';
if($('quick'))$('quick').innerHTML=quick(v);
updateAside(c,v);
if(priorOwner&&priorOwner!==c.owner){document.querySelector('.handoff-avatar')?.classList.add('handed');document.querySelector('.ownerline>.avatar')?.classList.add('handed');}
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
  }else{let f=P.start(type);frames.push(f);while(!f.done){f=P.next(f);frames.push(f);}}
  tour={record:data.current,type,frames,index:0,playing:false};
  setPlay(frames.length>1);render();announce('Walkthrough started.');
}
function clarificationPrefix(){
  if(!tour||!['mine','create'].includes(tour.type))return null;
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
  const index=head.length;
  head.push({case:c,title:choseConcern?(c.stage==='blocked'?'Website team investigates the concern':'Website team proposes new copy'):'Your walkthrough answer: '+raw});
  tour.frames=appendSteps(head,c);tour.index=index;
  close();activeSource=-1;tab='checks';asideOpen=false;
  setPlay(!choseConcern&&tour.index<tour.frames.length-1);render();
  if(choseConcern){
    const target=$('candidate'),heading=target.querySelector('h2');
    target.classList.add('reconsidered');heading.tabIndex=-1;heading.focus({preventScroll:true});
    if(heading.getBoundingClientRect().top>=window.innerHeight)heading.scrollIntoView({block:'center'});
  }
  announce(c.stage==='blocked'?'The website team needs to investigate this answer.':'The draft and checks now reflect your answer.');
}
function selectCase(id){endTour();if(!data.items.some(x=>x.id===id))return;data.current=id;save();page='case';filter='all';tab='checks';activeSource=-1;render();}
function newItem(text=''){endTour();const id='WQ-'+String(++data.serial).padStart(3,'0');data.items.unshift({id,c:E.createCase(text)});selectCase(id);if(!text)$('source')?.focus();}
function apply(action,val){
if(tour)return;const item=selected();const next=E.transition(item.c,action,val);
if(next===item.c){announce('This action is unavailable at the current stage.');return;}item.c=next;save();activeSource=-1;close();render();announce(next.trail.at(-1)?.text||stages[next.stage]);}
function syncSource(text){
const item=selected(),c=item.c;if(tour||c.versions.length)return;
const prior=E.derive(c);const n=E.editSource(c,text),v=E.derive(n);item.c=n;save();

$('candidate').innerHTML=candidateHTML(n,v);$('title').textContent=label(n);
if($('quick'))$('quick').innerHTML=quick(v);
updateAside(n,v);

const p=document.querySelector('.properties .state');if(p)p.outerHTML=badge(n);
const foot=document.querySelector('.action-strip');if(foot)foot.outerHTML=footer(n,v);
const pp=document.querySelector('.person-prop');if(pp)pp.innerHTML=avatar(n.owner,16)+esc(role(n.owner)[2]);
const w=document.querySelector('[data-go="walk"]');if(w)w.disabled=!text.trim();
if(prior.candidate!==v.candidate||prior.limit!==v.limit){
const oldFrags=fragCandidate(prior.candidate);
document.querySelectorAll('[data-frag]').forEach(el=>{if(!oldFrags.includes(el.textContent))el.classList.add('pulse');});
if(v.kind==='button')document.querySelector('.button-proof')?.classList.add('pulse');
document.querySelectorAll('.checkrow').forEach((row,i)=>{if(v.checks[i]?.value!==prior.checks[i]?.value||v.checks[i]?.label!==prior.checks[i]?.label)row.classList.add('pulse');});
}
if(c.stage!==n.stage)renderNav();}
function exampleMenu(){dialog('<div class="dlgrows">'+examples.map(([t,s],i)=>'<button data-go="sample:'+i+'">'+I(i===0?'file':i===1?'edit':i===2?'ask':'hold')+'<span><b>'+esc(t)+'</b><small>'+esc(s)+'</small></span>'+I('next',14)+'</button>').join('')+'</div>','Choose a feedback example');}
function personaMenu(){dialog('<p class="dlgdesc">Choose a role to follow a sample from one handoff to the next.</p><div class="dlgrows">'+P.list.map((x,i)=>'<button data-go="persona:'+x.id+'">'+avatar(['Requester','Website team','Site owner'][i])+'<span><b>'+esc(x.label)+'</b><small>'+esc(x.description)+'</small></span>'+I('play',15)+'</button>').join('')+'</div>','Choose a walkthrough');}
function doAction(g){
const [k,arg]=g.split(':');if(!['nav','mobileaside'].includes(k)){navOpen=false;$('nav').classList.remove('show');$('shade').hidden=true;}
if(tour?.playing&&['tab','evidence','mobileaside','location','ver'].includes(k)&&E.derive(here()).kind==='hesitation'){setPlay(false);render();}
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
case 'tab':tab=arg;activeSource=-1;caseMain();return;
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
if(launchURL.searchParams.get('walkthrough')==='create'){
  launchURL.searchParams.delete('walkthrough');
  history.replaceState(history.state,'',launchURL.href);
  if(tour?.type==='create')render();else begin('create');
}else render();
})();
