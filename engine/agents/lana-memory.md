# Memory

*Updated by agent after each run. Do not edit manually.*

## Lessons Learned
- db-helper.js update takes JSON arg: `'{"id":31,"status":"awaiting_approval"}'` — NOT positional args
- Inline buttons must be sent via direct Telegram API (curl) with reply_markup, not via message tool
- IMPORTANT: Respect 1-per-project-per-day rule across multiple runs on the same day
- 2026-02-22: Fixed failed publish logic for lightingdesign-studio (401 error). Moved to awaiting_approval.
- 2026-02-22: `lightingdesign.studio` API requires `content` field (not just `html`). Updated `pipeline-cli.js` to send both.
- Use `query` for SQL UPDATEs, not `run` (db-helper.js doesn't support run).
- Duplicate slug (HTTP 500 from remote API): fix by appending a suffix (-guide, -2026, etc.) to the slug before retrying.
- `himalaya` CLI: use `himalaya template send` with a piped full email (headers + body) to send notifications. `himalaya send` does not exist.
- Always verify done_for_today against actual published_today vs daily_limit. If done_for_today=1 but published_today < daily_limit, the flag was set incorrectly — clear it and proceed.
- If pipeline-cli rejects with "Content appears to be raw markdown, not HTML", set article status → ready_for_design so Zala can convert it. Never try to force-publish raw markdown.

## Per-Project Notes

### lightingdesign-studio
- 2026-02-21: Article #122 "Lighting design for your living room" sent for review → awaiting_approval
- 2026-02-22: Published #122 (Failed initially with 401, fixed by sending `content` field, re-published successfully).
- 2026-02-22: Daily limit reached.
- 2026-02-22 (09:29 UTC): Published #123 "Circadian Lighting: Designing for Wellbeing". Had duplicate slug conflict — resolved by appending `-guide` suffix. 2/3 daily slots used.
- 2026-02-22 (10:22 UTC): Published #124 "Light and Shadow: The Forgotten Dialogue". Duplicate slug again — fixed by appending `-guide`. 3/3 daily slots used. Daily limit reached.
- 2026-02-22 (13:55 UTC): Published #135 "From Clinical to Spa: Designing Bathroom Lighting That Doesn't Wake You Up". Sent email notification to Breda. 4/5 daily slots used.
- 2026-02-22 (17:16 UTC): Published #136 "Can Lighting Design Improve Employee Productivity?". done_for_today was incorrectly set (daily_limit=5, not 3). Cleared flag and published. Sent email to Breda. 5/5 daily slots used.

### nakupsrebra
- 2026-02-21: Article #119 sent for review.
- 2026-02-21: Published #58, #57, #64.
- 2026-02-21: Skipped #62 (daily limit reached).
- 2026-02-22: Published #62.
- 2026-02-22: Published #129 "Zlato prebilo 5.000 $...". 2/2 daily limit reached.
- 2026-02-23 (22:00 UTC): Published #132 "Kdaj prodati srebro? Vodnik za izstopno strategijo". 1/2 daily slots used. Vercel deploy successful. Notified Sebastjan.
- 2026-02-23 (23:40 UTC): Article #1 "5 napak pri nakupu srebra" was status=ready but had only raw markdown (no HTML). pipeline-cli rejected it. Set status → ready_for_design so Zala can process it.
- 2026-02-24: Published #86 "Primanjkljaj srebra: Kaj to pomeni za vlagatelje v 2026?". 1/2 daily slots used. Vercel deploy + Sebastjan notified.
- 2026-02-24 (12:21 UTC): Published #114 "Kje vse so rudniki srebra in kakšne so zaloge". 2/2 daily slots used. Vercel deploy successful. Notified Sebastjan.

### avant2go-subscribe
- 2026-02-19: Article #89 sent for review.
- 2026-02-21: Published #99, #97, #92, #94.
- 2026-02-21: Skipped #100 (daily limit reached).
- 2026-02-22: Published #100.
- 2026-02-22: Daily limit reached.

### baseman-blog
- 2026-02-17: Article #31 sent for review.
- 2026-02-21: Published #44, #59, #60, #61.
- 2026-02-21: Skipped #82 (daily limit reached).
- 2026-02-22: Published #82.
- 2026-02-22: Daily limit reached.

## Patterns to Avoid
- Do not publish multiple articles from same project in one day (unless limits allow)
- Always verify article is fully ready before sending preview
- Check memory for same-day publications before sending new ones

## What Works Well
- Inline approval workflow via Telegram API curl
- Concise article previews with first ~200 chars
- Selecting oldest article per project

## Run History
- 2026-02-23 22:00 UTC: Published nakupsrebra #132 "Kdaj prodati srebro? Vodnik za izstopno strategijo (ki ga nihče drug ne napiše)". 1/2 daily slots used. Vercel deploy successful. Notified Sebastjan. All other projects had 0 ready articles.
- 2026-02-23 23:40 UTC: nakupsrebra #1 "5 napak pri nakupu srebra" found as ready but had raw markdown only (no HTML). Rejected by pipeline-cli. Set to ready_for_design for Zala to process. No publishes this run.
- 2026-02-23 23:56 UTC: nakupsrebra #1 came back as ready again — still raw markdown, pipeline-cli rejected again. Re-set to ready_for_design. This article keeps cycling back without HTML conversion. No publishes this run. ⚠️ Recurring issue: Zala may not be picking up ready_for_design articles for this project.
- 2026-02-24: Published #86 "Primanjkljaj srebra: Kaj to pomeni za vlagatelje v 2026?". 1/2 daily slots used. Vercel deploy + Sebastjan notified.
- 2026-02-24 10:12 UTC: No ready articles in queue. All projects have capacity (0 published today, limits: nakupsrebra 2, baseman-blog 1, avant2go-subscribe 1, lightingdesign-studio 5). Pipeline is idle — waiting for upstream agents to produce content.
- 2026-02-24 11:26 UTC: Published nakupsrebra #86 "Primanjkljaj srebra: Kaj to pomeni za vlagatelje v 2026?". 1/2 daily slots used. Vercel deploy successful. Notified Sebastjan.
- 2026-02-24 12:12 UTC: Found ready nakupsrebra #114 "Kje vse so rudniki srebra...". Rejected by pipeline-cli (raw markdown). Updated status to ready_for_design. No other articles ready.
- 2026-02-24 12:21 UTC: Published nakupsrebra #114 "Kje vse so rudniki srebra in kakšne so zaloge". 2/2 daily slots used. Vercel deploy successful. Notified Sebastjan. Previous raw markdown issue resolved itself (or Zala fixed it).
