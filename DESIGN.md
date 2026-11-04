---
name: "Feedback Flow · WinQuote"
description: "A light feedback record with editable source text, a versioned candidate and acceptance evidence."
colors:
  bg: "#f5f5f7"
  nav: "#f4f4f6"
  paper: "#fff"
  type: "#222228"
  ink2: "#50505a"
  muted: "#73737d"
  line: "#e9e9ec"
  blue: "#5146c9"
  blue-hover: "#4339b0"
  lav: "#efedfc"
  pass: "#39836a"
  danger: "#a54b31"
  source-field: "#f8f8fa"
  proof-panel: "#fcfcfe"
  proof-text: "#282733"
  version-wash: "#f0eef9"
  version-ink: "#655991"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Inter\", \"Helvetica Neue\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "clamp(24px, 2.05vw, 31px)"
    fontWeight: 660
    lineHeight: 1.28
    letterSpacing: "-.035em"
  candidate:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Inter\", \"Helvetica Neue\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "clamp(19px, 1.65vw, 24px)"
    fontWeight: 490
    lineHeight: 1.43
    letterSpacing: "-.022em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Inter\", \"Helvetica Neue\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Inter\", \"Helvetica Neue\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "12px"
    fontWeight: 520
    lineHeight: 1.4
  version:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 560
    lineHeight: "17px"
rounded:
  tag: "4px"
  control: "6px"
  field: "7px"
  panel: "8px"
  sheet: "11px"
spacing:
  section-separation: "24px"
  inspector-gutter: "18px"
  mobile-gutter: "16px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.paper}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "6px 11px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "#454550"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "6px 11px"
  button-subtle:
    backgroundColor: "{colors.paper}"
    textColor: "#454550"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "6px 11px"
  source-field:
    backgroundColor: "{colors.source-field}"
    textColor: "#33333e"
    rounded: "{rounded.field}"
    padding: "11px 13px"
  queue-row:
    textColor: "#565660"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  version-chip:
    backgroundColor: "{colors.version-wash}"
    textColor: "{colors.version-ink}"
    typography: "{typography.version}"
    rounded: "{rounded.tag}"
    padding: "0 5px"
  candidate-panel:
    backgroundColor: "{colors.proof-panel}"
    textColor: "{colors.proof-text}"
    rounded: "{rounded.panel}"
    padding: "16px 18px 18px"
---

# Feedback Flow · WinQuote feedback workspace
Primary lock: [Cycle’s light feedback document](https://refero.design/pages/2b8f8897-0054-472f-8cf3-eb5b57582e87). Also inspected [Cycle’s dark feedback + insights layout](https://refero.design/pages/a721db29-4fe5-490c-9dc2-f6eaccdf0d82) and the actual previous build. The light product screenshot, not Cycle marketing or the prior “live paper” motion study, governs the page.

| Decision | Reference → application |
| --- | --- |
| Document sheet | Cycle’s quiet left navigation and white document surface frame the record. Keep the object title compact enough for the current task to lead. |
| Task hierarchy | Four milestones orient the reader. The current step shows the owner, their decision and the action that moves the record forward. The completed view leads with one versioned receipt. |
| Secondary pane | Cycle’s tab row and divider. The persistent right panel holds Details and Activity. Details contains the original request, requester answer and immutable submitted versions. Drafting, preparation and review also expose Checks. On phones, Feedback details opens the same panel as a bottom sheet. |
| Accent + components | Small 16px strokes, compact toolbar, slate tones and an indigo primary action. Semantic colors limited to people, requirement status, and handoffs. No large purple panels. |
| Editing | Selected source phrase, updated candidate and measured value share one short pulse. Edited record remains anchored; reduced motion omits the pulse. |
| Accountability | Woven review packet and agreed user journey: separate the requirement from its result, exact sources, visible owner, recorded snapshots, accepted version separate from publication. |
| Walkthrough | Use the actual record with a small transport bar. Show simulated human decisions, pause/back/next/replay. Do not add a second copy of the form or auto-write real reviews. |

## Overview

A record opens to its current task. Past feedback, answers and delivered versions live in the right-hand Details tab, with the event timeline in Activity. After release, the main workspace contains a single receipt identifying the released version and its approval. Walkthroughs start from navigation.

## Colors

Use indigo for the walkthrough, forward actions and the active tab underline. The neutral rail frames a white document. Dividers separate reading regions. Use the pale source field for editable words and the near-white proof panel for the candidate. Green check icons identify passing evidence, rust identifies failed evidence, and gray with an explicit Reviewer judgment label identifies checks that need a person.

## Typography

Use the system sans stack for Chinese and English. The current task is the most prominent heading. Candidate copy is larger than the 14px source text and uses a lighter weight. The retained next-step instruction begins on its own line. IDs and version tags use system monospace. Evidence measurements use tabular numerals.

## Layout

| Viewport | Navigation and document | Evidence |
| --- | --- | --- |
| Above 1120px | 198px rail and 52px top bar. The document body caps at 850px. At 1640px and wider, the document column’s contents cap at 1130px. | Width follows `clamp(267px, 23vw, 342px)`. |
| 821–1120px | 164px rail and 21px document side padding. | Fixed 248px pane. |
| 661–820px | 210px off-canvas navigation, 48px top bar and edge-to-edge sheet. | Fixed 240px pane. |
| 660px and below | Single column with 16px side padding. All four progress labels are visible. | Summary below the candidate opens a bottom sheet capped at the smaller of 77dvh and 640px. |

## Elevation & Depth

The rail, document and inspector meet along 1px borders. Shadows are reserved for dialogs and the open mobile evidence sheet. Keyboard focus uses a 2px indigo outline on buttons and links.

## Shapes

Use small rectangles for actions and version tags, softly rounded corners for the source and proof, and circles for owners and status indicators. The desktop sheet has an 11px radius. At 820px and below it fills the viewport with square corners.

## Components

- **Feedback source.** The field grows from 56px to 320px. Its minimum rises to 76px on small screens. Focus changes its background to white and adds a 2px lavender outline.
- **Candidate and checks.** A version tag sits beside the candidate section heading. Changed candidate fragments and affected evidence rows briefly highlight. Opening a check reveals its source. A failed word count also shows the excess in words.
- **Owner and actions.** The current step names the responsible role and gives that person one primary action. Reduced-motion preferences disable animations and transitions.
- **Review and release.** Separate controls label acceptance, authorization and simulated publication. The receipt keeps acceptance and site-owner authorization distinct. The sidebar keeps older versions and the activity log available at every stage.
