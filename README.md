# Annora Feedback Flow

[Open the workspace](https://kyle-annora.github.io/annora-feedback-flow/)

Annora follows feedback from the original request through team review, clarification when needed, a versioned proposal, adjustments, acceptance and separate release authorization. WinQuote supplies two examples: an unclear “Create” button and a historical request to open a generated PDF.

The reviewed workflow runs inside the original Feedback Flow workspace and CaseEngine records. Existing saved feedback, original wording, delivered versions and earlier decisions remain available. Starting a walkthrough creates a separate exercise rather than replacing the feedback you were working on.

## Try the PDF case

[Watch the PDF walkthrough](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=pdf), or [try it yourself](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=pdf&mode=practice).

The website team first reviews the source and proposed scope. The August 5 historical decision keeps Make PDF open and makes navigation to Workflow a separate action. Confirm that this decision applies, then continue without asking the customer a question.

[Try the clarification branch](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=pdf&branch=ask&mode=practice) when the team cannot establish that the record applies:

1. Draft and edit the questions privately. Choose their wording, answer type, options and required setting. Assign each item to the customer, existing records or the website team.
2. **Save private draft** without sending anything. Preview the customer bundle, then explicitly send only the reviewed customer questions. Internal investigation stays with the team.
3. Switch to **Requester** and answer. “Keep editing this quote” and “Move on to next workflow step” produce different proposed approaches and checks.
4. Return to **Website team** to select or edit the suggested scope and confirm it. A customer answer does not itself approve the proposal or override the recorded navigation constraint.
5. Edit V1 and prepare its labelled simulated result and team check summary before sending it for review. A requested adjustment returns to the team for an actual V2 edit and a fresh preview.

Supported PDF proposals include an interactive navigation model. Editing the behavior or checks beyond that authored model removes the interaction; the exact proposal remains available for review. The sample document is not a generated customer PDF, and the preview is not evidence that a live PDF feature has been implemented or verified.

## Create, personal feedback and roles

[Explore the Create concern](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=create). Describe the hesitation using a suggested answer or your own words. Worrying that a quote will be sent to a customer and being unsure which quote path to choose lead to different copy and review questions. Unknown answers stay with the team rather than receiving an invented successful result.

The existing [Requester](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=customer), [Website team](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=team) and [Site owner](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=publisher) entry URLs remain available. Add `&mode=practice` to take part. New personal feedback also starts with team review; unsupported work needs an explicit team-authored proposal and checks.

Use **Demo view** to switch responsibilities on the same exercise. This is a presentation control, not account access control. Changing views does not answer, accept or authorize anything.

Submitted versions freeze the candidate, scope, source, answers, questions and simulated result. Requester acceptance applies to that exact version. The site owner separately approves its release, then the website team runs the simulation and records a receipt for the same version and destination. Earlier versions remain unchanged.

The walkthrough shows the current owner, next action and why each step exists. Pause to inspect, or choose **Try this step** to take control. Earlier practice steps are read-only; **Return to current step** resumes the latest task. Records and drafts are saved in the current browser when storage is available. AI, customer messages, implementation and release are simulated; this prototype does not publish changes to WinQuote.

## Local development

With Node.js installed, run `npm start` and open the local address printed in the terminal. Run `npm test` for workflow and packaging checks. Run `npm run bundle` to regenerate the identical self-contained entry points under `docs/`; GitHub Pages serves that directory from `main`.

Inter and Source Serif Pro are bundled locally, with sources and licenses in `assets/`. The standalone HTML embeds the fonts, styles and scripts for offline use. The [single-file demo](https://kyle-annora.github.io/annora-feedback-flow/Feedback-Flow.html) can be saved and opened without a server.
