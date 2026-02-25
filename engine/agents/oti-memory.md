# 🦦 Oti — Memory

## Created
2026-02-16. Unified research agent for all 3 projects (previously Vuk/Žiga/Jež).

## Lessons Learned
- Continued success with unified research approach
- Growing importance of open-source AI models from diverse global sources
- Benchmarking becoming more sophisticated, moving beyond simple metrics
- Car subscription market showing significant growth potential
- Increasing regulatory complexity in mobility sector
- Chinese New Year holiday creates significant liquidity gaps in precious metals markets — worth tracking annually
- The Jan 30 crash (silver -26%, gold -9%) was driven by Kevin Warsh Fed chair nomination + mechanical liquidation, not fundamentals
- Silver Institute annual reports (released ~Feb 10) are excellent primary sources
- Fortune.com is reliable for daily USD spot prices
- MetalPriceAPI gives EUR prices but can lag intraday moves
- morning-briefing.sh has JSON parsing issues — fall back to direct API + web search
- Strong US jobs data is now a bearish catalyst for metals (delays rate cuts)
- Conformance suites (like test262) are the new prompt engineering for coding agents (Ladybird Rust port)
- Hardware stocks (Raspberry Pi) can move violently on AI software hype (OpenClaw usage)

## Best Sources Per Project

### Silver (nakupsrebra)
- MetalPriceAPI for live EUR prices (direct API call if morning-briefing.sh fails)
- Fortune.com for daily USD spot prices with % changes
- Silver Institute for structural supply/demand data
- Kitco, Reuters, Morningstar for breaking news and analysis
- LiveMint for China/Asia precious metals impact
- Crux Investor for selloff analysis
- USAGOLD daily-silver-price-history — excellent daily market narrative with key data points
- JM Bullion for physical demand indicators (shipping delays = demand signal)
- World Gold Council GoldHub for central bank/India data
- Benzinga for streaming/mining deal coverage

### Tech (baseman-blog)
- Hacker News front page, simonwillison.net (Gold mine for AI engineering patterns)
- GitHub trending for OSS (note: readability extraction often fails on trending page — content is mostly navigation/language links)
- Added: LM Council for model benchmarks, MIT Technology Review
- TechCrunch good for same-day AI model release coverage
- TechStartups.com good for daily tech news roundups
- The Register excellent for open-source community/governance stories
- dnyuz.com can sometimes bypass NYT paywall for Paul Ford style pieces
- InfoQ good for GitHub/enterprise dev tools coverage
- Business Standard (India) reliable for India AI Summit / sovereign AI coverage

### Mobility (avant2go-subscribe)
- ACEA for comprehensive automotive statistics (excellent for full-year and monthly EU data)
- Finance.si for Slovenian market
- Electrek for EV sales data and global market analysis (very reliable, detailed)
- Reuters automotive for breaking industry news (paywalled — search snippets still useful)
- Jalopnik for consumer sentiment and subscription backlash stories
- Automotive News Europe for OEM strategy and partnerships
- Electrive for EU regulatory/tariff details
- Custom Market Insights for subscription market trends
- Straits Research for mobility service insights
- vision-mobility.de EN section appears dead (404) — deprioritize

## Recurring Themes
- Open-source AI gaining ground
- Increasingly complex AI model evaluation methods
- Global diversification of AI research and development
- Subscription-based services expanding across industries
- Regulatory environments becoming more nuanced and complex
- Silver: structural deficit is THE story (6th consecutive year in 2026)
- Silver: correction after Jan parabolic run was mechanical, not fundamental
- China is now a dominant force in physical precious metals demand
- Sonnet-class models closing gap on Opus — mid-tier becoming practical for most tasks
- Growing open-source backlash against AI integration in dev platforms (GitHub Copilot pushback)
- Multilingual/edge AI becoming a competitive differentiator (Cohere Tiny Aya, India AI Summit sovereign LLMs)
- GPU programming abstractions evolving: Rust on GPU, CUDA alternatives gaining traction
- "November Moment" becoming mainstream narrative — credible voices (Ford, Fowler, Willison) converging
- AI infrastructure arms race: Meta-Nvidia, Yotta $2B, Humain-xAI $3B — compute is geopolitics
- Expert Generalist as new developer archetype — specialist knowledge losing value to LLM-driving skill
- AI agent security architectures emerging — GitHub's sandboxed approach is a template
- Developer tools for AI agents (Rodney, Showboat) = growing category
- "Code is cheap now" — verification via conformance suites > generation (Ladybird Rust port)
- Browser APIs for agents > vision-based scraping (WebMCP)

## Tech Research Log
- 2026-02-24 (Tue): Massive day for AI engineering. Ladybird browser ported 25k lines of C++ to Rust in 2 weeks using Claude Code + Codex, byte-for-byte verified with test262. This proves conformance suites are the unlock for AI migrations. Raspberry Pi stock surged 60% in a month (+8% today) on "OpenClaw" usage hype — home servers becoming agent servers. Google WebMCP live in Chrome 146 Canary — standardized API for agent tools. Simon Willison released "Agentic Engineering Patterns" guide. Convergence: infrastructure (WebMCP), hardware (RPI), and methodology (conformance suites) all maturing simultaneously.
- 2026-02-23 (Mon): Huge day. Ladybird adopts Rust (1002 pts HN) — Andreas Kling used Claude Code + Codex to port 25K lines of LibJS in 2 weeks, byte-for-byte verified via test262. THE case study for AI-assisted code migration. Same day, Willison launched "Agentic Engineering Patterns" guide — structured GoF-style patterns for working with coding agents. First chapters: "code is cheap now" + "red/green TDD." Also trending: AI-built FreeBSD Wi-Fi driver (net-new, not a port). Apple released AI Reasoning & Planning workshop videos (agent-focused). Samsung S26 Unpacked this week with multi-agent AI + Perplexity. PgDog (Postgres scaling proxy) on Show HN at 157pts. Convergence theme: AI coding agents going from "can it work?" to "here are the engineering patterns."
- 2026-02-22 (Sun): Quieter Sunday but high-signal. Willison posted WebMCP + CDP demo — Google's browser API for structured AI agent interaction is the big infrastructure story. Also linked Gabriel Chua's Codex architecture breakdown (models trained WITH harness, first official acknowledgment). GLM-5 from Zhipu AI dropped: 744B MoE, MIT license, 77.8% SWE-bench, trained on Huawei Ascend = frontier without NVIDIA. HN front page: Loops (federated TikTok, 123pts), Shuru (local Linux MicroVMs for macOS, 86pts), Terence Tao math essentials. OpenAI $600B compute through 2030, ChatGPT 900M weekly users. Sunday = less breaking news but WebMCP + Codex architecture are article-worthy.
- 2026-02-21 (Sat): "Claws" category emergence day. Morning: Karpathy coined term. Evening update: Hardware implementations (zclaw/MimiClaw on ESP32) appeared same day + Tao of Mac coverage + OpenClaw Mega Cheatsheet. Speed of meme/category formation is unprecedented — software concept -> hardware implementation in <12h. Other news: AWS/Kiro outage confirmed AI-caused. Claude Code Security still impacting cybersec stocks. dbreunig post on "Why is Claude an Electron app?" adds philosophical depth to agent interface debate.
- 2026-02-20: Massive day. Two converging stories: (1) Anthropic Claude Code Security launch — first AI lab product to directly crash a mature sector (cybersecurity stocks tanked same day, Bloomberg/Fortune/Seeking Alpha all covered). Free for OSS maintainers = smart distribution. (2) ggml.ai joins Hugging Face — local AI consolidation play, Transformers↔GGML integration promised. Taalas custom silicon ($169M raised) runs Llama 8B at 17K tok/s = inference ASIC moment. F-Droid "Keep Android Open" hit #1 HN (839 pts). Filippo Valsorda "Turn Dependabot Off" gaining traction. AI-as-ad-platform narrative emerging (Juno Labs on HN).
- 2026-02-19: Gemini 3.1 Pro launch is the big story — Google aggressively pricing at $2/$12 per million tokens (half of Opus), 77.1% on ARC-AGI-2. High demand causing slowness/errors per Willison. Mid-tier model compression accelerating: Sonnet 4.6 ≈ Opus at 1/5 cost, Gemini 3.1 Pro undercuts both. Premium tier pricing power collapsing. India AI Summit Day 4: Amodei positioning India as central to AI governance for Global South. Two interesting Show HN tools: micasa (home management TUI, local-first) and cmux (Ghostty terminal for AI agents with notifications/scriptability). Both point to CLI tooling renaissance.

## Latest Research Insights
- European car subscription market projected to reach $3.2B by 2033
- EU BEV market share hit 17.4% in 2025, hybrids dominate at 34.5% (ACEA Jan 2026)
- Petrol+diesel fell to 35.5% combined (from 45.2% in 2024) — inflection point
- Europe sold 320K+ EVs in Jan 2026, +24% YoY — subsidies driving growth
- EU minimum price framework for China-made EVs now operational (Cupra Tavascan first)
- Stellantis reviving diesel for 7+ models — EV transition not linear
- In-car feature subscription fatigue growing — potential tailwind for car-subscription-as-alternative positioning
- Ford-Renault partnership signals OEM cost-sharing trend for affordable European EVs
- Toyota Yaris EV confirmed for 2027/2028 — major affordable EV segment expansion
- Tesla deploying Grok AI to 9 EU markets (Feb 18) — in-car AI as competitive differentiator
- Tesla EU sales -27% in 2025 (ACEA) — using AI/software to recover
- UK study: used EV battery health exceeds vehicle life — strong signal for subscription fleet residual values
- Uber investing in EU EV charger expansion — infrastructure tailwind for electric fleets
- Polestar 4 new EVs by 2028 — premium EV segment expanding subscription fleet options
- In-car feature subscription backlash going mainstream — S&P Global: only 35% willing to pay
- Automakers dropping Apple CarPlay for $625B in-car advertising — "dashboard land grab"
- Zeekr entered SI/HR in 2025, Italy in Feb 2026, FR/UK/ES planned 2026 — Chinese EV pressure growing
- Kia-Wrisk subscription insurance in UK — OEM-embedded insurance bundling trend
- VW targeting 20% cost cuts by end 2028
- Silver: physical investment forecast +20% to 227 Moz in 2026
- Silver: industrial fabrication declining 2% due to solar PV thrifting
- Silver: cumulative supply shortages 2021-2025 approaching 820M oz
- Silver: BHP-Wheaton $4.3B streaming deal = largest ever, tightens spot supply from April 1
- Silver: Central banks cumulative gold buying hit 2,000 tonnes — floor-pricing the market
- Silver: India gold imports 95-100t in Jan, digital gold +70% MoM, ETFs > equity funds for first time
- Silver: China export licensing restricting 60-70% of global refined silver supply
- Silver: Solar PV 120-125 Moz + EV 70-75 Moz industrial demand in 2026
- Silver: Industrial demand now >50% of total consumption (up 50% since 2015)
- Silver: V-shaped reversal Feb 17→18 shows buy-the-dip mentality entrenched
- Tech: Ladybird ported 25k lines to Rust in 2 weeks via Claude Code + Codex (Feb 24) — proves verification via test262 is the key constraint
- Tech: Raspberry Pi stock +60% on OpenClaw usage — hardware infrastructure for local agents arriving
- Tech: WebMCP in Chrome 146 Canary — standardized agent API for websites
- Tech: Claude Sonnet 4.6 preferred over Opus 4.5 59% of the time — mid-tier model disruption
- Tech: Gentoo→Codeberg migration = bellwether for open-source AI backlash
- Tech: Cohere Tiny Aya (3.35B, 70+ languages, offline) — small multilingual models are having a moment
- Tech: BarraCUDA + VectorWare async/await = GPU programming alternatives accelerating
- Tech: Paul Ford NYT piece = cultural legitimization of "vibe coding" ($350K fun)
- Tech: Martin Fowler "LLMs eating specialty skills" — Expert Generalist framing
- Tech: GitHub Agentic Workflows in preview — sandboxed AI agents in Actions, supports Copilot/Claude Code/Codex
- Tech: Sonnet 4.6 now default for Pro/Team — near-Opus at Sonnet pricing compresses premium tier value
- Tech: Simon Willison converting to strong typing after 25 years — because AI agents benefit from explicit types
- Tech: Sarvam AI 30B/105B launched (India AI Summit) — sovereign multilingual models, works on feature phones
- Tech: Let's Encrypt DNS-PERSIST-01 — persistent auth records for certificates, big QoL for scale ops
- Tech: CSS zero-day CVE-2026-2441 in Chrome — actively exploited, unusual attack surface
- Tech: Anthropic $30B Series G at $380B (Feb 12), Humain→xAI $3B, Meta→Nvidia multi-year chip deal
- Tech: Rodney v0.4.0 (Willison) — browser automation CLI for coding agents, 8 PRs in 1 week
- Tech: WebMCP (Google) — browser-native standard for agent-web interaction, Chrome 146 Canary preview, Willison built CDP demo
- Tech: Codex models trained WITH their harness (tool use baked into training) — first official OpenAI acknowledgment via Gabriel Chua
- Tech: GLM-5 (Zhipu AI) — 744B MoE, 44B active, MIT license, 77.8% SWE-bench, trained on Huawei Ascend (no NVIDIA)
- Tech: OpenAI $600B compute spend through 2030, ChatGPT 900M weekly active users, targeting $1T IPO valuation
- Tech: Ladybird browser C++→Rust port: 25K lines in 2 weeks via Claude Code + Codex, test262 conformance = zero regressions. Conformance suites are THE unlock for AI-assisted porting.
- Tech: Willison "Agentic Engineering Patterns" — GoF-style guide for coding agent best practices. Distinguishes agentic engineering (pros + agents) from vibe coding (no attention to code).
- Tech: AI generated a net-new FreeBSD Wi-Fi kernel driver (brcmfmac) — not a port, truly new systems code
- Tech: Apple released AI Reasoning & Planning workshop videos — agent applications focus, ahead of March 4 M5 event

## Price Tracking (Recent)
- 2026-02-19: Silver €2.15/g, Gold €136.47/g, G/S 64.2 — consolidation near $5,000 gold
- 2026-02-20: Silver €2.31/g, Gold €139.34/g, G/S 62.8 — Iran ultimatum drives gold above $5,000
- 2026-02-21 (Sat): JM Bullion late Fri $85.32/oz. Weekend — geopolitical risk from Iran deadline
- 2026-02-22 (Sun): MetalPriceAPI Silver €2.31/g, Gold €139.23/g. USAGOLD $84.59. India MCX ₹2.75 lakh/kg steady.
- 2026-02-23: Silver €2.40/g, Gold €142.60/g, G/S 59.4 — triple catalyst day (Section 122 tariff + Iran + hot PCE). Silver $86.61 intraday. Gold $5,158.

## Silver Research Log
- 2026-02-23 (Mon, 11PM): Triple catalyst day. Section 122 tariff hiked to 15% (effective Feb 24), Iran talks stalled with military buildup, PCE 0.4% MoM hot = stagflation narrative. Gold $5,158, silver $86.61 (+3%), G/S compressed to 59.4. India MCX silver jumped ₹15,200/kg in single session. Markets.financialcontent.com excellent for daily synthesis articles. db-helper.js doesn't support raw SQL — use direct node better-sqlite3 for DB inserts.
- 2026-02-22 (Sun, 11PM): Weekend wrap. SCOTUS struck down tariffs, replaced with Section 122 10%→15%. Iran ultimatum counting down. Monday gap risk significant.
- 2026-02-21 (Sat, 11PM): Weekend check. No major breaking news on Iran/Trump, ultimatum stands. Tokenized gold (PAXG) trading ~$5,130 (vs $5,062 Fri spot close) suggests safe-haven bid is holding/strengthening over the weekend. Expect Monday gap up.
- 2026-02-21 (Sat): Iran ultimatum is THE story. Trump gave 10-15 day deadline for Iran nuclear freeze — dual carrier groups heading to Hormuz. Gold punched through $5,000 to $5,062, silver outperformed at +3.85% ($80.62 USAGOLD, $85.32 JM Bullion late). G/S compressed to 62.8. Goldman Sachs confirmed re-accelerating sovereign gold buying. CarbonCredits published solid overview: 6th consecutive deficit year, solar thrifting reducing per-panel usage but volume offsets. CME futures pricing silver at $91.23 for 2026. Weekend = gap risk if Iran situation escalates. CarbonCredits.com is a good new source for silver/energy intersection stories.
- 2026-02-20: Strong recovery day. Silver +3.07% to $80.46/oz, G/S ratio compressed to 60.3. Disruption Banking published excellent post-mortem of the 48-hour meltdown — Bessent called it Chinese speculative blowoff, Russia-USD settlement rumors added pressure. Institutional consensus remains bullish: Weiner $6,000 gold/$120 silver by year-end, BMO/CIBC echoing. Silver +144% YoY per Fortune. Rio Tinto-Glencore merger collapsed. Olympic medals at record valuations (CNBC) — good cultural angle. Manipulation debate resurfacing in mainstream media (ET) signals elevated retail anxiety post-crash.
- 2026-02-18: Major day. V-shaped reversal after Feb 17 selloff — silver +5.7% USD, +5.3% EUR. BHP-Wheaton $4.3B record silver streaming deal on Antamina (effective April 1). Central banks hit 2,000-tonne cumulative gold milestone. India imported 95-100 tonnes gold in Jan, digital gold +70% MoM. China export licensing continues to tighten supply. JM Bullion reporting shipping delays from physical demand. USAGOLD daily market report is excellent for real-time narrative + data synthesis.
- 2026-02-19: Quiet consolidation day. Gold holding near $5,000 psychological level ($4,997.80), silver edging up to $77.81. Central bank 2,000-tonne milestone confirmed as ongoing driver—China now 15 consecutive months of buying. Dollar near 4-year low removes historical headwind. Analysts revised 2026 silver forecast to $79.50/oz (up from $50 in Oct 2025). Industrial demand solid: solar PV 120-125 Moz + EVs 70-75 Moz expected in 2026. Physical market remains tight—JM Bullion still reporting shipping delays. No major breaking news, but underlying fundamentals remain supportive.

## Mobility Research Log
- 2026-02-23 (Mon, 11PM): Big macro day for mobility. EU halted Turnberry Agreement ratification after SCOTUS struck down IEEPA tariffs and Trump pivoted to Section 122 at 15% (effective Feb 24). 150-day limit unless Congress extends. VW -20% US sales Q4 2025, Mercedes cut 2026 margins 150-200bps. Tesla European collapse deepening: -42% France, 82 units Norway in Jan 2026. BYD now officially world's largest EV seller. In-car feature subscription backlash continues building (MixVale piece). Slovakia battery boom covered by Economist. VW March 10 results briefing will reveal 20% cost cut details. Best new source: tradecomplianceresourcehub.com for tariff tracking. TIME and UPI both good for EU trade policy coverage.
- 2026-02-22 (Sun, 11PM): Quieter Sunday but structurally significant. Top signal: Renault margin forecast drop to 5.5% (from 7.6% record) — pricing power eroding across European OEMs. CEPA published major analysis on Chinese EVs sweeping Europe despite 35% tariffs — BYD absorbed costs, pivoted to PHEVs (14x growth), localizing in Hungary (Q2 2026, 100K+/yr). EU Industrial Accelerator Act with 70% local content rule for subsidized EVs heading for March publication. Economist covered Slovakia battery boom. In-car feature subscription backlash still building (AJC op-ed). Cocoon Vehicles (UK competitor) adding Audi Q7 to subscription fleet March 2026. Best article angle: contrast in-car feature subs (hated) vs car subscription (transparent).
- 2026-02-21 (Sat): **Evening Update:** Major local scoop via avtofil.si — Stellantis has revived diesel engines for Peugeot Rifter, Citroën Berlingo, and Fiat Qubo in Slovenia (despite EU diesel share falling to 7.7%). Addresses family/high-mileage demand. VW announcing major 20% cost-cut plan on March 10.
- 2026-02-21 (Sat): Quieter weekend news cycle. Top story: T&E position paper on EU CO2 standards revision (Commission weakened 2035 target from 100% to 90%, BEV share could drop 10pp in 2030). EU Industrial Accelerator Act proposes 70% local content for subsidized EVs. AJC/Cox Automotive published strong op-ed against in-car feature subscriptions ("Are you renting your own vehicle?") — great contrast piece for car subscription positioning. Polestar refreshing existing models instead of launching new ones (cash conservation). Finland first member state to formally position on EU Automotive Package. Best article idea: contrast in-car feature subscriptions (opaque) vs car subscription (transparent, all-in).
- 2026-02-20: Big narrative week for car subscription positioning. In-car feature subscription backlash going mainstream (Jalopnik, AJC, S&P Global 35% stat). Automakers dropping Apple CarPlay to chase $625B in-car ad market (Autoweek, TheAutoExec) — "dashboard land grab" framing. Both trends = strong tailwind for transparent car subscription model. Zeekr launched in Italy (4 models from ~€41K), already in SI/HR from 2025, plans FR/UK/ES in 2026. Kia-Wrisk subscription insurance partnership in UK = OEM-embedded insurance trend. VW targeting 20% cost cuts by 2028. Best article idea: "ownership is becoming a subscription trap" angle — very timely.
- 2026-02-18 (AM): Strong week for mobility intel. EU minimum price framework for China-made EVs now live (Cupra Tavascan = first deal). Stellantis diesel revival is a big signal — EV transition not linear. Ford-Renault partnership for small EVs. Toyota Yaris EV confirmed for 2027/2028. In-car feature subscription backlash growing (only 35% willing to pay per S&P Global). Europe's Jan 2026 EV sales +24% YoY — strongest major region. ACEA data solid source for 2025 full-year stats.
- 2026-02-18 (PM): Evening refresh added 4 stories. Tesla Grok AI rollout to 9 EU markets — in-car AI becoming competitive differentiator (Mercedes = ChatGPT, Tesla = Grok). Tesla EU sales were -27% in 2025, using AI as recovery play. Uber expanding EV charger incentives in EU — supports fleet electrification. UK battery health study very relevant for subscription residual values. Polestar 4 new EVs by 2028. Note: same-day duplicate cron run — morning report was comprehensive, evening was incremental update only. Consider flagging to avoid duplicate runs.
- 2026-02-19: VW overtakes Tesla as Europe's top EV seller — major shift in competitive landscape. Tesla sales -27% YoY, Model Y -28%. Europe now global EV growth leader (+24% vs. -3% global). ACEA full-year 2025 data confirms hybrid-electric leads at 34.5% vs. BEV 17.4% — hybrids remain critical for subscription fleets. Sixt+ pricing benchmark at £599/month UK. No major regulatory changes this week. Quiet but structurally significant day — market maturation story.
