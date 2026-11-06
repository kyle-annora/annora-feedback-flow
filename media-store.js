/* Local evidence only. Binary originals never enter the public bundle or JSON case snapshots. */
(function (root) {
  'use strict';
  const DB_NAME = 'annora-feedback-media';
  const copy = value => JSON.parse(JSON.stringify(value));
  const limits = Object.freeze({images:3,imageBytes:10*1024*1024,audioSeconds:120,audioBytes:20*1024*1024});
  function failure(error, fallback) {
    const full = error?.name === 'QuotaExceededError'
      ? 'This device has no space for this attachment. Remove it or free some storage, then retry.'
      : error?.name === 'SecurityError' || error?.name === 'InvalidStateError'
        ? 'Local storage is unavailable. Keep this window open and try again, or use another browser.'
        : fallback || error?.message || 'The attachment could not be saved. Please retry.';
    const result = new Error(full); result.name = error?.name || 'MediaStorageError'; result.cause = error; return result;
  }
  function validate(blob, meta = {}) {
    if (!blob || typeof blob.size !== 'number' || typeof blob.slice !== 'function' || blob.size < 1) throw new Error('Choose a file that contains an image or audio.');
    const mime = String(blob.type || '').toLowerCase().split(';')[0];
    const kind = /^image\/(png|jpeg|webp|gif)$/.test(mime) ? 'image' : /^audio\/(webm|ogg|mpeg|mp4|wav|x-wav|wave|aac|x-m4a|flac)$/.test(mime) ? 'audio' : null;
    if (!kind || (meta.kind && meta.kind !== kind)) throw new Error('Use a PNG, JPG, WebP or GIF image, or a playable audio file.');
    if (blob.size > (kind === 'image' ? limits.imageBytes : limits.audioBytes)) throw new Error(kind === 'image' ? 'Each image must be 10 MB or smaller.' : 'Choose an audio file under 20 MB and 2 minutes.');
    if (kind === 'audio' && (!Number.isFinite(meta.duration) || meta.duration <= 0 || meta.duration > limits.audioSeconds + .5)) throw new Error('Audio must be playable and no longer than 2 minutes.');
    return kind;
  }
  function createStore(options = {}) {
    const indexedDB = options.indexedDB === undefined ? root.indexedDB : options.indexedDB;
    const now = options.now || (() => new Date().toISOString());
    const newId = options.id || (() => 'media-' + (root.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)));
    let pending;
    function open() {
      if (!indexedDB) return Promise.reject(failure({name:'SecurityError'}));
      if (!pending) pending = new Promise((resolve,reject) => {
        const request = indexedDB.open(options.name || DB_NAME, 1);
        request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('media')) db.createObjectStore('media',{keyPath:'id'}); if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts',{keyPath:'key'}); };
        request.onerror = () => { pending = null; reject(failure(request.error)); };
        request.onblocked = () => { pending = null; reject(new Error('Close another feedback tab to finish opening local attachment storage, then retry.')); };
        request.onsuccess = () => { const db = request.result; db.onversionchange = () => {db.close();pending=null;}; resolve(db); };
      });
      return pending;
    }
    async function transaction(stores, mode, work) {
      const db = await open();
      return new Promise((resolve,reject) => {
        let result, ownError;
        const tx = db.transaction(stores,mode);
        const control = {set:value=>{result=value;},abort:error=>{ownError=error;tx.abort();}};
        tx.oncomplete = () => resolve(result);
        tx.onabort = tx.onerror = () => reject(failure(ownError || tx.error));
        try { work(tx,control); } catch(error) { ownError=error;try{tx.abort();}catch{}reject(failure(error)); }
      });
    }
    async function put(blob, meta = {}) {
      const kind=validate(blob,meta), id=newId();
      const manifest={id,blobKey:id,kind,mime:blob.type,name:String(meta.name || blob.name || (kind==='audio'?'Voice feedback':'Image')).replace(/[\u0000-\u001f]/g,'').slice(0,120),size:blob.size,createdAt:now(),source:['upload','paste','drop','recording'].includes(meta.source)?meta.source:'upload',localOnly:true,...(kind==='audio'?{duration:Math.min(meta.duration,limits.audioSeconds)}:{})};
      await transaction(['media'],'readwrite',(tx,c)=>{tx.objectStore('media').add({id,blob,manifest,references:[]});c.set(copy(manifest));});
      return Object.freeze(copy(manifest));
    }
    async function get(id) {
      return transaction(['media'],'readonly',(tx,c)=>{const request=tx.objectStore('media').get(id);request.onsuccess=()=>{if(!request.result){c.abort(new Error('This attachment is no longer on this device. Remove it or add the original again.'));return;}c.set({manifest:copy(request.result.manifest),blob:request.result.blob});};});
    }
    async function getDraft(key) {
      return transaction(['drafts'],'readonly',(tx,c)=>{const request=tx.objectStore('drafts').get(key);request.onsuccess=()=>c.set(request.result?copy(request.result.value):null);});
    }
    async function saveDraft(key, value) {
      if (!key || typeof key!=='string') throw new Error('A draft key is required.');
      const draft=copy(value), ids=new Set((draft.attachments||[]).map(a=>a.id));
      return transaction(['drafts','media'],'readwrite',(tx,c)=>{
        const drafts=tx.objectStore('drafts'), media=tx.objectStore('media'), old=drafts.get(key);
        old.onsuccess=()=>{
          const previous=new Set((old.result?.value.attachments||[]).map(a=>a.id));
          for(const id of new Set([...previous,...ids])){const req=media.get(id);req.onsuccess=()=>{
            if(!req.result){if(ids.has(id))c.abort(new Error('An attachment is missing. Remove it or add it again before saving.'));return;}
            const entry=req.result,refs=new Set(entry.references||[]);refs.delete('draft:'+key);if(ids.has(id))refs.add('draft:'+key);entry.references=[...refs];media.put(entry);
          };}
          drafts.put({key,value:draft,updatedAt:now()});c.set(copy(draft));
        };
      });
    }
    async function claim(ids, reference) {
      if (!reference) throw new Error('An evidence reference is required.');
      return transaction(['media'],'readwrite',(tx,c)=>{const media=tx.objectStore('media');for(const id of new Set(ids)){const req=media.get(id);req.onsuccess=()=>{if(!req.result){c.abort(new Error('An attachment is missing. Add it again before submitting.'));return;}const entry=req.result;entry.references=[...new Set([...(entry.references||[]),'submission:'+reference])];media.put(entry);};}});
    }
    async function clearDraft(key) {
      return transaction(['drafts','media'],'readwrite',(tx)=>{const drafts=tx.objectStore('drafts'),media=tx.objectStore('media'),req=drafts.get(key);req.onsuccess=()=>{for(const attachment of req.result?.value.attachments||[]){const r=media.get(attachment.id);r.onsuccess=()=>{if(r.result){const entry=r.result;entry.references=(entry.references||[]).filter(ref=>ref!=='draft:'+key);media.put(entry);}};}drafts.delete(key);};});
    }
    async function remove(id) {
      return transaction(['media'],'readwrite',(tx,c)=>{const media=tx.objectStore('media'),r=media.get(id);r.onsuccess=()=>{if(!r.result){c.set(true);return;}if(r.result.references?.length){c.set(false);return;}media.delete(id);c.set(true);};});
    }
    return {open,put,get,getDraft,saveDraft,claim,clearDraft,remove};
  }
  const api={...createStore(),createStore,validate,limits,failure};
  root.FeedbackMediaStore=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
