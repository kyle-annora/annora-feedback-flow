"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs");
const R=require("./result-model.js"),C=require("./scenario-catalog.js");
const clone=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const preview=(id,variant)=>C.preview(id,C.variant(id,variant).scope);
const model=(id="refrigeration",variant="reselect")=>R.create(preview(id,variant));
const unit=(state,id=state.selectedId)=>state.compartments.find(c=>c.id===id);

test("B edits the actual title and switches cards without changing the other compartment or source candidate configuration",()=>{
  const authored=preview("compartment","default"),before=JSON.stringify(authored);
  let state=R.create(freeze(authored)),first=clone(state.compartments[0]),other=clone(state.compartments[1]);
  state=R.update(freeze(state),"title","Production cooler");
  assert.equal(unit(state).title,"Production cooler");
  assert.deepEqual(state.compartments[1],other);
  state=R.update(state,"select-compartment","compartment-2");
  state=R.update(state,"title","Loading bay freezer");
  assert.equal(unit(state).title,"Loading bay freezer");
  state=R.update(state,"select-compartment","compartment-1");
  assert.equal(unit(state).title,"Production cooler");
  assert.deepEqual(unit(state).sections,first.sections);
  assert.equal(JSON.stringify(authored),before);
  assert.equal(R.totals(state).pdf.compartments[1].title,"Loading bay freezer");
  assert.equal(R.totals(state).total,null,"The compartment-title fixture does not invent quote prices.");
});

test("C uses catalog equipment amounts and base amounts; quote and simulated PDF totals come from the same saved state",()=>{
  const state=model(),totals=R.totals(freeze(state));
  assert.deepEqual(totals.compartments.map(c=>[c.baseAmount,c.refrigerationAmount,c.total]),[[12000,2400,14400],[15000,3200,18200]]);
  assert.equal(totals.total,32600);
  assert.equal(totals.quoteTotal,32600);
  assert.deepEqual(totals.pdf.compartments,totals.compartments);
  assert.equal(totals.pdf.total,totals.total);
  totals.pdf.compartments[0].equipment[0].amount=999999;
  assert.equal(R.totals(state).compartments[0].equipment[0].amount,2400);
  assert.equal(totals.compartments[0].equipment[0].amount,2400);
});

test("toggle alone does not remove saved equipment or charges, while explicit save clears only the active compartment",()=>{
  const initial=model(),other=clone(initial.compartments[1]),before=JSON.stringify(initial);
  let state=R.update(freeze(initial),"toggle",true);
  assert.equal(unit(state).draftNoRefrigeration,true);
  assert.equal(unit(state).savedNoRefrigeration,false);
  assert.equal(unit(state).dirty,true);
  assert.equal(R.totals(state).total,32600);
  state=R.update(state,"save");
  assert.equal(unit(state).savedNoRefrigeration,true);
  assert.deepEqual(unit(state).equipment,[]);
  assert.deepEqual(unit(state).priorEquipment,[],"The reselect policy actually removes the stored selection.");
  assert.equal(unit(state).dirty,false);
  assert.equal(R.totals(state).compartments[0].refrigerationAmount,0);
  assert.equal(R.totals(state).total,30200);
  assert.deepEqual(state.compartments[1],other);
  assert.equal(JSON.stringify(initial),before);
  assert.equal(R.update(state,"save"),state,"Saving an unchanged state is a complete no-op.");
});

test("reselect does not silently restore a deleted selection; an explicit equipment choice and save are required to add charges again",()=>{
  let state=R.update(R.update(model(),"toggle",true),"save");
  assert.throws(()=>R.update(state,"select-equipment","demo-unit-1"),/Clear No Refrigeration Required/);
  state=R.update(state,"toggle",false);
  assert.equal(R.totals(state).total,30200);
  state=R.update(state,"save");
  assert.equal(unit(state).savedNoRefrigeration,false);
  assert.equal(unit(state).needsEquipment,true);
  assert.deepEqual(unit(state).equipment,[]);
  assert.equal(R.totals(state).total,30200);
  state=R.update(state,"select-equipment","demo-unit-1");
  assert.equal(unit(state).dirty,true);
  assert.deepEqual(unit(state).equipment,[]);
  assert.equal(R.totals(state).total,30200,"A draft selection is not part of the saved quote or PDF.");
  state=R.update(state,"save");
  assert.equal(unit(state).equipment[0].id,"demo-unit-1");
  assert.equal(unit(state).needsEquipment,false);
  assert.equal(R.totals(state).total,32600);
  assert.equal(R.totals(state).pdf.total,32600);
  assert.equal(R.update(state,"save"),state);
});

test("restore explicitly preserves a prior selection and returns it only when the unchecked draft is saved",()=>{
  const initial=model("refrigeration","restore"),other=clone(initial.compartments[1]);
  let state=R.update(R.update(initial,"toggle",true),"save");
  assert.deepEqual(unit(state).equipment,[]);
  assert.equal(unit(state).priorEquipment[0].id,"demo-unit-1");
  assert.equal(R.totals(state).total,30200);
  state=R.update(state,"toggle",false);
  assert.deepEqual(unit(state).equipment,[]);
  assert.equal(R.totals(state).total,30200);
  state=R.update(state,"save");
  assert.equal(unit(state).equipment[0].id,"demo-unit-1");
  assert.equal(R.totals(state).total,32600);
  assert.deepEqual(state.compartments[1],other);
  const secondCycle=R.update(R.update(state,"toggle",true),"save");
  assert.equal(R.totals(secondCycle).total,30200);
  assert.equal(R.update(secondCycle,"save"),secondCycle);
});

test("compartment switching preserves separate saved states and drafts, including across JSON persistence",()=>{
  let state=R.update(model(),"toggle",true);
  state=R.update(state,"select-compartment","compartment-2");
  assert.equal(unit(state).draftNoRefrigeration,false);
  assert.equal(R.totals(state).total,32600);
  state=R.update(state,"toggle",true);
  state=R.update(state,"save");
  assert.equal(R.totals(state).total,29400);
  state=JSON.parse(JSON.stringify(state));
  state=R.update(state,"select-compartment","compartment-1");
  assert.equal(unit(state).draftNoRefrigeration,true);
  assert.equal(unit(state).savedNoRefrigeration,false);
  state=R.update(state,"save");
  assert.equal(R.totals(state).total,27000);
  assert.deepEqual(R.totals(state).compartments.map(c=>c.refrigerationAmount),[0,0]);
  assert.equal(R.update(state,"save"),state);
});

test("invalid or unsupported actions cannot invent equipment, silently coerce amounts or mutate a read-only source",()=>{
  assert.throws(()=>R.create({interactive:false,type:"refrigeration"}),/no supported authored/);
  assert.throws(()=>R.create({interactive:true,type:"pdf-workflow"}),/no supported authored/);
  const initial=model(),before=JSON.stringify(initial);
  for(const action of [()=>R.update(initial,"toggle","false"),()=>R.update(initial,"select-compartment","not-a-compartment"),()=>R.update(initial,"select-equipment","unmodelled-unit"),()=>R.update(initial,"select-equipment",["demo-unit-1","demo-unit-1"]),()=>R.update(initial,"title","Not supported"),()=>R.update(initial,"publish")])assert.throws(action);
  assert.equal(JSON.stringify(initial),before);
  const invalid=preview("refrigeration","reselect");invalid.configuration.compartments[0].equipment[0].amount="2400";
  assert.throws(()=>R.create(invalid),/finite nonnegative/);
  const invalidBase=preview("refrigeration","reselect");invalidBase.configuration.compartments[0].baseAmount=-10;
  assert.throws(()=>R.create(invalidBase),/finite nonnegative/);
});

test("amounts are summed in cents and the browser-global API matches the serializable Node model",()=>{
  const fixture=preview("refrigeration","reselect");
  fixture.configuration.compartments[0].baseAmount=.1;fixture.configuration.compartments[0].equipment[0].amount=.2;
  fixture.configuration.compartments[1].baseAmount=1.1;fixture.configuration.compartments[1].equipment[0].amount=1.05;
  const state=R.create(fixture);
  assert.equal(R.totals(state).total,2.45);
  const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve("./result-model.js"),"utf8"),sandbox);
  const browser=sandbox.ResultModel.create(clone(fixture));
  assert.deepEqual(clone(sandbox.ResultModel.totals(browser)),R.totals(state));
});
