# Memory

*Updated by agent after each run. Do not edit manually.*

## Lessons Learned
- db-helper.js `update` command takes JSON with `id` field, not raw SQL
- Some nakupsrebra articles have corrupted created_at (1900-01-01) — skews avg pipeline time
- lightingdesign-studio is a new project (first appeared W08 2026)
- Record output: 36 articles in W08 across 4 projects

## Per-Project Notes

### nakupsrebra (Silver Blog)
- 11 articles published W08 (up from ~6-8)
- 24 total published, 10 todo, 2 backlog — backlog critically low
- 4 articles with corrupted created_at timestamps
- Pipeline time ~7 days (for articles with valid dates)

### baseman-blog
- 9 articles published W08
- 16 total published, 6 todo, 1 promoted, 0 backlog — needs topic gen
- Pipeline time ~5.6 days

### avant2go-subscribe
- 10 articles published W08 (big jump from 5 previous week)
- 11 total published, 10 todo, 0 backlog — needs topic gen
- Pipeline time ~3.9 days

### lightingdesign-studio (NEW)
- 5 articles published in first week
- Near-zero pipeline time (0.08 days) — likely pre-written/imported content
- No backlog or todo items — needs full pipeline setup

## Patterns to Avoid
- Allowing backlogs to hit 0 (baseman-blog and avant2go already there)
- Trusting nakupsrebra pipeline time averages without filtering corrupted dates

## What Works Well
- Bea consistently generating social drafts (15 batches this week)
- Cross-project publishing velocity is excellent
- Pipeline router handling 4 projects simultaneously
