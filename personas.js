(function (root) {
  "use strict";
  const engine = typeof module === "object" && module.exports ? require("./engine.js") : root.CaseEngine;
  const list = [
    { id: "customer", label: "Requester", description: "Clarify a request and review two versions." },
    { id: "team", label: "Website team", description: "Resolve a word limit before sending the draft for review." },
    { id: "publisher", label: "Site owner", description: "Verify the accepted version and authorize its release." },
  ];
  const newButton = () => engine.createCase('The homepage “Create” button needs a new label. I know what I want it to say.');
  const act = (name, value) => (record) => engine.transition(record, name, value);
  const frame = (title, description, run) => ({ title, description, run });

  const customer = [
    frame("Write the feedback", 'The requester wants to rename “Create” and already knows the replacement wording.', newButton),
    frame("Ask for the missing label", "The requester sees one question about the button wording.", act("submit")),
    frame("Draft the button label", 'The sample answer is “Start a quote.” The website team can now check the proposed label.', act("answer", "Start a quote")),
    frame("Send V1 for review", "The reviewer can accept V1 or ask the team to change the wording.", act("deliver")),
    frame("Request a revision", 'The reviewer asks for “Build my quote.” V1 is saved while the team drafts V2.', act("adjust", 'Change the button label to "Build my quote".')),
    frame("Review V2", "The team has delivered V2. The reviewer checks the button label against the revision request.", act("deliver")),
    frame("Wait for release approval", "The reviewer has accepted V2. The site owner decides whether to authorize release.", act("accept")),
    frame("Authorize the release", "The site owner has approved the simulated release. The website team can carry it out.", act("authorize")),
    frame("Read the release receipt", "The receipt identifies the released version. The activity log records who accepted, authorized and released it.", act("publish")),
  ];

  const team = [
    frame("Check the three-word limit", "The requester wants to keep the customer details reminder and fit the homepage copy into three words.", () => engine.createCase(engine.initialFeedback.replace("18", "3"))),
    frame("Hold the draft", "The draft keeps the requested details but exceeds the word limit. The team asks the requester to resolve the conflict.", act("submit")),
    frame("Raise the limit to 10 words", "The requester allows 10 words and keeps the customer details reminder. The team can check the draft again.", record => engine.editSource(record, engine.initialFeedback.replace("18", "10"))),
    frame("Send the draft for review", "The word count and customer details reminder both pass. The reviewer now has V1.", act("deliver")),
  ];

  function acceptedButtonVersion() {
    return customer.slice(0, 7).reduce((record, step) => step.run(record), undefined);
  }
  const publisher = [
    frame("Verify the accepted version", 'The reviewer accepted “Build my quote.” The site owner checks that V2 is scheduled for the WinQuote homepage.', acceptedButtonVersion),
    frame("Approve the simulated release", "The site owner has authorized V2. The website team can now release that version.", act("authorize")),
    frame("Verify the release receipt", "The simulated release is complete. The receipt identifies V2 and the activity log shows the earlier approval.", act("publish")),
  ];

  const routes = { customer, team, publisher };
  function at(personaId, index, previous) {
    const route = routes[personaId];
    if (!Array.isArray(route)) throw new Error("This role walkthrough is unavailable.");
    const step = route[index];
    return {
      personaId, index, total: route.length, done: index === route.length - 1,
      title: step.title, description: step.description, case: step.run(previous),
    };
  }
  function start(personaId = "customer") { return at(personaId, 0); }
  function next(context) {
    if (context.done) return context;
    return at(context.personaId, context.index + 1, context.case);
  }
  const api = { list, start, next };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CasePersonas = api;
})(globalThis);
