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

  function scenario(answer) {
    if (scenarios.has(answer)) return scenarios.get(answer);
    const draft = engine.createCase(engine.hesitationFeedback);
    const asked = simulate(draft, "submit");
    const answered = simulate(asked, "answer", answer);
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
    scenarios.set(answer, result);
    return result;
  }

  const frame = (record, title, description, handoff) => ({
    case:record, title, description, ...(handoff ? {handoff} : {}),
  });

  function route(personaId, answer) {
    const story = scenario(answer);
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

  function frames(personaId = "customer", suppliedAnswer = engine.hesitationAnswers[0]) {
    const persona = list.find(item => item.id === personaId);
    if (!persona) throw new Error("This role walkthrough is unavailable.");
    const answer = typeof suppliedAnswer === "string" ? suppliedAnswer.trim() : "";
    const steps = route(personaId, answer);
    return clone(steps.map((step, index) => ({
      personaId, scenarioAnswer:answer, index, total:steps.length,
      done:index === steps.length - 1,
      audience:persona.audience, outcome:persona.outcome, ...step,
    })));
  }

  function start(personaId = "customer", answer) {
    return frames(personaId, answer)[0];
  }
  function next(context) {
    if (context.done) return context;
    return frames(context.personaId, context.scenarioAnswer)[context.index + 1];
  }

  const api = {list, frames, start, next};
  root.CasePersonas = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis);
