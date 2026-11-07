const test=require('node:test');
const assert=require('node:assert/strict');
const {contextForAttachments,mergePageContext,payload}=require('./capture-composer.js');
test('capture context belongs only to its attached image, with unrelated context unchanged',()=>{
 const original={ticket:'WQ-021',revision:2,selection:{label:'Generate PDF'},screenCapture:{kind:'Legacy unbound claim'},screenCaptures:{one:{kind:'Shared tab screenshot',crop:{x:10}},two:{kind:'Shared tab screenshot'},audio:{kind:'Wrong kind'},missing:{kind:'Detached screenshot'}}};
 const attachments=[{id:'one',kind:'image'},{id:'two',kind:'image'},{id:'audio',kind:'audio'}];
 const both=contextForAttachments(original,attachments);assert.deepEqual(Object.keys(both.screenCaptures),['one','two']);assert.equal('screenCapture' in both,false);assert.equal(both.ticket,'WQ-021');assert.equal(both.revision,2);
 const removed=contextForAttachments(both,attachments.filter(a=>a.id!=='one'));assert.deepEqual(Object.keys(removed.screenCaptures),['two']);assert.equal(original.screenCaptures.one.crop.x,10);
 const none=contextForAttachments(removed,[]);assert.equal('screenCaptures' in none,false);assert.deepEqual(none.selection,{label:'Generate PDF'});
});
test('submitted capture metadata is independently snapshotted and cannot claim a missing file',()=>{
 const source={captureId:'c',text:'PDF issue',attachments:[{id:'one',kind:'image'}],context:{screenCaptures:{one:{kind:'Shared tab screenshot',width:800},lost:{kind:'Missing file'}}}};
 const submitted=payload(source);source.context.screenCaptures.one.width=20;assert.equal(submitted.context.screenCaptures.one.width,800);assert.equal('lost' in submitted.context.screenCaptures,false);
});

test('explicit recapture refreshes page state without crossing the original ticket or version',()=>{
 const old={ticket:'WQ-021',revision:1,scenarioId:'pdf',state:{pdfGenerated:false},capturedAt:'before',selection:{label:'PDF action'},screenCaptures:{one:{kind:'Shared tab screenshot'}}};
 const updated=mergePageContext(old,{ticket:'other',revision:7,scenarioId:'different',state:{pdfGenerated:true},capturedAt:'after'});
 assert.equal(updated.ticket,'WQ-021');assert.equal(updated.revision,1);assert.equal(updated.scenarioId,'pdf');assert.equal(updated.state.pdfGenerated,true);assert.equal(updated.capturedAt,'after');assert.deepEqual(updated.selection,old.selection);assert.deepEqual(updated.screenCaptures,old.screenCaptures);assert.equal(old.state.pdfGenerated,false);
 assert.deepEqual(mergePageContext(old,null),old);
});
