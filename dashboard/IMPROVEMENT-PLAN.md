# Oly Control Panel — Pipeline GUI Improvement Plan

*Feb 21 2026 · Implementation-focused · Same layout, truthful state*

---

## What Already Works

| Feature | Status | Source |
|---------|--------|--------|
| Kanban board with drag-and-drop | ✅ | `ArticleCard.tsx` |
| Semaphore badges (waiting/queued/running/blocked) | ✅ | Router `/pipeline/agents` → API merge |
| Agent name + emoji on cards | ✅ | Router `/pipeline/agents` |
| "On hold" / "Up next" / "Working" labels | ✅ | `ArticleCard.tsx` |
| Stuck detection (hours in status) | ✅ | Client-side thresholds |
| Approve / Reject / Request Changes per phase | ✅ | `ApprovalActions.tsx` + `verification.ts` |
| Publish via pipeline-cli | ✅ | `approval.ts` → `pipeline-cli.js publish` |
| Enqueue via Router | ✅ | `POST /pipeline/enqueue` (CLI only, no GUI form) |
| Trigger agent manually | ✅ | `POST /pipeline/trigger` (CLI only, no GUI button) |
| `publish_mode` per project | ✅ | Project config JSON |
| `agent_runs` audit trail | ✅ | DB table, logged by agents |
| `pipeline_log` basic transitions | ✅ | DB table, logged by dashboard + agents |
| Priority system (normal/high/now) | ✅ | DB column + Router respects it |

---

## PHASE 1 — Make the GUI "Truthful"

**Goal:** Same layout. Every card reflects real trigger/agent state. No UI-only status.

### P1.1 — Unified Event Table

Replace `pipeline_log` with `article_events`:

```sql
CREATE TABLE article_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id),
  project TEXT NOT NULL,
  phase TEXT,                    -- article status at time of event
  event_type TEXT NOT NULL,      -- see event types below
  agent TEXT,                    -- agent name or 'dashboard' or 'router'
  agent_type TEXT,               -- 'pipeline' | 'system' | 'human'
  status TEXT,                   -- 'started' | 'completed' | 'failed' | 'blocked'
  priority TEXT,                 -- article priority at time of event
  blocked_reason TEXT,           -- human-readable, only for blocked events
  error_message TEXT,            -- only for failed events
  detail TEXT,                   -- short description
  metadata JSON,                 -- arbitrary context (run_id, duration_ms, etc.)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ae_article ON article_events(article_id, created_at DESC);
CREATE INDEX idx_ae_type ON article_events(event_type, created_at DESC);
```

**Event types:**

| event_type | When | Key fields |
|------------|------|------------|
| `status_change` | Article moves between phases | phase (new), detail ("review → ready_for_design") |
| `agent_started` | Router spawns agent for this article | agent, metadata.run_id, metadata.started_at |
| `agent_completed` | Agent finishes successfully | agent, metadata.duration_ms, metadata.tokens |
| `agent_failed` | Agent errors out | agent, error_message, metadata.error_code |
| `agent_blocked` | Agent couldn't proceed (WIP/quota) | agent, blocked_reason |
| `enqueued` | Article created via enqueue | agent="human", priority |
| `manual_advance` | Human approves/advances phase | agent="dashboard", detail |
| `manual_reject` | Human rejects/requests changes | agent="dashboard", detail, metadata.feedback |
| `priority_changed` | Priority updated | detail ("normal → now") |
| `published` | Article goes live | metadata.url |
| `cancelled` | Article removed from pipeline | agent="dashboard" |

**Who writes events:**

| Writer | Events | How |
|--------|--------|-----|
| Router | `agent_started`, `agent_blocked` | Direct DB write (router already has DB access) |
| Agents (via Router) | `agent_completed`, `agent_failed`, `status_change` | Router writes on spawn/poll completion detection |
| Dashboard | `manual_advance`, `manual_reject`, `enqueued`, `priority_changed`, `cancelled` | Server actions write to DB |

**Migration:** Copy existing `pipeline_log` rows into `article_events`, then drop `pipeline_log`.

### P1.2 — Card State Derivation

State derivation rules (computed by API, not UI):

```
SEMAPHORE = f(router_agent_status, article_status, last_event):

  if article.status in [published, promoted]     → done
  if article.status == failed                     → failed
  if router says agent is actively running        → running
  if router says WIP blocked                      → blocked
  if router says queued (cooldown or age < 5min)  → queued
  if last_event.type == agent_failed (< 1h ago)   → failed
  else                                            → waiting
```

**Card displays (already partially built, needs refinement):**

| Semaphore | Badge | Extra info on card |
|-----------|-------|--------------------|
| `waiting` | gray dot | — |
| `queued` | yellow dot | ETA if available ("~3 min") |
| `running` | green pulsing dot | Agent emoji + name + elapsed ("🕷️ Pino · 2 min") |
| `blocked` | red dot | Short reason ("Other articles need to finish first") |
| `failed` | red ✕ | Truncated error + "Retry" link |
| `done` | green ✓ | Published URL |

**What to add to current `ArticleCard.tsx`:**
- `failed` state (read from last `agent_runs` entry with `status=error` for this article)
- Last activity timestamp ("Rada finished 3m ago")
- Priority badge: 🔥 `high`, ⚡ `now`
- Retry count badge if article has gone backward (count `manual_reject` events)

### P1.3 — Agent Visibility per Card

Enhance Router `/pipeline/agents` response to include:

```json
{
  "44": {
    "semaphore": "running",
    "agent": "pino",
    "agentEmoji": "🕷️",
    "agentName": "Pino",
    "detail": "2 min",
    "runId": "abc-123",
    "startedAt": 1740100000000,
    "lastEvent": {
      "type": "agent_started",
      "agent": "pino",
      "created_at": "2026-02-21T10:00:00Z"
    }
  }
}
```

**What to add:** `lastEvent` field — Router reads latest `article_events` row per article and includes it. This gives the card everything it needs without extra API calls.

### P1.4 — Minimal Diagnostics (Blocked/Failed)

No new screens. Use a popover on the blocker badge (click to expand).

**Blocked popover content (computed server-side in `/pipeline/agents`):**

```json
{
  "blockedDiagnostic": {
    "reason": "wip_limit",
    "detail": "Article #58 (nakupsrebra) is in 'ready' — must publish before new articles flow",
    "blockingArticleId": 58,
    "suggestion": "Publish #58 or set this article to priority=now to bypass"
  }
}
```

**Failed popover:** Show `error_message` from last `agent_failed` event + "Retry" button.

---

## PHASE 2 — Controls + Governance

**Goal:** Humans can intervene and approve safely. Same layout. Wired to Router/trigger endpoints.

### P2.1 — Enqueue Form

Add to pipeline page header (dropdown or slide-out panel, not a new page):

| Field | Type | Required | Source |
|-------|------|----------|--------|
| Title | text input | ✅ | user |
| Project | dropdown (3 projects) | ✅ | project configs |
| Priority | radio: Normal / High / Now | default: High | user |
| Brief/angle | textarea | optional | user |

**Wiring:** `POST /pipeline/enqueue` (already exists). Form just wraps it.
**Event:** Writes `enqueued` event to `article_events`.

### P2.2 — Card Action Buttons

Add to each card (inline or overflow menu):

| Action | When visible | Endpoint | Event |
|--------|-------------|----------|-------|
| **Run now** | semaphore = queued or blocked | `POST /pipeline/trigger` | `priority_changed` |
| **Retry** | semaphore = failed | `POST /pipeline/trigger` + reset status to previous phase | `status_change` |
| **Cancel** | any non-terminal | `PUT /api/pipeline/[id]` → status=backlog | `cancelled` |
| **Set priority** | any non-terminal | `PUT /api/pipeline/[id]` → update priority | `priority_changed` |

"Run now" sets `priority=now` on article, then calls `/pipeline/trigger` for the appropriate agent. Router already bypasses WIP limits for `priority=now`.

### P2.3 — Governance: Publishing Mode

Already implemented in project config (`publish_mode: auto | approval`). What needs to happen:

**Auto mode (current for all 3 projects):**
- Lana publishes directly. No gate. Event: `published`.

**Approval mode:**
- Lana sets status to `awaiting_approval` instead of publishing.
- Card in `awaiting_approval` column shows: Approve / Reject buttons (already in `ApprovalActions.tsx`).
- Approve → calls `pipeline-cli.js publish` → event: `published`.
- Reject → sends back to `writing` with feedback → event: `manual_reject`.

**Config enforcement:** When creating a project (currently JSON file), `publish_mode` is required. Dashboard could show current mode as a badge on column header.

### P2.4 — Verification Gates (Per-Phase Approve/Reject)

Already built in `ApprovalActions.tsx`. What needs verification and wiring:

| Phase | Gate available | Approve → | Reject → |
|-------|---------------|-----------|----------|
| `writing` | ✅ | `review` | — (can't reject what's being written) |
| `review` | ✅ | `ready_for_design` | `writing` + feedback |
| `ready_for_design` | ✅ | `ready` | `review` + feedback |
| `ready` | ✅ | `published` (via pipeline-cli) | `ready_for_design` + feedback |
| `awaiting_approval` | ✅ | `published` (via pipeline-cli) | `writing` + feedback |

**What to add:**
- Every approve/reject writes an `article_event` (currently writes to `pipeline_log`, needs migration)
- Pipeline continues or stops based on the status change (Router polls status, so this works automatically)
- Show verification history in article timeline (Phase 1.1 events)

### P2.5 — "Why Blocked?" Diagnostic Popover

Expand the Phase 1 blocker popover with actionable info:

| Blocker type | Diagnostic message | Action offered |
|-------------|-------------------|----------------|
| WIP limit | "Article #58 is in 'ready' for nakupsrebra" | "View #58" link + "Run now (bypass)" button |
| Daily quota | "1 article already published today for nakupsrebra" | — (wait until tomorrow) |
| Cooldown | "Pino last ran 2m ago, next in 3m" | "Force run" button |
| Router down | "Pipeline Router not responding" | "Check system health" link |
| Agent failed | "Rada timed out: no response in 5m" | "Retry" button |

All data comes from Router `/pipeline/agents` (already returns blocker details) + `article_events` for error history.

---

## Acceptance Criteria

### Phase 1 ✅ Truthful GUI

- [ ] `article_events` table created with all event types
- [ ] Every status change (agent or manual) writes an event to `article_events`
- [ ] Pipeline API (`GET /api/pipeline`) returns `semaphore`, `agentName`, `agentEmoji`, `agentDetail`, `lastEvent` per article
- [ ] Card semaphore is derived from Router + events (no hardcoded "scheduler disabled" or UI-only state)
- [ ] Card shows agent name + elapsed time when `running` (pulsing green dot)
- [ ] Card shows "On hold" + short reason when `blocked`
- [ ] Card shows red badge + truncated error when `failed` (from last `agent_failed` event)
- [ ] Card shows priority badge (🔥/⚡) for high/now
- [ ] Card shows "last activity" timestamp ("Pino finished 3m ago")
- [ ] Card shows retry count if article has been rejected/sent back
- [ ] Clicking blocked/failed badge shows diagnostic popover with reason
- [ ] Existing `pipeline_log` data migrated to `article_events`
- [ ] Auto-refresh (15s poll) updates cards without losing scroll position

### Phase 2 ✅ Controls + Governance

- [ ] Enqueue form in pipeline page header: title + project + priority + optional brief
- [ ] Enqueue creates article in DB + writes `enqueued` event + Router picks it up
- [ ] "Run now" button on queued/blocked cards: sets priority=now + triggers agent via Router
- [ ] "Retry" button on failed cards: resets status + triggers agent
- [ ] "Cancel" button: moves article to backlog + writes `cancelled` event
- [ ] "Set priority" dropdown: updates priority + writes `priority_changed` event
- [ ] `publish_mode: approval` projects block at `awaiting_approval` with Approve/Reject buttons
- [ ] `publish_mode: auto` projects publish automatically (no gate)
- [ ] Every approve/reject action writes event to `article_events`
- [ ] Approve at `ready` or `awaiting_approval` triggers publish via pipeline-cli
- [ ] Reject sends article back to target phase with feedback
- [ ] "Why blocked?" popover shows: blocker type, blocking article (with link), and available action
- [ ] All control actions are reflected in article event timeline within 15s
- [ ] No UI-only state: every button writes to DB/Router, UI reads back from same source

---

## Required Backend Changes

### New: `article_events` table
See schema in P1.1.

### Router changes

| Change | Endpoint | Description |
|--------|----------|-------------|
| Write events to DB | internal | On spawn → `agent_started`, on poll detect completion → `agent_completed` |
| Add `lastEvent` to `/pipeline/agents` | GET | Read latest `article_events` row per article |
| Add `blockedDiagnostic` to `/pipeline/agents` | GET | Structured blocker info with `blockingArticleId` and `suggestion` |
| Accept `articleId` in `/pipeline/trigger` | POST | So "Run now" can target a specific article's agent |

### Control Panel API changes

| Change | Endpoint | Description |
|--------|----------|-------------|
| Enqueue form API | `POST /api/pipeline/enqueue` | Proxy to Router `/pipeline/enqueue` |
| Priority update | `PUT /api/pipeline/[id]` | Add priority field to update schema |
| Cancel article | `PUT /api/pipeline/[id]` | Status → backlog + event |
| Event timeline | `GET /api/pipeline/[id]/events` | Return `article_events` for article |
| All server actions write events | `verification.ts`, `approval.ts` | Replace `pipeline_log` writes with `article_events` |

### No changes needed

- Router `/pipeline/trigger` — already works for manual agent trigger
- Router `/pipeline/enqueue` — already works with title + project + priority
- `ApprovalActions.tsx` — already handles per-phase approve/reject/request changes
- `publish_mode` in project configs — already respected by Lana
- `agent_runs` table — keep as-is for execution metrics, `article_events` is for audit

---

## Build Order

| # | Task | Est. | Depends on |
|---|------|------|------------|
| 1 | `article_events` table + migration from `pipeline_log` | 1h | — |
| 2 | Server actions write to `article_events` (verification.ts, approval.ts) | 1h | #1 |
| 3 | Router writes `agent_started`/`agent_completed`/`agent_blocked` events | 2h | #1 |
| 4 | Router `/pipeline/agents` adds `lastEvent` + `blockedDiagnostic` | 1h | #1, #3 |
| 5 | Pipeline API merges `lastEvent` + diagnostics into response | 1h | #4 |
| 6 | Card enhancements: failed state, priority badge, last activity, retry count | 2h | #5 |
| 7 | Diagnostic popover on blocked/failed badges | 1h | #5, #6 |
| 8 | Auto-refresh (15s poll, preserve scroll) | 1h | #5 |
| **Phase 1 done** | | **~10h** | |
| 9 | Enqueue form (pipeline page header) | 2h | #1 |
| 10 | Card action buttons: Run now, Retry, Cancel, Set priority | 2h | #1, #5 |
| 11 | Event timeline component on article detail page | 2h | #1, #2, #3 |
| 12 | "Why blocked?" popover with actions (View blocking article, Force run) | 1h | #7, #10 |
| 13 | Verify governance flow end-to-end (auto + approval modes) | 1h | all |
| **Phase 2 done** | | **~8h** | |
| **Total** | | **~18h** | |
