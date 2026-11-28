# Quick task: Help answers inside the owner's preview

Owner (verbatim): "I want the portal, I want to see how the chat bot is presented in the portal, once finished give it to me".

**Not yet tried in the real Claude iOS app.** Every browser test used a stand-in for `window.claude.use('sample')` that returns canned answers. The real model, the iOS consent prompt and real answer quality have not been tested.

## What was built
- assets/js/help.js has one seam. With no server address, and with `window.CVPortalConfig.helpAsk` set, the dialog shows the field and Send, and answers come through helpAsk exactly as server answers do. With neither, the old sentence is unchanged. With a server address, the server answers and helpAsk is never called. A real portal never sets helpAsk.
- .planning/tools/preview/help-preview.js (preview only) builds the same request the server builds: the rules, the right audience's guide, the last 3 exchanges and the page note. It applies the same redaction and guard as server/lib/help.mjs, and uses the server's limits (20 questions, 20 s after consent). It asks for consent before the clock starts. A refused call gives the server's out-of-scope sentence; any other failure gives "Help is not available right now." plus the contact.
- .planning/tools/preview/help-data.js comes from make-help-data.mjs (with `--verify`). The preview page loads help-data.js, then help-preview.js, right before help.js. The publish declares `capabilities: {sample: {}}`.

## Failures first
1. Not run in a real artifact yet (see above).
2. The first green run failed one line in the test (an escaped JSON comparison). The test was fixed to compare the exact stored exchange, which is stricter.
3. The wip save commits carry no trailer lines; the final commit does.

## RED (before the change)
HELP PREVIEW: FAIL (parts run: 5) - preview-sponsor, preview-investor, files; consent RED: FAIL (parts run: 1) - consent. Raw output: red-help-preview.txt, red-consent.txt.

## Verify
HELP PREVIEW: PASS (parts run: 6), 53 PASS; HELP CHAT: PASS (parts run: 10), 234 PASS; server tests 368 pass, 0 fail. Raw output: green-help-preview.txt, help-chat-10-parts.txt, server-tests-tail.txt. The screenshots show the stand-in's canned answer in the real dialog, not a model answer.
