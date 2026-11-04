(function (root) {
  "use strict";
  const engine = typeof module === "object" && module.exports ? require("./engine.js") : root.CaseEngine;
  const list = [
    {
      id: "customer", label: "Requester",
      description: "Act as the requester and designated reviewer in this example.",
      audience: "You submit the feedback and act as the designated reviewer in this example.",
      outcome: "Hand the accepted V2 to the site owner.",
    },
    {
      id: "team", label: "Website team",
      description: "Propose a change, respond to the review, and deliver V2.",
      audience: "You own the proposal. AI helps draft it from the requester’s concern.",
      outcome: "Hand V2 back to the reviewer.",
    },
    {
      id: "publisher", label: "Site owner",
      description: "Check the accepted V2 and authorize its simulated release.",
      audience: "You receive an accepted version and decide whether to authorize its release.",
      outcome: "Let the website team simulate release and record the result.",
    },
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  const scenarios = new Map();

  // The role routes share one authored record. Work stays in the real engine,
  // while the walkthrough makes each scripted human decision explicit.
  function simulate(record, action, value) {
    const next = engine.transition(record, action, value);
    if (next === record) return record;
    const eventIndex = next.trail.length - 1;
    const simulated = {
      ...next,
      trail: next.trail.map((event, index) => index === eventIndex ? {...event, simulated:true} : event),
    };
    if (action === "answer") simulated.answerSimulated = true;
    if (action === "accept") simulated.accepted = {...next.accepted, simulated:true};
    if (action === "authorize") simulated.authorization = {...next.authorization, simulated:true};
    return simulated;
  }

  function revisionFor(branch) {
    if (branch === "paths") {
      return {
        request: "Make the distinction between standard and custom jobs clearer.",
        copy: "Use a template\nFor a standard walk-in, start with a preset layout.\n\nStart from scratch\nFor a custom walk-in, choose your own sizes and options.",
      };
    }
    return {
      request: "Make it clearer that opening the configurator does not send anything to the customer.",
      copy: "Configure a walk-in\nTry sizes and options. Opening the configurator does not send a quote to your customer.",
    };
  }

  function editRevision(record, copy) {
    const edited = engine.editCandidate(record, copy);
    if (edited === record) return record;
    return {
      ...edited,
      trail: [...edited.trail, {
        action: "edit", actor: "Website team", rev:edited.rev,
        text: "Revised V" + edited.rev + " to address the requester’s concern.",
        simulated:true, at:new Date().toISOString(),
      }],
    };
  }

  function scenario(answer, personalAnswer) {
    const key = JSON.stringify([answer,personalAnswer]);
    if (scenarios.has(key)) return scenarios.get(key);
    const draft = engine.createCase(engine.hesitationFeedback);
    const asked = simulate(draft, "submit");
    const answered = (personalAnswer ? engine.transition : simulate)(asked, "answer", answer);
    const proposal = engine.derive(answered).proposal;
    const result = {draft, asked, answered};
    if (answered.stage === "processing" && proposal) {
      const revision = revisionFor(proposal.branch);
      result.v1 = simulate(answered, "deliver");
      result.requested = simulate(result.v1, "adjust", revision.request);
      result.edited = editRevision(result.requested, revision.copy);
      result.v2 = simulate(result.edited, "deliver");
      result.accepted = simulate(result.v2, "accept");
      result.authorized = simulate(result.accepted, "authorize");
      result.published = simulate(result.authorized, "publish");
    }
    scenarios.set(key, result);
    return result;
  }

  const frame = (record, title, description, handoff) => ({
    case:record, title, description, ...(handoff ? {handoff} : {}),
  });

  function route(personaId, answer, personalAnswer) {
    const story = scenario(answer, personalAnswer);
    if (!story.v1) {
      const waitingOnAnswer = story.answered.stage === "clarify";
      const handoff = waitingOnAnswer ? {
        role:"Requester", title:"An answer is still needed",
        description:"Explain what made you hesitate before the website team prepares a proposal.",
      } : {
        role:"Website team", title:"The website team needs to investigate",
        description:"This concern needs a team decision before there is a proposal to review or authorize.",
      };
      const held = frame(story.answered, handoff.title, handoff.description, handoff);
      return personaId === "customer" ? [
        frame(story.draft, "Describe the problem", "The requester finds “Create” unclear and does not know what the button should say."),
        frame(story.asked, "Explain why you hesitated", "The requester describes their concern. The team owns the proposed wording."),
        held,
      ] : [held];
    }

    if (personaId === "customer") {
      return [
        frame(story.draft, "Describe the problem", "The requester finds “Create” unclear and does not need to write replacement copy."),
        frame(story.asked, "Explain why you hesitated", "The requester answers one question about what made them pause."),
        frame(story.answered, "Let the team propose a change", "The website team prepares V1 from that concern and defines a question for review."),
        frame(story.v1, "Review V1", "The requester acts as the designated reviewer and checks whether the proposal resolves their concern."),
        frame(story.requested, "Ask for a clearer explanation", "The reviewer requests a revision. V1 remains saved while the website team updates the proposal."),
        frame(story.edited, "The team revises the proposal", "The team changes the actual draft to address the request before it can deliver V2."),
        frame(story.v2, "Review V2", "The reviewer checks the changed copy and their original concern together."),
        frame(story.accepted, "Hand the accepted V2 to the site owner", "The requester’s review is complete. Release authorization now belongs to the site owner.", {
          role:"Site owner", title:"V2 accepted",
          description:"Your review is complete. The site owner decides whether to authorize release.",
        }),
      ];
    }
    if (personaId === "team") {
      return [
        frame(story.answered, "Read the feedback and the concern", "AI has drafted V1. The website team checks the proposal against the requester’s own explanation."),
        frame(story.v1, "Send V1 for review", "The reviewer now checks whether the proposed change resolves the original concern."),
        frame(story.requested, "Receive the revision request", "The reviewer asks for a clearer explanation. The team still owns the next revision."),
        frame(story.edited, "Update the actual draft", "The team edits V2 and checks it against the request. V1 is unchanged."),
        frame(story.v2, "Hand V2 to the reviewer", "The revised version has been delivered. The reviewer owns the next decision.", {
          role:"Reviewer", title:"V2 sent for review",
          description:"Your revised proposal is delivered. Wait for the reviewer to accept it or ask for another change.",
        }),
      ];
    }
    return [
      frame(story.accepted, "Verify the accepted V2", "The site owner checks the exact accepted copy and the WinQuote homepage target."),
      frame(story.authorized, "Authorize this version", "The site owner has authorized V2. The website team can now execute the simulated release."),
      frame(story.published, "Read the release result", "The release record identifies the exact version, acceptance, authorization and simulated execution.", {
        role:"Complete", title:"Release simulated",
        description:"V2 has been released in the simulation. The record is available in Details and Activity.",
      }),
    ];
  }

  function decorate(personaId, answer, personalAnswer, steps, interactive = false) {
    const persona = list.find(item => item.id === personaId);
    if (!persona) throw new Error("This role walkthrough is unavailable.");
    const acceptedRev = steps.at(-1)?.case.accepted?.rev;
    const outcome = personaId === "customer" && acceptedRev
      ? "Hand the accepted V" + acceptedRev + " to the site owner." : persona.outcome;
    return clone(steps.map((step, index) => ({
      personaId, scenarioAnswer:answer, personalAnswer, interactive, index, total:steps.length,
      done:index === steps.length - 1,
      audience:persona.audience, outcome, ...step,
    })));
  }
  function frames(personaId = "customer", suppliedAnswer = engine.hesitationAnswers[0], options = {}) {
    const answer = typeof suppliedAnswer === "string" ? suppliedAnswer.trim() : "";
    const personalAnswer = options.personalAnswer === true;
    return decorate(personaId,answer,personalAnswer,route(personaId,answer,personalAnswer));
  }

  function canReview(context) {
    const c = context?.case;
    return context?.personaId === "customer" && c?.stage === "review" &&
      c.versions.at(-1)?.rev === c.rev && !c.accepted;
  }
  function acceptedFrame(c) {
    return frame(c, "Hand the accepted V" + c.rev + " to the site owner",
      "Your review is complete. Release authorization now belongs to the site owner.", {
        role:"Site owner", title:"V" + c.rev + " accepted",
        description:"Your review is complete. The site owner decides whether to authorize this version’s release.",
      });
  }
  function waitingFrame(c, role, title, description) {
    return frame(c,title,description,{role,title,description});
  }
  function stepsOnly(routeFrames) {
    return routeFrames.map(({case:record,title,description,handoff,awaitingDecision})=>({
      case:record,title,description,...(handoff?{handoff}:{}),...(awaitingDecision?{awaitingDecision:true}:{}),
    }));
  }
  // Replace only the future of this isolated rehearsal. Real feedback records,
  // frozen versions and earlier frames are never written through this API.
  function decide(routeFrames, reviewIndex, action, note) {
    const source = routeFrames?.[reviewIndex];
    if (!canReview(source) || !["accept","adjust"].includes(action)) return routeFrames;
    const changed = engine.transition(clone(source.case),action,note);
    if (changed.stage === "review") return routeFrames;
    const steps = stepsOnly(routeFrames.slice(0,reviewIndex + 1));
    if (action === "accept") steps.push(acceptedFrame(changed));
    else {
      const copy = engine.revisionDraft(changed);
      const edited = copy === null ? changed : editRevision(changed,copy);
      const delivered = simulate(edited,"deliver");
      steps.push(frame(changed,"Changes requested for V" + (changed.rev - 1),
        "The website team owns the next revision. The delivered version stays in history."));
      if (delivered.stage === "review") {
        steps.push(frame(edited,"The team revises V" + changed.rev,
          "The simulated team updates the actual draft and checks it against your revision request."));
        steps.push({...frame(delivered,"Review V" + delivered.rev,
          "Check the delivered copy against your concern and the latest revision request. Accept it or request another change."),awaitingDecision:true});
      } else {
        steps[steps.length - 1] = waitingFrame(edited,"Website team","The website team needs to review this request",
          "This simulated draft does not resolve the requested change. The team must investigate before another review.");
      }
    }
    return decorate("customer",source.scenarioAnswer,source.personalAnswer === true,steps,true);
  }

  // Follow the exact rehearsal record, including early V1 acceptance or a
  // pending V3. Never substitute the default scenario's accepted V2.
  function from(personaId, source) {
    if (!source?.case) throw new Error("A rehearsal frame is required.");
    const c = clone(source.case), rev = c.rev;
    let steps;
    if (personaId === "publisher" && c.stage === "release" && c.accepted?.rev === rev) {
      const authorized = simulate(c,"authorize"), published = simulate(authorized,"publish");
      steps = [frame(c,"Verify the accepted V" + rev,"Check this exact accepted copy and its WinQuote homepage target."),
        frame(authorized,"Authorize V" + rev,"The website team can now execute this authorized version’s simulated release."),
        waitingFrame(published,"Complete","Release simulated","V" + rev + " has been released in the simulation. The receipt remains in Details.")];
    } else if (c.stage === "published") {
      steps = [waitingFrame(c,"Complete","Release simulated","This exact version already has a simulated release receipt.")];
    } else if (["release","authorized"].includes(c.stage)) {
      steps = [waitingFrame(c,c.owner,"V" + rev + (c.stage === "release" ? " accepted" : " authorized"),
        c.stage === "release" ? "The reviewer accepted this version. The site owner owns release authorization." : "The website team owns the authorized release.")];
    } else if (c.stage === "review") {
      steps = [waitingFrame(c,"Reviewer","V" + rev + " is awaiting review","This version has been delivered. The reviewer must accept it or request changes before release authorization.")];
      if (personaId === "customer") steps[0] = {...frame(c,"Review V" + rev,"Accept this delivered version or request another change."),awaitingDecision:true};
    } else {
      const requester = ["draft","clarify"].includes(c.stage);
      steps = [waitingFrame(c,requester ? "Requester" : "Website team",requester ? "The requester has the next step" : "The website team has the next step",
        requester ? "Submit the concern or explain what made you hesitate." : "This pending request needs team work before the reviewer or site owner can decide.")];
    }
    return decorate(personaId,source.scenarioAnswer || c.answer,source.personalAnswer === true,steps,true);
  }

  function start(personaId = "customer", answer, options) {
    return frames(personaId, answer, options)[0];
  }
  function next(context, routeFrames) {
    if (context.done) return context;
    if (routeFrames) return clone(routeFrames[context.index + 1] || context);
    if (context.interactive) return context;
    return frames(context.personaId, context.scenarioAnswer,{personalAnswer:context.personalAnswer})[context.index + 1];
  }

  function teamStart() {
    const answer=engine.hesitationAnswers[1];
    const submitted=simulate(engine.createCase(engine.hesitationFeedback),"submit");
    const c=simulate(submitted,"answer",answer);
    return {...frame(clone(c),"Prepare V1","Check the proposal against the requester’s concern."),
      personaId:"team", items:clone(engine.derive(c).proposal.items)};
  }
  function teamDraft(frame,draftItems) {
    const c=frame.case, items=draftItems||frame.items;
    const text=items.map(item=>item.label+"\n"+item.detail).join("\n\n");
    const changed=text!==engine.derive(c).candidate;
    const edited=changed?{...engine.editCandidate(c,text),proposalItems:clone(items)}:c;
    const view=engine.derive(edited);
    const prior=c.versions.at(-1)?.candidate;
    const normalized=copy=>copy.replace(/\s+/g," ").trim();
    const incomplete=items.some(item=>!item.label.trim()||!item.detail.trim());
    const unchanged=prior&&normalized(prior)===normalized(text);
    const reason=incomplete?"Write a label and explanation for each entry point.":
      unchanged?"Change the copy to address the requester’s feedback.":view.blocked?view.reason:"";
    return {text,items,view,edited,reason,ready:!reason&&edited.stage==="processing"};
  }
  // The practice grows a frame only for a committed action. Inspecting or
  // editing a field never advances a decision or replaces a delivered version.
  function teamSteps(frame,action,value) {
    const c=frame.case, team=frame.personaId==="team";
    const step=(record,title,personaId="team",items=frame.items)=>({
      case:record,title,description:"",personaId,items:clone(items),
    });
    if(action==="deliver"&&team&&["processing","blocked"].includes(c.stage)){
      const draft=teamDraft(frame,value);
      if(!draft.ready)return [];
      const steps=[];
      let edited=draft.edited;
      if(edited!==c){
        edited={...edited,trail:[...edited.trail,{action:"edit",actor:"Website team",rev:c.rev,
          text:"Edited V"+c.rev+" to address the requester’s feedback.",simulated:false,at:new Date().toISOString()}]};
        steps.push(step(edited,"Edited V"+c.rev,"team",draft.items));
      }
      const delivered=engine.transition(edited,"deliver");
      if(delivered===edited)return [];
      steps.push(step(delivered,"Sent V"+c.rev+" for review","team",draft.items));
      return steps;
    }
    if(c.stage!=="review"||c.versions.at(-1)?.rev!==c.rev)return [];
    if(action==="sample-change"&&team&&c.rev===1){
      const note="Make the distinction between standard templates and custom work from scratch clearer.";
      return [step(simulate(c,"adjust",note),"The requester asks for changes to V1")];
    }
    if(action==="view-requester"&&team&&c.rev>1)return [step(c,"Review V"+c.rev,"customer")];
    if(!team&&["accept","adjust"].includes(action)){
      const next=engine.transition(c,action,value);
      if(next===c)return [];
      return [step(next,action==="accept"?"V"+c.rev+" accepted":"Changes requested to V"+c.rev,
        action==="accept"?"customer":"team")];
    }
    return [];
  }
  const api = {list, frames, start, next, canReview, decide, from, suggestChange:engine.suggestChange,
    teamStart,teamDraft,teamSteps};
  root.CasePersonas = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis);
