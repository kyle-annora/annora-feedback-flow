/* Browser media lifecycle. Permission is requested only by the caller's explicit Record action. */
(function(root){
 'use strict';
 const Store=typeof module==='object'&&module.exports?require('./media-store.js'):root.FeedbackMediaStore;
 function readableError(error){const m={NotAllowedError:'Microphone access was not allowed. You can try again or attach an audio file.',NotFoundError:'No microphone was found. Attach an audio file or describe the issue.',NotReadableError:'The microphone is busy or unavailable. Close the other recording app and retry.',SecurityError:'Recording is unavailable here. Open this demo over HTTPS or localhost, or attach an audio file.'};return new Error(m[error?.name]||error?.message||'Recording did not finish. Try again or attach an audio file.');}
 function createRecorder(options={}){
  const nav=options.navigator||root.navigator,Recorder=options.MediaRecorder||root.MediaRecorder;
  const clock=options.now||(()=>Date.now()),later=options.setTimeout||root.setTimeout,clear=options.clearTimeout||root.clearTimeout;
  let current=null,generation=0;
  let state='idle';
  const report=()=>options.onState?.({state,seconds:state==='recording'?Math.min(120,(clock()-current.started)/1000):0});
  function release(session){session.stream?.getTracks().forEach(track=>track.stop());session.stream=null;clear(session.timer);if(session.interval!==undefined)(options.clearInterval||root.clearInterval)(session.interval);}
  function finish(session,error,value){if(session.finished)return;session.finished=true;release(session);if(current===session){state='idle';report();}if(error){session.reject?.(error);options.onError?.(error);}else{session.resolve?.(value);if(value&&!session.cancelled)options.onComplete?.(value);}}
  async function start(){
   if(state==='requesting'||state==='recording'||state==='stopping')throw new Error('Finish the current recording first.');
   if(!nav?.mediaDevices?.getUserMedia||!Recorder)throw readableError({name:'SecurityError'});
   const session={token:++generation,chunks:[],cancelled:false,finished:false};current=session;state='requesting';report();
   try{
    const result=await nav.mediaDevices.getUserMedia({audio:true,video:false});
    if(session.token!==generation||session.cancelled){result.getTracks().forEach(t=>t.stop());return;}
    session.stream=result;const supported=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type=>Recorder.isTypeSupported?.(type));
    const recorder=session.recorder=supported?new Recorder(result,{mimeType:supported}):new Recorder(result);session.started=clock();
    session.promise=new Promise((resolve,reject)=>{session.resolve=resolve;session.reject=reject;});session.promise.catch(()=>{});
    recorder.ondataavailable=event=>{if(!session.finished&&event.data?.size)session.chunks.push(event.data);};
    recorder.onerror=event=>finish(session,readableError(event.error));
    recorder.onstop=()=>{if(session.finished)return;if(session.cancelled){finish(session,null,null);return;}const duration=Math.max(.01,(clock()-session.started)/1000),blob=new Blob(session.chunks,{type:recorder.mimeType||session.chunks[0]?.type||'audio/webm'});session.chunks=[];if(!blob.size){finish(session,new Error('The recording was empty. Try again or attach an audio file.'));return;}if(duration>120.5){finish(session,new Error('The recording exceeded 2 minutes. Please record a shorter note.'));return;}finish(session,null,{blob,duration,name:'Voice feedback.'+(blob.type.includes('mp4')?'m4a':blob.type.includes('ogg')?'ogg':'webm')});};
    recorder.start(1000);state='recording';report();
    session.timer=later(()=>stop().catch(()=>{}),Store.limits.audioSeconds*1000);
    session.interval=(options.setInterval||root.setInterval)(report,250);
   }catch(error){const readable=readableError(error);if(session.token!==generation||session.cancelled)return;finish(session,readable);throw readable;}
  }
  function stop(){if(state==='requesting'){cancel();return Promise.resolve(null);}if(state!=='recording')return current?.promise||Promise.resolve(null);state='stopping';report();try{current.recorder.stop();}catch(error){finish(current,readableError(error));}return current.promise;}
  function cancel(){++generation;const session=current;if(session){session.cancelled=true;finish(session,null,null);if(session.recorder?.state==='recording'||session.recorder?.state==='paused')try{session.recorder.stop();}catch{}}state='idle';report();}
  return {start,stop,cancel,destroy:cancel,get state(){return state;}};
 }
 function inspect(blob,{environment=root}={}){
  const kind=String(blob.type||'').startsWith('image/')?'image':'audio';
  if(kind==='image')Store.validate(blob,{kind});
  else if(!/^audio\//.test(blob.type||'')||blob.size>Store.limits.audioBytes)throw new Error('Choose an audio file under 20 MB and 2 minutes.');
  return new Promise((resolve,reject)=>{
   const url=environment.URL.createObjectURL(blob),media=kind==='image'?new environment.Image():environment.document.createElement('audio');let finished=false;
   const timer=environment.setTimeout(()=>finish(new Error('This file could not be read. Try another image or audio file.')),10000);
   function finish(error,value){if(finished)return;finished=true;environment.clearTimeout(timer);media.onload=media.onloadedmetadata=media.onerror=null;if(kind==='audio'){media.removeAttribute('src');media.load?.();}environment.URL.revokeObjectURL(url);error?reject(error):resolve(value);}
   media.onerror=()=>finish(new Error('This file is not playable. Try another image or audio file.'));
   if(kind==='image')media.onload=()=>{if(!media.naturalWidth||!media.naturalHeight)finish(new Error('This image could not be read.'));else finish(null,{kind,width:media.naturalWidth,height:media.naturalHeight});};
   else{media.preload='metadata';media.onloadedmetadata=()=>{try{Store.validate(blob,{kind,duration:media.duration});finish(null,{kind,duration:media.duration});}catch(error){finish(error);}};}
   media.src=url;
  });
 }
 const api={createRecorder,inspect,readableError};root.FeedbackCaptureMedia=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
