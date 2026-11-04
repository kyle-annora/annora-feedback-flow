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

[Try the Website team practice](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=team&mode=practice) with the WinQuote template and scratch example. Send V1 for review. The sample requester asks for a clearer distinction between the two entry points. Edit V2, send it, then select **View as Requester** to review the copy you just delivered. You can accept that version or ask the team for another change.

After acceptance, choose **View as Site owner**. Check the accepted wording and its destination, then select **Approve simulated release of V2** (or the version you accepted). The website team simulates the release and returns a receipt for that same version. Opening the owner view does not approve anything. Reopening the exercise in the same browser brings back the current step or its receipt.

[Try the requester’s decisions](https://kyle-annora.github.io/annora-feedback-flow/?walkthrough=customer&mode=practice). Submit the sample, explain your hesitation, and wait for the team’s proposal. At each review, choose **Accept V…** or **Request changes**. Team steps play automatically; review waits for you. Acceptance hands the exact version to the site owner for separate release authorization. A change the simulated team cannot handle stays with the team.

The **Walkthrough** button in the workspace opens the requester practice. Select **Minimize walkthrough** to browse other feedback. The button shows who has the next step and which version is ready. Select it again to return to the current round. In the “Create” example, each review keeps the requester’s answer with the team’s proposal and its review question.

Use **Back** to revisit the previous step, or to return to the inbox from the first step. In requester practice, earlier steps are read-only. **Return to current step** takes you back to your latest answer, review or handoff.

The role player labels its automatic route **Watching example**. Select **Try it yourself** or answer the clarification to take part. The other roles follow the reached practice record in the same tab. **Restart example** returns to the scripted route. Practice is separate from saved feedback.

Each example step explains why that screen appears. Expand its explanation to see what to look for and who takes the next action. Opening the explanation pauses the example so you can read it, and the player can resume when you are ready. The notes follow the current concern, proposal and version.

AI, backend actions and publication are simulated. Records stay in the visitor's browser.

## Local development

With Node.js installed, run `npm start` to open the editable source locally. Run `npm test` to check the workflow rules and `npm run bundle` to regenerate the two standalone HTML entry points under `docs/`. GitHub Pages serves that directory from `main`.

The [single-file demo](https://kyle-annora.github.io/annora-feedback-flow/Feedback-Flow.html) can also be saved and opened offline.
