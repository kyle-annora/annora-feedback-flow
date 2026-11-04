# Annora Feedback Flow

[Open the interactive demo](https://kyle-annora.github.io/annora-feedback-flow/)

Try a feedback workflow with the WinQuote homepage as its first example. Edit the request and its proposed copy and acceptance checks update together. The record shows who owns the next step.

- Change the word limit from 18 to 10. The candidate drops from 15 words to 9, and the customer-details reminder stays in place.
- Enter your own feedback and select **Play walkthrough**. If clarification is needed, you can supply a different answer and see the next draft.
- Open **Role walkthroughs** to follow the requester, website team, or site owner. A revision goes back for review. The site owner authorizes simulated publication separately.

AI, backend actions and publication are simulated. Records stay in the visitor's browser.

## Local development

With Node.js installed, run `npm start` to open the editable source locally. Run `npm test` to check the workflow rules and `npm run bundle` to regenerate the two standalone HTML entry points under `docs/`. GitHub Pages serves that directory from `main`.

The [single-file demo](https://kyle-annora.github.io/annora-feedback-flow/Feedback-Flow.html) can also be saved and opened offline.
