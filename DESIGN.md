---
name: "Feedback Flow · original artifact iteration"
description: "The existing Annora record, refined with approved neutral serif/sans hierarchy and an editable team review."
colors:
  bg: "#ffffff"
  nav: "#fafafa"
  paper: "#ffffff"
  type: "#262626"
  ink2: "#595959"
  muted: "#737373"
  line: "#e6e6e6"
  line-strong: "#d4d4d4"
  blue: "#153e5c"
  blue-hover: "#10334d"
  lav: "#edf2f6"
  pass: "#43796b"
  danger: "#a54b31"
  source-field: "#fafafa"
  proof-panel: "#ffffff"
  proof-text: "#262626"
  version-wash: "#f0f3f6"
  version-ink: "#516579"
typography:
  title:
    fontFamily: "Source Serif Pro, Georgia, serif"
    fontSize: "clamp(30px, 2.5vw, 36px)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-.03em"
  section:
    fontFamily: "Source Serif Pro, Georgia, serif"
    fontSize: "22px–27px"
    fontWeight: 400
    lineHeight: 1.2
  candidate:
    fontFamily: "Inter, system sans-serif"
    fontSize: "clamp(19px, 1.65vw, 24px)"
    fontWeight: 490
    lineHeight: 1.43
  body:
    fontFamily: "Inter, system sans-serif"
    fontSize: "14px"
    lineHeight: 1.75
  control:
    fontFamily: "Inter, system sans-serif"
    fontSize: "12px–14px"
    fontWeight: 520
    lineHeight: 1.4
  version:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 560
rounded:
  tag: "4px–5px"
  control: "6px"
  field: "6px"
  panel: "8px"
  sheet: "0px"
spacing:
  section-separation: "24px"
  inspector-gutter: "22px"
  mobile-gutter: "18px"
assets:
  provenance: "assets/font-sources.json"
  approvedSource: "../../outputs/winquote-feedback-visuals-v2/assets"
---


# Feedback Flow · original artifact iteration
This iteration applies the approved `winquote-feedback-visuals-v2` direction to the original Annora artifact. It preserves the existing record, task, history, player and state structure. It does not replace the application with a new homepage or a gallery of standalone mockups.

Primary composition lock: [Cycle’s light feedback document](https://refero.design/pages/2b8f8897-0054-472f-8cf3-eb5b57582e87). Cycle owns the current-task column and supporting history pane. The previously researched Attio direction owns the compact, resumable walkthrough and precise controls. The user-approved serif/sans role split governs typography: Source Serif Pro for page/task/section headings, Inter for body, fields, navigation and controls. No new visual research direction supersedes that lock.

The approved V2 palette replaces the earlier indigo/lavender reading treatment. Text and broad surfaces are neutral; navy belongs to primary buttons, selected controls and small status marks. Existing green/rust evidence marks remain small and semantic. Font files are copied from the approved candidate; their licenses and original provenance are in `assets/`.

| Decision | Reference → application |
| --- | --- |
| Document sheet | Cycle’s quiet left navigation and white document surface frame the record. The sheet meets the rail with a thin rule, without an inset rounded outer card. Keep the object title compact enough for the current task to lead. |
| Task hierarchy | Four milestones orient the reader. The current step shows the owner, their decision and the action that moves the record forward. The completed view contains one result heading, a subject/version line and one return action. |
| Secondary pane | Cycle’s tab row and divider. The persistent right panel holds Details and Activity. Details contains the original request, requester answer and immutable submitted versions. Drafting, preparation and review also expose Checks. On phones, Feedback details opens the same panel as a bottom sheet. |
| Accent + components | Small strokes, compact toolbar, 1px neutral dividers and navy primary actions. People and reading copy use neutral grays. Color is confined to actions, selected states and small status marks; no large tinted panels. |
| Editing | Selected source phrase, updated candidate and measured value share one short pulse. Edited record remains anchored; reduced motion omits the pulse. |
| Accountability | Woven review packet and agreed user journey: separate the requirement from its result, exact sources, visible owner, recorded snapshots, accepted version separate from publication. |
| Walkthrough | Use the actual record and a compact player. Watching example labels scripted decisions. Requester practice waits for the person at clarification and review. Show team-owned steps as waiting, label edited drafts as team revisions, and put the version-specific review question next to the candidate. Practice never changes a saved feedback record. |
| Demo narration | Attio’s current-step explanation and collapsed completed steps give the viewer context without reopening the full transcript. In watch mode, the player states why this page appears; an expandable note connects the visible evidence to the next responsible action. Expanding notes pauses playback. The local preview is labeled Proposed homepage copy with its version; both entry buttons belong to the same proposal. Practice keeps its existing task-focused interface. |
| Collapsed walkthrough | Attio’s Getting started control (reference images 9–10) keeps a return point inside the workspace. Annora’s entry names the person responsible and the next action for this feedback. Expanding it returns to the same step and version. The control fits around those words and wraps on phones. |
| Back navigation | The toolbar keeps a labeled Back button visible throughout the walkthrough. Earlier practice steps have a read-only label and a Return to current step button. Minimize walkthrough returns to the workspace with the current task saved. |
| Website team practice | The team sends the first proposal, then sees a simulated requester’s change request above two editable entry options. Each option pairs its button label with its description. On delivery, the reviewer sees the submitted option labels, explanations and acceptance question together. Acceptance hands the version to the site owner. |
| Site owner approval | Attio’s focused preview and [Contra’s publish confirmation](https://refero.design/pages/bbb80894-6ca3-4881-a80e-15ebf965f208) keep the destination with the decision. The owner sees the full accepted copy and approves a named version for simulation. Following Craft’s distinct publication state, the website team runs the simulation after approval. The receipt repeats that version and target, alongside the recorded approval and release event. |
| Requester review | Attio’s email-sharing example (reference image 5) highlights only the affected area. Put the submitted answer, a local preview of the proposed button or entry choices, and the review question inside one versioned proposal. On a revision, show the requested change under the original answer. Keep the full feedback and version history in Details. |

## Overview

A record opens to its current task. Past feedback, answers and delivered versions live in the right-hand Details tab, with the event timeline in Activity. After release, the main workspace contains a compact result. Details holds the released version, target and approvals. Walkthroughs start from navigation.

## Colors

The canvas and record are white, the rail and context pane are #fafafa, and 1px #e6e6e6 rules separate regions. Headings use #262626, reading copy #595959 and supporting text #737373. Navy #153e5c is reserved for actions, selection and small status marks. The walkthrough is a neutral guide, not a colored banner. Green check icons identify passing evidence, rust marks failed evidence, and gray with an explicit Reviewer judgment label identifies checks that need a person. Avatar colors do not imply role permissions.

## Typography

Use locally bundled Source Serif Pro for complete page, task and section headings. Use locally bundled Inter for body text, labels, candidate copy, navigation, buttons and metadata; system fonts provide glyph fallbacks. The current task is the most prominent heading, at 30–36px. The record identity remains quieter at 24–29px. Main section headings are 22–27px and context headings 19–20px. Body copy is 14px; supporting context is 12–13px. Mobile editable fields use 16px. IDs and version tags remain monospace; measurements use tabular numerals. Do not style isolated words in a different face or accent color.

## Layout

| Viewport | Navigation and document | Evidence |
| --- | --- | --- |
| Above 1120px | 220px rail, 64px top bar, white sheet with no outer inset. Task content caps at 52rem. | `clamp(276px, 22vw, 316px)` context pane. |
| 821–1120px | 190px rail and 26px task gutters. | Fixed 258px pane. |
| 661–820px | 220px off-canvas navigation, 56px top bar, 23px task gutters. | Fixed 248px pane. |
| 660px and below | One column with 18px task gutters. All four progress labels remain visible. Main actions are at least 44px high. | Feedback details opens the existing bottom sheet. |

At 820px and below, closed `#nav` uses `visibility:hidden` and `pointer-events:none`; `#nav.show` restores visibility. This prevents hidden offscreen controls from remaining keyboard stops. Script-owned inert state and focus management are separate from this stylesheet.

## Elevation & Depth

The rail, document and inspector meet along 1px borders. Shadows are reserved for dialogs, the open mobile evidence sheet and the simulated PDF paper. Keyboard focus uses a 2px blue-gray outline with an offset, including text fields and selects. The walkthrough dock uses a border rather than a floating shadow.

## Shapes

Use 6px controls, 8px bounded editors and proof panels, and small circles for owners/status indicators. The outer workspace is square and edge-aligned. Keep question options as rows inside the editor, rather than adding a separate card for each option.

## Components

- **Feedback source.** The field grows from 56px to 320px. Its minimum rises to 76px on small screens. Focus changes its background to white and adds a 2px blue-gray outline.
- **Candidate and checks.** A version tag sits beside the candidate section heading. Changed candidate fragments and affected evidence rows briefly highlight. Opening a check reveals its source. A failed word count also shows the excess in words.
- **Owner and actions.** The current step names the responsible role and gives that person one primary action. Reduced-motion preferences disable animations and transitions.
- **Review and release.** Separate controls label acceptance, authorization and simulated publication. The receipt keeps acceptance and site-owner authorization distinct. The sidebar keeps older versions and the activity log available at every stage.


## Integrated review components

- **Team review.** `.team-review-panel` carries the task; `.review-intro` provides one serif section heading and short neutral explanation. `.context-quote` retains the requester’s words with a quiet left rule. It is evidence, not another primary card.
- **Fields and questions.** `.review-field` supports a wrapping label or label-plus-control container. `.question-editor` is one bounded editor; `.question-options` contains compact option rows. `.question-disposition` groups the destination decision. Labels, controls and helper text remain sans.
- **Private preparation.** `.review-private-note` uses a neutral gray inset. `.review-status` is a small badge. Visual styling never substitutes for the underlying draft/sent visibility boundary.
- **Review and results.** `.result-preview`, `.check-summary`, `.scope-changes` and `.reviewed-history` separate the candidate, checks and earlier snapshots with rules. `.review-actions` gives the current transition a stable action row. `.role-switch` stays visually secondary to the product action.
- **Reporting context.** `.context-capture` groups the source context in a compact neutral panel. It does not imply a screenshot, log integration or additional evidence was actually captured.
- **PDF proof.** `.pdf-preview-page`, `.pdf-preview-toolbar`, `.pdf-sheet` and `.pdf-preview-links` provide a clean paper-like preview and explicit return controls. It uses typography and rules, with no invented photography or fabricated customer imagery.

## Implementation and review boundary

This styling unit changes `studio.css`, this design record and local font assets only. Existing IDs, route contracts, state machines, draft ownership, exact-version review rules and walkthrough controls remain implementation-owned. The copied fonts must be included or embedded by the release bundle; reading the editable page alone is not proof the generated standalone output includes them.

Visual verification should include the current task, question editor, candidate review, open context pane, collapsed/resumed guide and PDF preview at 1440px and 390px. Confirm text contrast, long labels, keyboard focus, wrapped actions and closed navigation. Automated workflow tests remain separate evidence from the rendered design review.

## Reporting and asynchronous return · November 5 iteration

Reference lock: preserve the approved Cycle workspace, Attio progressive task presentation and serif headings / neutral sans body. Intercom's in-context reporting pattern is evidenced by the Slite Contact Support flow ([Refero flow 1707](https://refero.design/flows/1707)): business page → local feedback panel → acknowledgement → return to the conversation. Borrow its contextual placement and clear receipt; do not borrow email-delivery promises.

The reporting surface is a deliberately limited Make PDF sample inside this artifact, not Wesley's independent homepage design. A narrow feedback drawer collects the customer's words and an optional rough time. Page and sample quote context are attached automatically. Optional sample-page preview is labelled simulated. Actual screenshot capture, telemetry policy and notification channel remain undecided.

Submitted feedback stays on the business page. Demo Updates opens the original submitted record at its current actionable version. Shared understanding, screened initial questions, a distinct optional detailed question batch, and V1/V2 review use the same records. History stays in the context pane; private drafts never become customer questions until explicitly sent. No mandatory extra customer approval is added to the understanding step.

Only actual local capture submissions create these update entries. Walkthrough exercises do not create customer notifications. Keep existing legacy entry points and saved records intact. Mobile reporting uses a fullscreen drawer with background inertness, a focus loop, and focus restoration; desktop retains the nonmodal side panel.

## Annora workspace brand

The sidebar uses the official lowercase `annora` wordmark from [annora.ai](https://annora.ai/): Archivo 900, −0.04em tracking and a small brass square. The former invented wavy FlowMark is removed. The official Annora favicon identifies the browser tab, titled “Annora · Feedback Flow”. Brand styling is confined to the wordmark; existing serif headings, neutral sans body, workflow and WinQuote sample identity remain intact. Source URLs and asset hashes are recorded in `assets/brand/sources.json`; Archivo retains its OFL license. The font and favicon are bundled locally so the standalone artifact does not depend on a third-party request.

## WinQuote presentation brand · customer correction

The customer explicitly replaced the Annora display branding with WinQuote. The sidebar, capture surface and sample quote now reuse the unchanged Old Man Winter mark from the actual winter-cpq repository, paired with WinQuote as in the approved homepage V2. The browser title is “WinQuote · Feedback”; its favicon uses the same mark. This supersedes the Annora display-brand section above. Provenance is in `assets/brand/winquote-sources.json`. The underlying Annora prototype repository, workflow, existing evidence and separate homepage deliverable retain their existing scope.

## Curated customer PDF demonstration

The default entry presents one PDF journey. Explore workspace retains the full inbox, old PDF routes, Create paths and role walkthroughs. The presentation advances the existing CaseEngine, stores its record in the same workspace, and preserves exact version snapshots. A guided role change is a presentation control; it does not grant a real customer's permission or execute a backend action.

Reference lock: [Attio's two-column onboarding](https://refero.design/pages/eb21b4a5-a1da-4aa3-9b2c-62765f5aac5f) supplies the current-decision / visible-outcome composition; its monochrome style reference `9f0c028b-6b11-415e-ab92-f32e4597cbe2` supplies fine borders and type hierarchy. [Cycle's AI verification](https://refero.design/pages/c1c2e9c3-86b5-4689-b61d-bec0da43a0e9) supplies the explicit team gate on AI drafts. Keep the already approved Source Serif Pro / Inter pairing and WinQuote navy. Do not import Cycle's dark palette or replace established fonts.

| Decision | Reference / requirement | Application |
| --- | --- | --- |
| One current action | Attio onboarding; customer demo quality goal | Focused task column, outcome column, persistent action footer; no role dropdown in the primary path. |
| Human screening | Cycle verification; agreed AI/team ownership | An editable private question and internal-only decisions precede explicit send. Zero questions remains possible. |
| Visible causality | User's adaptive UI goal | Selecting the next task updates suggested behavior and matching checks together. Team confirmation remains separate. |
| Return to the same work | Agreed customer return journey | A clearly labelled simulated notification returns to the same WQ ID. No real email, delivery service or cross-browser messaging is claimed. |
| Exact-version decision | Existing workflow contract | Accept, request adjustment and release authorization name the submitted version; V2 requires a real edit and new preview. |
| Calm motion | Current decision focus | Brief scene reveal and affected-content emphasis, disabled with reduced motion. |

The quote document is an illustrative sample. The walkthrough can demonstrate intended behavior and decisions; it is not proof of real PDF generation, customer comprehension, business benefit or customer sign-off. Historical scope allows a zero-question route; the curated Ask branch makes the proposed customer touchpoint visible without claiming the historical ticket necessarily requires it.


## Customer workspace navigation · November 5 correction

The customer workspace now has only My feedback and Updates as permanent destinations. Walkthrough is a collapsible secondary launcher, informed by the supplied Attio Getting started reference. Its compact summary keeps the current ticket ID, responsible role and next customer step visible; expanded controls distinguish continuing this record, changing the demo perspective, and starting another sample. Existing PDF, Create and role routes remain available.

The approved serif headings / neutral sans text, white canvas, thin borders and WinQuote navy are unchanged. Status filters and search belong inside My feedback. The current ticket identity remains visible at narrow widths. Mobile uses the same record-bound summary in a compact bottom dock. Desktop keeps it in navigation to avoid duplicating the guide.

Counts and updates share the local WinQuote customer scope. Customer submissions (including the curated submitted PDF case) are distinct from example-only records. Legacy records without customer-origin evidence are retained under Earlier demo records, outside customer counts. This is prototype metadata, not authentication or access control. A notification opens its record as Requester at the current version; resuming a guide uses that same live record and cannot revive another ticket's cached completion.
