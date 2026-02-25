# 🐺 Vuk — Memory

## Created
2026-02-16. Growth Strategist — weekly natural selector for all 3 projects.

## Decisions Log

### Week 08 (2026-02-22) — avant2go-subscribe
- **KILLED #128** "Dizel je nazaj" — polarizing, contradicts EV/sustainability pillar, contrarian hot-take that ages badly.
- **KILLED #103** English expat article — premature, no English infrastructure on blog yet.
- **KILLED #104** English family article — duplicate of published #98 in wrong language.
- **PRIORITIZED #127** "Kdaj se mesečni najem res splača?" — money article, high purchase intent.
- **PRIORITIZED #133** "Naročnina NA avto vs V avtu" — clever differentiation, trending topic.
- 10 articles published in 6 days = same volume disease. Recommended 2/week max.
- Pipeline paused Feb 21 — correct decision.
- Positive: all articles have primary_keyword (only project without SEO gaps).
- Proposed new direction: expat guide in Slovenian, B2B/fleet content, seasonal spring hook.
- DB still lacks "archived" status — used "failed" for kills.

### Week 08 (2026-02-22) — baseman-blog
- **KILLED #107** "AI Design Feedback Loops" — generic, no personal angle, Medium-grade filler.
- **PRIORITIZED #134** Kiro outage piece — timely (story broke Feb 20), ties to local-agent thesis.
- **PRIORITIZED #131** Context files > prompt engineering — evergreen, builds on existing #33.
- Kept #130 (multi-agent orchestration) and #126 ("Claws" category) for weeks 09-10.
- Flagged: 12/16 published articles have null primary_keyword. SEO emergency.
- 9 articles published in one week = too many. Reinforced 2/week max.
- Pipeline paused (both gen + pub) as of Feb 21. Correct decision.
- Proposed new series: "What broke this week" — AI failure teardowns.

### Week 08 (2026-02-22) — nakupsrebra
- **KILLED #118** IEDC Bled article — off-topic, zero silver relevance. Published article, flagged for removal.
- **KILLED #125** duplicate gold $5K article (kept #129 with better title)
- **KILLED #114** rudniki/zaloge overlap with published #116
- **PRIORITIZED #132** "Kdaj prodati srebro" — unique exit strategy gap
- **PRIORITIZED #129** gold $5K timely piece
- Pipeline paused (both gen + pub) as of Feb 21. Recommended throttle to 2-3/week.
- Note: DB has no "archived" status. Used "failed" for kills. #118 is published — needs manual unpublish.
- Flagged: many articles missing primary_keyword (null in DB).

## Patterns

### avant2go-subscribe
- **Strongest content:** Decision-stage articles (calculators, checklists, "is this for me")
- **Moat:** Slovenian-specific car subscription angles — nobody else covers this locally
- **Good base:** 10 foundational articles covering costs, inclusions, EV, family, checklists
- **Weakness:** Volume dump (10 in 6 days), no promotion cycle, no B2B content, no expat content
- **Gap:** Zero multilingual content (English articles premature without infrastructure)
- **Next unlock:** B2B/fleet articles for "za podjetja" category (zero articles), expat guide in Slovenian

### nakupsrebra
- **Strongest content type:** Practical buyer guides (tax, authenticity tests, palice vs kovanci)
- **Moat:** Slovenian-specific angles nobody else covers
- **Weakness:** Off-topic SEO grabs dilute authority; pace over quality
- 11 articles in one week = too many. Quality drops.

### baseman-blog
- **Strongest content type:** From-experience pieces (agent costs, tool comparisons, personal stack)
- **Moat:** Sebastjan's actual setup — nobody else runs this exact stack
- **Weakness:** Volume over quality, missing SEO keywords, batch publishing kills promotion cycles
- 9 articles in one week = absurd for a personal blog
- **Best format:** Timely opinion + personal experience (e.g., Kiro take + "here's what I run locally")

## Cross-Project Observations
- All 3 projects suffer from the same disease: too much too fast, not enough promotion per article.
- avant2go-subscribe is the only project with clean SEO (all keywords filled). Other two need keyword audit.
- DB lacks "archived" status — using "failed" as workaround. Should add proper status.
- Recommended pace across all: 2/week max per project.

## Kill Retrospective
(first week — will review next Sunday whether kills were correct)
- nakupsrebra #118 IEDC: obvious kill, no debate
- nakupsrebra #125 duplicate: obvious kill
- nakupsrebra #114 overlap: borderline — could have been differentiated but wasn't
- baseman-blog #107 design feedback loops: obvious kill, generic filler
- avant2go #128 diesel: right call — brand risk
- avant2go #103/#104 English: right call — infrastructure not ready
