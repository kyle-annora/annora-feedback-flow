const test=require('node:test');
const assert=require('node:assert/strict');
const Context=require('./capture-context.js');
const Composer=require('./capture-composer.js');
test('context is allowlisted, snapshotted, and excludes credentials, query values and storage',()=>{
 const source={page:'Make PDF',quoteId:'MW-1042',token:'secret',customerEmail:'private',state:{generated:true,unsaved:true,auth:'secret',nested:{a:1}}};
 const context=Context.capture(source,{location:{pathname:'/quote/pdf',search:'?token=secret',hash:'#private'},innerWidth:1440,innerHeight:900,localStorage:{auth:'secret'}});source.state.generated=false;
 assert.equal(context.state.generated,true);assert.deepEqual(context.state,{unsaved:true,generated:true});assert.equal(context.route,'/quote/pdf');assert.equal(JSON.stringify(context).includes('secret'),false);assert.equal(context.localOnly,true);
});
function element(attributes={},privateArea=false){return {tagName:'BUTTON',textContent:'Private generic text never capture',closest:()=>privateArea?{}:null,getAttribute:key=>attributes[key],getBoundingClientRect:()=>({x:1.2,y:2.8,width:80,height:40})};}
test('selection records only explicitly safe DOM context and never claims code or screenshot',()=>{
 const selected=Context.selection(element({'data-feedback-label':'Generate PDF','data-feedback-component':'QuotePdfAction','data-feedback-text':'Open the saved PDF'}));assert.equal(selected.label,'Generate PDF');assert.equal(selected.component,'QuotePdfAction');assert.equal(selected.excerpt,'Open the saved PDF');assert.equal(selected.screenshot,false);assert.equal(selected.sourceCode,false);assert.equal(Context.selection(element()).excerpt,'');assert.equal(Context.selection(element({},true)),null);
});
test('current demo equipment state and named capture regions survive the explicit allowlist',()=>{
 const context=Context.capture({state:{noRefrigeration:true,savedNoRefrigeration:false,hasUnsavedChanges:true,equipment:'Rooftop unit',cost:4200,pdfGenerated:false,sessionToken:'secret'}},{});
 assert.equal(context.state.savedNoRefrigeration,false);assert.equal(context.state.hasUnsavedChanges,true);assert.equal(context.state.equipment,'Rooftop unit');assert.equal('sessionToken' in context.state,false);assert.equal(Context.selection(element({'data-capture-region':'Refrigeration options'})).label,'Refrigeration options');
});
test('adjustment context preserves its ticket and source version without arbitrary host data',()=>{
 const context=Context.capture({page:'WinQuote',ticket:'WQ-021',revision:2,internalSecrets:'omit'},{});assert.equal(context.ticket,'WQ-021');assert.equal(context.revision,2);assert.equal('internalSecrets' in context,false);
});
test('media-only feedback is valid, text and evidence snapshots remain independent, no false transcription',()=>{
 const draft={captureId:'capture-123',text:'',when:'just-now',context:{page:'PDF'},attachments:[{id:'local-image',kind:'image'}]};const result=Composer.payload(draft);assert.equal(result.text,'');assert.equal(result.occurredAt,'Just now');assert.equal('transcript' in result,false);assert.equal(result.captureId,'capture-123');draft.attachments[0].id='changed';assert.equal(result.attachments[0].id,'local-image');
 assert.throws(()=>Composer.payload({text:'',attachments:[]}),/Describe/);assert.throws(()=>Composer.payload({text:'a'.repeat(2001)}),/2,000/);
});
test('three image limit is actionable and requester-written transcript stays explicitly attributed',()=>{
 assert.throws(()=>Composer.canAdd([{kind:'image'},{kind:'image'},{kind:'image'}],'image'),/up to 3/);assert.doesNotThrow(()=>Composer.canAdd([{kind:'image'},{kind:'audio'}],'image'));
 const result=Composer.payload({text:'Issue',transcript:'I typed this',attachments:[]});assert.deepEqual(result.transcript,{text:'I typed this',source:'requester-written',generated:false});
});
