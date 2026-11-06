const test=require('node:test');
const assert=require('node:assert/strict');
const {createRecorder,inspect}=require('./capture-media.js');
function harness(options={}){
 const tracks=[{stops:0,stop(){this.stops++;}}],stream={getTracks:()=>tracks};let instance,now=0,timeout,ticks,completed=[],errors=[];
 class Recorder{static isTypeSupported(type){return type.includes('webm');}constructor(_,config){instance=this;this.mimeType=config?.mimeType||'audio/webm';this.state='inactive';}start(){if(options.startError)throw new Error('cannot start');this.state='recording';}stop(){this.state='inactive';if(options.deferStop)return;this.flush();}flush(){this.ondataavailable?.({data:new Blob(options.empty?[]:['voice bytes'],{type:this.mimeType})});this.onstop?.();}}
 const recorder=createRecorder({navigator:{mediaDevices:{getUserMedia:options.getUserMedia||(()=>Promise.resolve(stream))}},MediaRecorder:Recorder,now:()=>now,setTimeout:fn=>(timeout=fn,1),clearTimeout:()=>{timeout=null;},setInterval:fn=>(ticks=fn,2),clearInterval:()=>{ticks=null;},onComplete:value=>completed.push(value),onError:error=>errors.push(error)});
 return {recorder,stream,tracks,completed,errors,get instance(){return instance;},setTime:t=>{now=t;},timer:()=>timeout?.(),get timerActive(){return Boolean(timeout);},get ticksActive(){return Boolean(ticks);}};
}
test('recording obtains real permission on start, emits playable blob bytes and releases tracks/timers',async()=>{
 let requests=0;const h=harness();assert.equal(h.recorder.state,'idle');assert.equal(h.tracks[0].stops,0);await h.recorder.start();assert.equal(h.recorder.state,'recording');h.setTime(2100);const result=await h.recorder.stop();assert.equal(result.duration,2.1);assert.equal(await result.blob.text(),'voice bytes');assert.equal(h.completed.length,1);assert.equal(h.tracks[0].stops,1);assert.equal(h.timerActive,false);assert.equal(h.ticksActive,false);
});
test('permission rejection is recoverable, while cancellation releases a late permitted stream',async()=>{
 const denied=harness({getUserMedia:()=>Promise.reject({name:'NotAllowedError'})});await assert.rejects(denied.recorder.start(),/not allowed/);assert.equal(denied.recorder.state,'idle');
 let allow;const h=harness({getUserMedia:()=>new Promise(resolve=>{allow=resolve;})});const start=h.recorder.start();assert.equal(h.recorder.state,'requesting');h.recorder.cancel();allow(h.stream);await start;assert.equal(h.tracks[0].stops,1);assert.equal(h.completed.length,0);assert.equal(h.recorder.state,'idle');
});
test('cancel and recorder error never accidentally attach late data',async()=>{
 const cancelled=harness({deferStop:true});await cancelled.recorder.start();cancelled.recorder.cancel();cancelled.instance.flush();assert.equal(cancelled.completed.length,0);assert.equal(cancelled.tracks[0].stops,1);
 const broken=harness({deferStop:true});await broken.recorder.start();broken.instance.onerror({error:{name:'NotReadableError'}});broken.instance.flush();assert.equal(broken.completed.length,0);assert.match(broken.errors[0].message,/unavailable/);assert.equal(broken.recorder.state,'idle');assert.equal(broken.tracks[0].stops,1);
});
test('automatic stop honors the two minute limit and empty recordings cannot submit',async()=>{
 const h=harness();await h.recorder.start();h.setTime(120000);h.timer();assert.equal(h.completed.length,1);assert.equal(h.completed[0].duration,120);
 const empty=harness({empty:true});await empty.recorder.start();await assert.rejects(empty.recorder.stop(),/empty/);assert.equal(empty.completed.length,0);
 const late=harness();await late.recorder.start();late.setTime(122000);await assert.rejects(late.recorder.stop(),/exceeded/);assert.equal(late.completed.length,0);
});
test('a failed start or previous cancelled session cannot poison the next recording',async()=>{
 const failure=harness({startError:true});await assert.rejects(failure.recorder.start(),/cannot start/);assert.equal(failure.tracks[0].stops,1);assert.equal(failure.recorder.state,'idle');
 const h=harness({deferStop:true});await h.recorder.start();const old=h.instance;h.recorder.cancel();await h.recorder.start();old.flush();assert.equal(h.recorder.state,'recording');h.setTime(1000);const stopped=h.recorder.stop();h.instance.flush();await stopped;assert.equal(h.completed.length,1);
});
function inspectEnvironment({duration=15,imageError=false}={}){const released=[],media=[];class Image{constructor(){media.push(this);}set src(value){this.naturalWidth=80;this.naturalHeight=40;queueMicrotask(()=>imageError?this.onerror?.():this.onload?.());}}const environment={URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:url=>released.push(url)},Image,document:{createElement(){const audio={duration,removeAttribute(){},load(){},set src(value){queueMicrotask(()=>this.onloadedmetadata?.());}};media.push(audio);return audio;}},setTimeout:()=>1,clearTimeout(){}};return {environment,released};}
test('file fallback validates decode/duration and revokes temporary object URLs',async()=>{
 const image=inspectEnvironment();assert.equal((await inspect(new Blob(['png'],{type:'image/png'}),image)).width,80);assert.deepEqual(image.released,['blob:fixture']);
 const broken=inspectEnvironment({imageError:true});await assert.rejects(inspect(new Blob(['broken'],{type:'image/png'}),broken),/playable/);assert.equal(broken.released.length,1);
 const audio=inspectEnvironment({duration:121});await assert.rejects(inspect(new Blob(['wav'],{type:'audio/wav'}),audio),/2 minutes/);assert.equal(audio.released.length,1);
 const valid=inspectEnvironment();assert.equal((await inspect(new Blob(['wav'],{type:'audio/wav'}),valid)).duration,15);
});
