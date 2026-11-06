/* Local authored-result interaction, not a workflow or a pricing engine. */
(function(root){
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const fail = message => { throw new Error("Result preview: " + message); };
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  function amount(value,label) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(label + " must be a finite nonnegative demo amount.");
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
  function equipment(items,label) {
    if (!Array.isArray(items)) fail(label + " must be an equipment array.");
    const ids = new Set();
    return items.map(item=>{
      if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id)) fail("Equipment needs unique ids within each compartment.");
      ids.add(item.id);
      return {...clone(item),label:String(item.label || item.id),amount:amount(item.amount,"Equipment amount")};
    });
  }
  function check(state) {
    if (!state || state.schema !== 1 || !["compartment","refrigeration"].includes(state.type) || !Array.isArray(state.compartments) || !state.compartments.length) fail("Open a supported compartment or refrigeration result first.");
    if (!state.compartments.some(c=>c.id === state.selectedId)) fail("The selected compartment is unavailable in this result.");
    if (state.type === "refrigeration" && !["reselect","restore"].includes(state.policy)) fail("Choose an authored refrigeration policy.");
  }
  function dirty(c) {
    return c.draftNoRefrigeration !== c.savedNoRefrigeration || !same(c.draftEquipment,c.equipment);
  }
  function create(preview) {
    if (!preview || preview.interactive !== true || !["compartment","refrigeration"].includes(preview.type)) fail("This candidate has no supported authored result interaction.");
    const config = preview.configuration;
    if (!config || !Array.isArray(config.compartments) || !config.compartments.length) fail("The authored result needs its compartment configuration.");
    const ids = new Set(), compartments = config.compartments.map(raw=>{
      if (!raw || typeof raw.id !== "string" || !raw.id || ids.has(raw.id)) fail("Compartment ids must be present and unique.");
      ids.add(raw.id);
      const c = clone(raw);
      if (preview.type === "compartment") {
        if (typeof c.title !== "string" || !c.title.trim()) fail("Each editable card needs its actual title.");
        return c;
      }
      const available = equipment(c.availableEquipment || c.equipment || [],"Available equipment"), starting = equipment(c.equipment || [],"Starting equipment");
      if (starting.some(unit=>!available.some(option=>option.id === unit.id))) fail("Starting equipment must be available in this authored fixture.");
      const noRefrigeration = c.noRefrigeration === true;
      return {...c,baseAmount:amount(c.baseAmount,"Compartment base amount"),availableEquipment:available,
        equipment:noRefrigeration ? [] : clone(starting),priorEquipment:config.policy === "restore" ? clone(starting) : [],
        draftEquipment:noRefrigeration ? [] : clone(starting),savedNoRefrigeration:noRefrigeration,draftNoRefrigeration:noRefrigeration,
        noRefrigeration,equipmentEdited:false,dirty:false,needsEquipment:!noRefrigeration && !starting.length};
    });
    const state = {schema:1,type:preview.type,scenarioId:preview.scenarioId || preview.type,variantId:preview.variantId || null,
      selectedId:config.activeCompartmentId || compartments[0].id,compartments,
      ...(preview.type === "refrigeration" ? {policy:config.policy,currency:config.currency || "USD",dataLabel:config.dataLabel || "Illustrative demo amounts"} : {grouped:config.grouped === true,repeatLabels:config.repeatLabels === true,editableTitles:config.editableTitles === true,persistence:config.persistence || "preview-session"}),
      simulated:true,implemented:false,verified:false};
    check(state);return state;
  }
  function update(input,action,value) {
    check(input);
    const state = clone(input), selected = state.compartments.find(c=>c.id === state.selectedId);
    switch(action) {
      case "select-compartment":
        if (typeof value !== "string" || !state.compartments.some(c=>c.id === value)) fail("Select a compartment from this result.");
        state.selectedId = value;break;
      case "title":
        if (state.type !== "compartment" || !state.editableTitles) fail("This result does not support editing specification titles.");
        if (typeof value !== "string" || !value.trim() || value.length > 160) fail("Enter a title between 1 and 160 characters.");
        selected.title = value;break;
      case "toggle":
        if (state.type !== "refrigeration" || typeof value !== "boolean") fail("Set the no-refrigeration checkbox explicitly to true or false.");
        selected.draftNoRefrigeration = value;selected.dirty = dirty(selected);break;
      case "select-equipment": {
        if (state.type !== "refrigeration") fail("Equipment selection belongs to the refrigeration result.");
        if (selected.draftNoRefrigeration) fail("Clear No Refrigeration Required before selecting equipment.");
        const ids = typeof value === "string" ? [value] : value;
        if (!Array.isArray(ids) || ids.some(id=>typeof id !== "string") || new Set(ids).size !== ids.length) fail("Select distinct equipment ids from this authored fixture.");
        const units = ids.map(id=>selected.availableEquipment.find(unit=>unit.id === id));
        if (units.some(unit=>!unit)) fail("This equipment is not available in the authored fixture. The team must update the result for a different unit.");
        selected.draftEquipment = clone(units);selected.equipmentEdited = true;selected.dirty = dirty(selected);break;
      }
      case "save": {
        if (state.type !== "refrigeration") fail("Specification titles update immediately in this local result; refrigeration uses explicit save.");
        const wasExcluded = selected.savedNoRefrigeration;
        if (selected.draftNoRefrigeration) {
          if (state.policy === "restore" && selected.equipment.length) selected.priorEquipment = clone(selected.equipment);
          if (state.policy === "reselect") selected.priorEquipment = [];
          selected.equipment = [];selected.draftEquipment = [];
        } else if (state.policy === "restore" && wasExcluded && !selected.equipmentEdited) {
          selected.equipment = clone(selected.priorEquipment);selected.draftEquipment = clone(selected.equipment);
        } else selected.equipment = clone(selected.draftEquipment);
        selected.savedNoRefrigeration = selected.draftNoRefrigeration;selected.noRefrigeration = selected.savedNoRefrigeration;
        selected.needsEquipment = !selected.savedNoRefrigeration && selected.equipment.length === 0;
        selected.equipmentEdited = false;selected.dirty = false;break;
      }
      default: fail("Unknown local result action “" + action + "”.");
    }
    return same(input,state) ? input : state;
  }
  function totals(state) {
    check(state);
    if (state.type !== "refrigeration") {
      const compartments = state.compartments.map(({id,number,type,title})=>({id,number,type,title}));
      return {compartments,total:null,quoteTotal:null,pdf:{compartments:clone(compartments),total:null},simulated:true};
    }
    const compartments = state.compartments.map(c=>{
      const baseAmount = amount(c.baseAmount,"Compartment base amount");
      const units = equipment(c.equipment,"Saved equipment");
      if (c.savedNoRefrigeration && units.length) fail("A saved no-refrigeration result cannot retain active equipment.");
      const refrigerationCents = units.reduce((sum,unit)=>sum + Math.round(unit.amount * 100),0), refrigerationAmount = refrigerationCents / 100;
      return {id:c.id,number:c.number,type:c.type,baseAmount,refrigerationAmount,total:(Math.round(baseAmount * 100) + refrigerationCents) / 100,
        equipment:clone(units),noRefrigeration:c.savedNoRefrigeration,needsEquipment:c.needsEquipment === true};
    });
    const total = compartments.reduce((sum,c)=>sum + Math.round(c.total * 100),0) / 100;
    return {compartments,total,quoteTotal:total,currency:state.currency,pdf:{compartments:clone(compartments),total,currency:state.currency},simulated:true};
  }
  const api = {create,update,totals};
  root.ResultModel=api;if(typeof module === "object" && module.exports)module.exports=api;
})(globalThis);
