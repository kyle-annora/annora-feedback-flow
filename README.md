# Annora Feedback Flow

[Open the interactive demo](https://kyle-annora.github.io/annora-feedback-flow/)

Try a feedback workflow with the WinQuote homepage as its first example. Edit the request and its proposed copy and acceptance checks update together. The record shows who owns the next step.

- [Try the Create walkthrough](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=create). The requester finds “Create” unclear. Try both answers to the first question: worrying that a quote will be sent to a customer, or being unsure which quote path to choose. Each answer leads to different team-proposed copy and a different question for the reviewer.
- Change the word limit from 18 to 10. The candidate drops from 15 words to 9, and the customer-details reminder stays in place.
- Enter your own feedback and select **Play walkthrough**. If clarification is needed, you can supply a different answer and see the next draft.
- Open **Role walkthroughs** to follow the same “Create” concern and the same V1/V2 through three responsibilities. Sample actions play automatically.
  - [Requester](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=customer) describes the concern, reviews both versions and hands the accepted V2 to the site owner.
  - [Website team](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=team) drafts from the concern, responds to the revision and delivers V2 to the reviewer.
  - [Site owner](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=publisher) receives that accepted V2, authorizes its release and watches the team simulate it.

Choosing another concern in the Requester walkthrough updates the shared sample for all three roles. Existing personal feedback and label/word-limit examples remain available.

AI, backend actions and publication are simulated. Records stay in the visitor's browser.

## Local development

With Node.js installed, run `npm start` to open the editable source locally. Run `npm test` to check the workflow rules and `npm run bundle` to regenerate the two standalone HTML entry points under `docs/`. GitHub Pages serves that directory from `main`.

The [single-file demo](https://kyle-annora.github.io/annora-feedback-flow/Feedback-Flow.html) can also be saved and opened offline.
