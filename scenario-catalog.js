(function (root) {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const normalized = value => String(value || "").trim().replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g," ").toLowerCase();
  const lines = value => String(value || "").split("\n").map(s=>s.trim()).filter(Boolean);
  const revision = "3212161f798e87b5fbf0b1b71349df71f998a05e";
  const pdfScope = {
    approach:"Open the saved customer’s PDF in a new browser tab.\nKeep the original quote on Make PDF.\nOffer an explicit Go to Workflow action when the user is ready to move on.",
    checks:"The saved customer’s PDF opens in a new tab.\nThe original tab remains on Make PDF with the same quote.\nGo to Workflow moves to Workflow only when explicitly selected.",
  };
  const compartmentScope = {
    approach:"Group every editable section by compartment, with a clear compartment number and type.\nDefault specification titles to “Compartment 1 - Cooler” and “Compartment 2 - Freezer”.\nAllow each specification title to be edited without changing another compartment.",
    checks:"Each editable section clearly belongs to its compartment.\nDefault titles show the correct compartment number and Cooler or Freezer type.\nA title can be edited and its preview reflects that edit.\nEditing one compartment does not change the other compartment.",
  };
  const reselectScope = {
    approach:"On explicit Refrigeration save, remove saved equipment and refrigeration charges from the active compartment when No Refrigeration Required is selected.\nKeep other compartments unchanged and update the quote total and PDF summary.\nIf refrigeration is needed again, clear the flag and select equipment again; removed equipment is not restored.\nSaving the same unchanged state again makes no additional change.",
    checks:"Selecting No Refrigeration Required and saving removes the active compartment’s equipment and refrigeration charges.\nThe quote total and PDF summary reflect the saved state.\nOther compartments remain unchanged.\nClearing the flag requires selecting equipment again.\nSaving again without changes leaves the state and totals unchanged.",
  };
  const restoreScope = {
    approach:"On explicit Refrigeration save, exclude saved equipment and refrigeration charges from the active compartment when No Refrigeration Required is selected.\nKeep a prior selection for this simulated restore branch; do not include it in the quote total or PDF summary while refrigeration is excluded.\nIf refrigeration is needed again, restore that prior selection on explicit save and include its charges again.\nKeep other compartments unchanged; saving the same state again makes no additional change.",
    checks:"Selecting No Refrigeration Required and saving excludes the active compartment’s equipment and refrigeration charges.\nThe quote total and PDF summary reflect the saved state.\nOther compartments remain unchanged.\nClearing the flag and saving restores the prior equipment selection and its charges.\nSaving again without changes leaves the state and totals unchanged.",
  };
  const compartments = [
    {id:"compartment-1",number:1,type:"Cooler",title:"Compartment 1 - Cooler",sections:["Specifications","Entry door","Construction","Glass door","Accessories","Freight","Refrigeration"]},
    {id:"compartment-2",number:2,type:"Freezer",title:"Compartment 2 - Freezer",sections:["Specifications","Entry door","Construction","Glass door","Accessories","Freight","Refrigeration"]},
  ];
  const refrigerationConfiguration = policy => ({
    policy,saveRequired:true,idempotent:true,activeCompartmentId:"compartment-1",currency:"USD",dataLabel:"Illustrative demo data; not historical quote amounts",
    compartments:[
      {id:"compartment-1",number:1,type:"Cooler",baseAmount:12000,equipment:[{id:"demo-unit-1",label:"Example refrigeration unit",amount:2400}],noRefrigeration:false},
      {id:"compartment-2",number:2,type:"Freezer",baseAmount:15000,equipment:[{id:"demo-unit-2",label:"Other compartment unit",amount:3200}],noRefrigeration:false},
    ],
  });
  const catalog = {
    pdf:{id:"pdf",title:"Open the generated PDF",ticketId:"fb_2026-07-11_002",kind:"behavior",target:"WinQuote · Make PDF",
      feedback:"Generate PDF should automatically open the PDF once generated.",
      summary:"Use the later navigation decision; open the saved PDF without losing the original quote.",
      sourceNote:"Historical ticket quoted in the July specification. The August 5 record supersedes the earlier Workflow redirect. This is an Annora demo reconstruction, not a live bug report or historical Annora review.",
      sourceRevision:revision,feedbackEvidence:"source-derived summary",history:[
        {date:"2026-07-16",decision:"Open the saved PDF and navigate to Workflow.",status:"superseded",source:"specs/20260716_cadillac_fixes/01_open_cadillac_pdf_after_generate.md"},
        {date:"2026-08-05",decision:"Open the saved customer PDF in a new tab; retain Make PDF and offer explicit Workflow or quote navigation.",status:"current-record",source:"specs/20260805_fixes/03_make_pdf_flow_and_ux_fixes.md"},
      ],scope:pdfScope,
      questions:[
        {id:"pdf-record",text:"Apply the later recorded navigation decision to this case.",type:"text",options:[],required:false,disposition:"records",reason:"The record already answers which PDF opens and whether the original tab navigates."},
        {id:"pdf-opening",text:"Check opening failures and the recovery action.",type:"text",options:[],required:false,disposition:"team",reason:"Opening mechanics and technical checks belong to the website team."},
      ],detailedQuestions:[],
      variants:[{id:"default",title:"Open PDF and retain Make PDF",scope:pdfScope,configuration:{opens:"sample-pdf-new-tab",retains:"make-pdf",workflow:"explicit",placement:"separate-action"}}],
    },
    compartment:{id:"compartment",title:"Know which compartment you’re editing",ticketId:"fb_2026-07-11_001",kind:"behavior",target:"WinQuote · Edit quote",
      feedback:"Please default the specification titles to “Compartment 1 - Cooler” and so on, and still allow someone to edit them.",
      summary:"Clear titles and grouping show which compartment every editable section belongs to.",
      sourceNote:"Paraphrase of a customer quotation in the July specification. Grouping all editable sections is separately recorded owner direction. Annora delivery and revision interactions are proposed demo experiences.",
      sourceRevision:revision,feedbackEvidence:"paraphrase of quoted customer feedback",history:[
        {date:"2026-07-16",decision:"Customer requested numbered, editable default specification titles.",status:"current-record",source:"specs/20260716_cadillac_fixes/02_compartment_labeled_edit_sections.md:21"},
        {date:"2026-07-16",decision:"Owner direction also groups and labels every editable section by compartment.",status:"current-record",source:"specs/20260716_cadillac_fixes/02_compartment_labeled_edit_sections.md:29"},
      ],scope:compartmentScope,
      questions:[
        {id:"compartment-record",text:"Include the confirmed numbering, editability and grouping requirements.",type:"text",options:[],required:false,disposition:"records",reason:"Do not ask the customer to write the default titles again."},
        {id:"compartment-scope",text:"Keep customer title requirements distinct from owner-added grouping scope.",type:"text",options:[],required:false,disposition:"team",reason:"The team confirms the current scope without pretending the expansion was the original customer wording."},
      ],detailedQuestions:[],
      variants:[
        {id:"default",title:"Numbered editable titles and full grouping",scope:compartmentScope,configuration:{compartments,grouped:true,repeatLabels:false,editableTitles:true,persistence:"preview-session"}},
        {id:"section-labels",title:"Repeat the compartment label on every section",scope:{approach:compartmentScope.approach+"\nRepeat the compartment number and type on every section header.",checks:compartmentScope.checks+"\nEach section header repeats its compartment number and type."},configuration:{compartments,grouped:true,repeatLabels:true,editableTitles:true,persistence:"preview-session"}},
        {id:"loading-bay-title",title:"Name the second specification card Loading bay freezer",scope:{approach:compartmentScope.approach+"\nSet the second specification title to “Loading bay freezer”; retain its compartment number and type in the section grouping.",checks:compartmentScope.checks+"\nThe second specification preview reads “Loading bay freezer” and its sections remain identified as Compartment 2 - Freezer."},configuration:{compartments:[compartments[0],{...compartments[1],title:"Loading bay freezer"}],grouped:true,repeatLabels:false,editableTitles:true,persistence:"preview-session"}},
      ],
    },
    refrigeration:{id:"refrigeration",title:"Remove refrigeration from the quote",ticketId:"fb_2026-09-23_001",kind:"behavior",target:"WinQuote · Refrigeration",
      feedback:"No Refrigeration Required is selected and saved, but the quote still includes previously selected equipment and charges.",
      summary:"Use the saved state to investigate; check equipment, charges, totals and other compartments together.",
      sourceNote:"Reconstructed from a specification with the ticket ID and diagnosis, not an original customer quotation. D2 selected deletion and later re-selection without asking; a new business question or restore alternative is a proposed Annora demo branch, not a recorded customer approval or known current unanswered request.",
      sourceRevision:revision,feedbackEvidence:"reconstructed from ticket-linked specification",history:[
        {date:"2026-09-23",decision:"An existing compartment retained saved equipment and costs after saving only the no-refrigeration flag.",status:"source-diagnosis",source:"specs/20260923_small_fixes/00_cadillac_surcharge_and_skip_refrigeration.md"},
        {date:"2026-09-23",decision:"D2 deletes saved equipment; if refrigeration is needed later, equipment must be selected again. Recorded as a decision made without asking, for Wes to confirm or change.",status:"recorded-team-decision-not-customer-approval",source:"specs/20260923_small_fixes/00_cadillac_surcharge_and_skip_refrigeration.md:334"},
      ],scope:reselectScope,
      questions:[
        {id:"refrigeration-state",text:"Check the saved equipment and no-refrigeration flag in the supplied state.",type:"text",options:[],required:false,disposition:"team",reason:"The customer should not have to diagnose how saved equipment is stored."},
        {id:"refrigeration-record",text:"Reuse the recorded requirement to clear active-compartment charges after explicit save.",type:"text",options:[],required:false,disposition:"records",reason:"The existing specification already describes the symptom and expected removal."},
      ],detailedQuestions:[
        {id:"equipment-return",text:"If this compartment needs refrigeration again later, how should equipment be chosen?",type:"single",options:["Select equipment again","Restore the previous equipment selection","I'm not sure"],optionIds:["reselect","restore","unsure"],required:true,disposition:"ask",reason:"Your choice determines whether you select equipment again or restore the previous selection when refrigeration is needed later."},
      ],variants:[
        {id:"reselect",title:"Remove equipment and select again later",scope:reselectScope,configuration:refrigerationConfiguration("reselect")},
        {id:"restore",title:"Proposed restore alternative",scope:restoreScope,configuration:refrigerationConfiguration("restore")},
      ],
    },
  };
  const entry = id => Object.prototype.hasOwnProperty.call(catalog,id) ? catalog[id] : null;
  function get(id) { const item=entry(id);return item ? clone(item) : null; }
  function list() { return Object.keys(catalog).map(get); }
  function variant(id,variantId) {
    const found = entry(id)?.variants.find(item=>item.id === variantId);
    return found ? clone(found) : null;
  }
  function matchesFeedback(id,value) {
    const item = entry(id);
    if (!item || typeof value !== "string") return false;
    // An authored simulation is intentionally narrower than semantic AI. Extra
    // clauses must reach a person rather than being dropped by keyword routing.
    const aliases = {
      pdf:[item.feedback,"Generate PDF should automatically open the PDF once generated."],
      compartment:[item.feedback,"Default the specification titles to Compartment 1 - Cooler and Compartment 2 - Freezer, and keep them editable."],
      refrigeration:[item.feedback,"I selected No Refrigeration Required and saved, but the quote still includes the equipment and charges."],
    };
    return aliases[id].some(raw=>normalized(raw) === normalized(value));
  }
  function suggest(id,answers,options={}) {
    const item = entry(id);
    if (!item) return null;
    const result = {...clone(options.scope || item.scope),reason:"The team must review this answer and explicitly confirm the current scope.",conflict:null,decisionRequired:true,scenarioId:id};
    if (id !== "refrigeration" || options.round !== "detailed") return result;
    if (answers && typeof answers === "object" && Object.entries(answers).some(([key,value])=>key !== "equipment-return" && (Array.isArray(value) ? value.length : value))) return result;
    if (Object.values(options.notes || {}).some(value=>typeof value === "string" && value.trim())) return {...result,reason:"The customer added context beyond the authored choice. The team must review the complete answer before confirming scope."};
    const answer = typeof answers === "string" ? answers : answers?.["equipment-return"];
    const selected = answer === "reselect" || answer === "Select equipment again" ? "reselect" : answer === "restore" || answer === "Restore the previous equipment selection" ? "restore" : null;
    if (!selected) return result;
    const choice = variant(id,selected);
    return {...result,...choice.scope,variantId:selected,decisionRequired:false,
      reason:selected === "restore" ? "The proposed restore branch differs from recorded D2. The website team must explicitly select this simulated alternative before it becomes the scope." : "The answer supports selecting equipment again later. The team still confirms the scope; answering is not acceptance or release authorization.",
      conflict:selected === "restore" ? "The restore alternative differs from the recorded delete-and-reselect decision. Resolve this explicitly with the team before preparing a candidate." : null};
  }
  function preview(id,input) {
    const item = entry(id), unavailable = reason => ({interactive:false,scenarioId:id,reason});
    if (!item) return unavailable("This is not a supported authored scenario.");
    const found = item.variants.find(v=>normalized(v.scope.approach) === normalized(input?.approach));
    if (!found) return unavailable("This edited behavior is outside the authored scenario interaction. Update the simulation or review the precise proposal with the team.");
    const actualChecks = lines(input?.checks), known = lines(found.scope.checks).map(normalized);
    if (!actualChecks.length || actualChecks.some(check=>!known.includes(normalized(check)))) return unavailable("These checks include behavior outside the selected authored interaction. The existing simulation cannot demonstrate them.");
    return {interactive:true,scenarioId:id,variantId:found.id,type:id === "pdf" ? "pdf-workflow" : id,configuration:clone(found.configuration),simulated:true,implemented:false,verified:false,
      ...(id === "pdf" ? clone(found.configuration) : {}),reason:"An authored simulation of the exact candidate; not evidence that a live WinQuote feature was implemented or tested."};
  }
  const api = {list,get,variant,suggest,preview,matchesFeedback};
  root.FlowScenarios = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis);
