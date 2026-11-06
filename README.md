# Annora Feedback Flow · WinQuote

[Open the customer workspace](https://kyle-annora.github.io/annora-feedback-flow/)

A hands-on demo of feedback from its original page through team screening, optional clarification, a versioned result, customer acceptance and separate release authorization. It uses the existing Annora records and CaseEngine, with WinQuote as the business example.

## Three workflows

- **Open the generated PDF** — the latest recorded requirements already establish a separate PDF tab, retained Make PDF page and an explicit Workflow action. The main path needs no customer question.
- **Identify each compartment** — a complete V1 includes numbered/type-aware editable titles and grouped sections. Try a new title or an additional section-label requirement as a meaningful V2 adjustment.
- **Remove refrigeration from the quote** — explicitly save No Refrigeration Required, inspect equipment and totals, and compare the later reselect/restore policies. This case comes from a historical diagnostic. The alternative restore conversation is a proposed demo branch, not an actual historical customer approval.

These cases have different evidence labels. Historical requests, recorded decisions, diagnostic reconstruction and proposed dialogue are not interchangeable. The source notes remain in Details.

## How to try it

1. Choose a workflow, use its sample business page and select **Give feedback**. Keep the supplied text or write your own. Add real images or an audio recording, or select a page region to attach allowed DOM context.
2. Submit and keep working, or open the saved feedback. **My feedback** and **Updates** show only the current local customer's records. Images, audio and drafts stay on this device; a submitted attachment is not uploaded to a service.
3. Open the floating **Walkthrough** console when you need to change perspective. **Practice** waits for your decisions. **Watch** runs explicitly labelled scripted decisions. Starting a watched example does not add it to the customer's feedback count.
4. As **Website team**, screen AI-labelled suggestions privately. Edit or omit questions, answer from records, or keep technical decisions with the team. Only an explicitly sent batch reaches the requester. Initial clarification and later detailed questions are optional, separate rounds.
5. As **Requester**, answer yes/no, single choice, multiple choice or text questions. Other can include an explanation; uncertainty is not consent. The team reviews how the answer changes the proposed behavior and checks before confirming the plan.
6. Prepare and try an authored result, then send that exact version. A requested adjustment can include text, images or audio. The team must change the candidate or checks and prepare V2 before sending it again. Unsupported edits remain a draft until an appropriate result is authored.
7. Customer acceptance hands the exact version to **Site owner**. The owner can request changes or authorize release. The team then runs the simulated release; failure and retry have separate states and no success receipt is created on failure.

The collapsed walkthrough names the current ticket, owner and task. It resumes that record. Product navigation, presentation controls and business approvals remain separate.

## Waiting and returning

A submission has an immediate durable receipt. While that screen remains open, short local timers show labelled preparation stages. They never send questions or confirm a human decision. Leaving stops those timers; there is no background worker.

Waiting screens show the current owner, last meaningful update, next update time and what you can do. **Advance time** moves a local simulation clock without performing the work. Overdue updates remain overdue until the team explicitly sets another expectation. Simulated email links and Updates return to the same canonical ticket; old question and version links explain that they have been answered or superseded.

## Real local behavior and simulated behavior

Real: local form interaction, file upload/paste/drop, image previews, microphone recording and playback where supported, IndexedDB attachment persistence, allowed DOM region selection, local record/version guards, authored result interactions.

Simulated: AI drafting and interpretation, customer-message delivery, engineering implementation, quote/PDF amounts and documents, and business release. No live WinQuote quote, email, repository or deployment changes when a demo button is pressed. A perspective switch is a demo control, not authentication.

The capture adapter records an allowlisted page/quote/compartment/time/build/state snapshot before opening the composer. Selected DOM text is not repository source code. It does not read cookies, credentials, all browser storage, production logs or arbitrary source files. Screenshots can be uploaded or pasted; this version does not automatically take a screenshot or share a screen. Audio is never given an invented transcript.

Data is local to the browser and origin. The standalone HTML may have different persistence or microphone behavior when opened as a local file; use the HTTPS demo or localhost for recording. No cross-device sync is promised.

## Earlier walkthroughs

Earlier Create and PDF stories remain under **Simulation tools → Earlier demo paths**, with their saved records and original URLs:

- [Create concerns](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=create)
- [PDF team review](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=pdf)
- [PDF questions](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=pdf&branch=ask&mode=practice)
- [Two-round journey](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=journey)
- [Requester](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=customer), [Website team](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=team), [Site owner](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=publisher)

The Create examples remain synthetic. Historical versions are read-only; viewing one never revives an old approval.

## Development

Run `npm start` and open its printed local address. `npm test` checks the shared domain, capture/storage and packaging contracts. `npm run bundle` produces identical self-contained `docs/index.html` and `docs/Feedback-Flow.html`; GitHub Pages serves `main/docs`.

The current customer shell is `feedback-app.js` and `feedback-view.js`. `feedback-store.js` commits through the existing CaseEngine and storage key. `scenario-catalog.js` defines the three authored scenarios; `result-model.js` operates only their local result fixtures. Legacy query routes continue through `studio.js`.

The approved Source Serif Pro headings, Inter body and original WinQuote mark are bundled locally with provenance/licenses in `assets/`. Wesley's independent homepage design and the WinHub sitemap are separate deliverables.
