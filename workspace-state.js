/* Customer workspace metadata and local navigation guards. This is not access control. */
(function(root){
"use strict";
const DEFAULT_CLIENT = "winquote";
const SEED_IDS = new Set(["WQ-015","WQ-016","WQ-017","WQ-018"]);
const has = (value,key) => Object.prototype.hasOwnProperty.call(value,key);
const clientIdOf = item => has(item,"clientId") ? item.clientId : DEFAULT_CLIENT;
const records = value => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];

function migrate(workspace,{exampleIds=[]}={}) {
  const examples = new Set(exampleIds);
  return {...workspace,items:records(workspace).map(item=>{
    const clientId = clientIdOf(item), context = item.c?.reviewFlow?.context;
    const customer = item.submissionOrigin==="customer" || item.captureSubmission===true || item.curatedDemo===true ||
      (context && has(context,"occurredAt"));
    let demoOnly, legacyUnassigned = false;
    if (has(item,"clientId") && clientId!==DEFAULT_CLIENT && has(item,"demoOnly")) demoOnly = item.demoOnly;
    else if (item.submissionOrigin==="example" || (item.demoOnly===true && !item.legacyUnassigned)) demoOnly = true;
    else if (customer) demoOnly = false;
    else if (SEED_IDS.has(item.id) || examples.has(item.id)) demoOnly = true;
    else { demoOnly = true; legacyUnassigned = true; }
    return {...item,clientId,demoOnly,...(legacyUnassigned ? {legacyUnassigned:true} : has(item,"legacyUnassigned") ? {legacyUnassigned:false} : {})};
  })};
}

function items(workspaceOrItems,clientId=DEFAULT_CLIENT) {
  return records(workspaceOrItems).filter(item=>clientIdOf(item)===clientId && item.demoOnly!==true);
}

function canResume(recordId,clientId=DEFAULT_CLIENT,workspaceOrItems,expectedId) {
  if (typeof recordId!=="string" || !recordId || (expectedId!==undefined && recordId!==expectedId)) return false;
  return records(workspaceOrItems).some(item=>item.id===recordId && clientIdOf(item)===clientId);
}

function canResumeShowcase(state,record,currentId,clientId=DEFAULT_CLIENT) {
  return !!(state?.c && record?.curatedDemo===true && state.id===record.id && record.id===currentId &&
    clientIdOf(state)===clientId && clientIdOf(record)===clientId);
}

const api = {migrate,items,canResume,canResumeShowcase};
root.WorkspaceState = api;
if (typeof module==="object" && module.exports) module.exports = api;
})(globalThis);
