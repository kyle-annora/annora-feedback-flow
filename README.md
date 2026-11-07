# Annora Feedback Flow · WinQuote

[Open the customer workspace](https://kyle-annora.github.io/annora-feedback-flow/)

A hands-on demo of feedback from its original page through team screening, optional clarification, a versioned result, customer acceptance and separate release authorization. It uses the existing Annora records and CaseEngine, with WinQuote as the business example.

## One feedback process, three sample tickets

- **The generated PDF does not open** — the team checks the complaint against the later navigation record before drafting a plan. The recorded requirements make another customer question unnecessary.
- **Compartment titles are hard to identify** — the team separates the customer's editable-title request from the owner's grouping decision. A later title or section-label adjustment can produce V2.
- **Refrigeration charges remain after saving** — the team compares the reported saved state with historical findings. If the team explicitly revisits how equipment should be chosen later, the customer's reselect/restore answer changes both the plan and the checks. The restore conversation is a proposed demo branch, not a historical customer approval.

These cases have different evidence labels. Historical requests, recorded decisions, diagnostic reconstruction and proposed dialogue are not interchangeable. The source notes remain in Details.

## How to try it

1. Start on the sample WinQuote page. Select **Feedback** at the bottom right: one entry combines your current tasks, recent updates and reporting. Select **Describe the problem…** to write a report; the attachment toolbar supports images, voice and page-context capture. The panel is nonmodal. Minimize it to keep working, or expand the same interaction into a full-page workspace. Text, attachments, the source quote and the selected version are preserved.
2. Submit and keep working, or open the saved feedback. **My feedback** and **Updates** show only the current local customer's records. Images, audio and drafts stay on this device; a submitted attachment is not uploaded to a service.
3. Select **Demo controls** to open the separate floating console when you need a sample ticket or another perspective. **Practice** waits for your decisions. **Watch** runs explicitly labelled scripted decisions. Starting a watched example does not add it to the customer's feedback count.
4. As **Website team**, start with the complaint, sourced facts and earlier decisions. New feedback has no prefilled complete plan. Choose **Use existing evidence** to prepare a private editable plan, or **Confirm with the customer** to review a question before sharing a plan. In the refrigeration example, the optional equipment-return question is available in this first review. Edit or omit it, answer from records, and keep technical decisions with the team. Only an explicitly sent batch reaches the requester. Initial clarification and later detailed questions remain optional; a preference already answered in the current scope is treated as a record instead of being asked again by default.
5. As **Requester**, answer yes/no, single choice, multiple choice or text questions. Other can include an explanation; uncertainty is not consent. The team first sees the actual reply and its proposed behavior/check implications, then chooses **Draft an updated plan** before confirming and sharing it.
6. Prepare and try an authored result, then send that exact version. A requested adjustment can include text, images or audio. The team must change the candidate or checks and prepare V2 before sending it again. Unsupported edits remain a draft until an appropriate result is authored.
7. Customer acceptance hands the exact version to **Site owner**. The owner can request changes or authorize release. The team then runs the simulated release; failure and retry have separate states and no success receipt is created on failure.

The minimized Feedback launcher counts distinct tickets requiring the active demo role, not unread messages. FYI updates and a saved draft have separate quiet indicators. Opening its overview does not consume ticket visits or mark updates read. The hub resumes its current ticket or saved draft; full-page and compact views share the same case and version. The separate demo console remembers its explicit perspective and mode after reload, with playback paused. Back opens a read-only presentation snapshot; Return to current resumes the canonical task. Restart returns to the sample page and creates a new example only when submitted, preserving the original record. Product navigation, presentation controls and business approvals remain separate.

## Waiting and returning

A submission has an immediate durable receipt. Short local timers (2 seconds and 40 seconds) organize a material-specific context brief for team review, including while the hub is minimized or another ticket is open in the same page. Elapsed time never creates a complete plan, sends a question or confirms a human decision. The team explicitly drafts the plan from the reviewed evidence. Closing or reloading the browser page pauses unfinished local preparation; it can be resumed on return. There is no server background worker.

Waiting screens show the current owner, last meaningful update, next update time and what you can do. **Advance time** moves a local simulation clock without performing the work. Overdue updates create one delay notice per checkpoint and remain overdue until the team explicitly sets another expectation. Updates are grouped by ticket while preserving individual event links. Returning shows public changes since the previous visit; visiting alone does not mark every notification read. Simulated email links and Updates return to the same canonical ticket without changing the active role; old question and version links explain that they have been answered or superseded.

Returning from the question editor preserves private edits, including unfinished questions. They stay with that version, scope cycle and question round; nothing is sent by returning.

Customer question rounds follow actual sent batches. Private drafts do not increase the visible count. Existing question IDs and historical version links are preserved. While awaiting an answer, the context pane states whether the team will draft or revise the plan; it does not describe a previously shared plan as never drafted.

## Evidence and existing records

Existing plain and team-reviewed customer records open in the same workspace without replacing their case, assigning a new scenario or regenerating their versions. Details separates the current basis, original request, material, question rounds and version list; Activity is a separate timestamped view. The main document keeps the current task and handoff prominent.

Selecting a submitted version reads only its frozen evidence. Older records that did not save context or media show that absence explicitly; they never inherit newer material. Later historical decisions are distinguished from superseded ones. Image thumbnails and voice-note playback use the actual locally saved files, not decorative evidence.

## Real local behavior and simulated behavior

Real: local form interaction, file upload/paste/drop, image previews, microphone recording and playback where supported, IndexedDB attachment persistence, allowed DOM region selection, user-authorized single-frame tab screenshots where supported, local record/version guards, authored result interactions.

Simulated: AI drafting and interpretation, customer-message delivery, engineering implementation, quote/PDF amounts and documents, and business release. No live WinQuote quote, email, repository or deployment changes when a demo button is pressed. A perspective switch is a demo control, not authentication.

The capture adapter records an allowlisted page/quote/compartment/time/build/state snapshot before opening the composer. Selected DOM text is not repository source code. It does not read cookies, credentials, all browser storage, production logs or arbitrary source files. Screenshots can be uploaded or pasted. On supported browsers, explicit screenshot capture asks you to choose a browser tab, captures one visible frame, immediately stops sharing, and lets you review or crop before attaching. It does not capture a full scrolling page or guarantee which tab you chose; choose the WinQuote tab. Unsupported devices and permission refusal retain the draft and offer Add image. Audio is never given an invented transcript.

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

The current customer shell is `feedback-app.js` and `feedback-view.js`. `feedback-store.js` commits through the existing CaseEngine and storage key. `scenario-catalog.js` defines the three authored scenarios; `result-model.js` operates only their local result fixtures. Original walkthrough query routes continue through `studio.js`; old `legacy=1&ticket=...` links now open the canonical customer workspace. `feedback-presentation.js` projects current and historical evidence without mutating the case.

The approved Source Serif Pro headings, Inter body and original WinQuote mark are bundled locally with provenance/licenses in `assets/`. Wesley's independent homepage design and the WinHub sitemap are separate deliverables.

## Floating feedback composer

Open the single bottom-right Feedback entry, then Describe the problem. Capture context, Add image and Record voice sit next to the text field, separate from Send. Minimize retains the draft and local files; Back to Feedback saves it while returning to tasks and updates. Expand changes only the presentation size. Escape minimizes and returns focus to the entry. Mobile uses a full-height surface, with the host page available again after minimizing.


## Reading clarification history

Details keeps the saved version's decision basis first. One question displays a compact answer; multiple questions are grouped by round in a short index. View all opens the full list, with search for larger histories. Select a question to read its complete answer, multi-select choices, additional note and provenance. Back restores the same list position and keyboard focus.

Attachments, changes/corrections and versions also have bounded overviews and complete list access. These are presentation controls: opening, searching and returning do not change the feedback. Switching versions clears an incompatible selected record and reads only that version's frozen question, answer and supporting material. Optional skipped questions are distinct from unanswered or missing historical records. A batch-level answer relationship is not presented as individual adoption of every question.

## Unified Feedback hub integration

The host renders one bottom-right launcher; it does not add Feedback to its business navigation or top-right actions. `FeedbackStore.attention(data, {actor})` derives actionable ticket counts and recipient-filtered updates. It is a demo projection, not authentication. Host integration must supply authenticated identity and server authorization.

`FeedbackView.renderHub(vm)` wraps the existing task and inspector. Compact, full-page and minimized are shell states, not case transitions. The original `render(vm)` and explicit legacy walkthrough URLs remain available. Full-page means an in-app workspace, not the browser Fullscreen API. On phones the compact surface uses a full-height sheet.

New report drafts bind scenario, quote, compartment and source section. Additional notes bind their original ticket, version, sequence and author; a stale submit is rejected and its draft retained. Matching legacy drafts are migrated without deleting their source record, and a migration receipt prevents old drafts from reappearing after submission. Page selection targets only the host business surface.

Walkthrough presentation snapshots use a lossless shared-node pool so repeated long questions, answers and version copies do not exhaust local storage during acceptance and release. Existing plain snapshots are upgraded when saved. Canonical cases and submitted versions retain their original structure and exact content; this is storage deduplication only, with no new business state or reconstructed evidence.
