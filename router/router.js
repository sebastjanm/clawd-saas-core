/**
 * Pipeline Router v2 — Event-driven, cron-independent
 * 
 * Receives completion webhooks from OpenClaw cron jobs (Oti, Mači)
 * and spawns pipeline agents directly via /hooks/agent endpoint.
 * No cron job dependencies for pipeline agents (Liso, Pino, Rada, Zala, Lana).
 *
 * Flow:
 *   Oti completes (3/3) → spawn Liso
 *   Liso completes → spawn Pino (per project with todo articles)
 *   Pino completes → check DB for 'review' → spawn Rada
 *   Rada completes → check DB for 'ready_for_design' → spawn Zala
 *   Zala completes → check DB for 'ready' → spawn Lana
 *   Lana completes → terminal (awaiting_approval)
 *
 * Agents are spawned via POST /hooks/agent (isolated sessions).
 * No cron jobs needed. Agent prompts loaded from agent-prompts.json.
 */

import http from 'node:http';
import Database from 'better-sqlite3';
import { readFileSync, appendFileSync, mkdirSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Crash Protection ────────────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  const msg = `[${new Date().toISOString()}] [FATAL] Uncaught: ${err.message}\n${err.stack}\n`;
  try { appendFileSync(join(__dirname, 'logs', 'crashes.log'), msg); } catch {}
  console.error(msg);
  // Don't exit — let PM2 handle it if needed, but try to keep running
});

process.on('unhandledRejection', (reason) => {
  const msg = `[${new Date().toISOString()}] [FATAL] Unhandled rejection: ${reason}\n`;
  try { appendFileSync(join(__dirname, 'logs', 'crashes.log'), msg); } catch {}
  console.error(msg);
});

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PIPELINE_ROUTER_PORT || '4001', 10);
const DB_PATH = process.env.PIPELINE_DB || '/home/clawdbot/clawd/content-pipeline/pipeline.db';
const HOOKS_URL = process.env.HOOKS_URL || 'http://127.0.0.1:18789/hooks/agent';
const HOOKS_TOKEN = process.env.HOOKS_TOKEN || 'f03286cbf278e084e597e42eb18346f1c14aa02f2e4aa2dc58809a58809a9edc';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const COOLDOWN_MS = parseInt(process.env.COOLDOWN_MS || '300000', 10); // 5 min
const LOG_DIR = process.env.LOG_DIR || join(__dirname, 'logs');
const PROJECTS_DIR = process.env.PROJECTS_DIR || '/home/clawdbot/clawd/content-pipeline/projects';
const STATE_FILE = join(__dirname, 'router-state.json');
const SESSIONS_FILE = process.env.SESSIONS_FILE || '/home/clawdbot/.openclaw/agents/main/sessions/sessions.json';

// ─── Session Token Reader ─────────────────────────────────────────────────────

/**
 * Read token usage from OpenClaw session data (single attempt, no retry).
 * Returns { tokensIn, tokensOut, model } or null if not yet available.
 */
function readSessionUsage(sessionKey) {
  try {
    const raw = readFileSync(SESSIONS_FILE, 'utf-8');
    const sessions = JSON.parse(raw);
    const session = sessions[`agent:main:${sessionKey}`];
    if (!session || (!session.totalTokens && !session.outputTokens)) return null;

    const outputTokens = session.outputTokens || 0;
    const totalTokens = session.totalTokens || 0;
    const inputTokens = totalTokens > outputTokens ? totalTokens - outputTokens : 0;

    return { tokensIn: inputTokens, tokensOut: outputTokens, model: session.model || null };
  } catch (err) {
    log('WARN', `readSessionUsage(${sessionKey}): ${err.message}`);
    return null;
  }
}

/**
 * Backfill token data for recent runs where session data wasn't available yet.
 * Called periodically — no race condition, reads only when data exists.
 */
function backfillTokens() {
  try {
    const db = getDb();
    const pending = db.prepare(`
      SELECT id, session_key FROM agent_runs
      WHERE session_key IS NOT NULL
        AND tokens_in IS NULL
        AND started_at > datetime('now', '-1 hour')
      ORDER BY id DESC LIMIT 20
    `).all();

    if (pending.length === 0) return;

    const wdb = getWriteDb();
    const update = wdb.prepare('UPDATE agent_runs SET tokens_in = ?, tokens_out = ?, model = ? WHERE id = ?');
    let filled = 0;

    for (const row of pending) {
      const usage = readSessionUsage(row.session_key);
      if (usage && (usage.tokensIn > 0 || usage.tokensOut > 0)) {
        update.run(usage.tokensIn, usage.tokensOut, usage.model, row.id);
        filled++;
      }
    }

    if (filled > 0) {
      log('INFO', `Backfilled tokens for ${filled}/${pending.length} runs`);
    }
  } catch (err) {
    log('ERROR', `backfillTokens: ${err.message}`);
  }
}

// ─── Project Config (pause switches, publish_mode) ───────────────────────────

function loadProjectConfig(project) {
  try {
    return JSON.parse(readFileSync(join(PROJECTS_DIR, `${project}.json`), 'utf-8'));
  } catch { return {}; }
}

function isGeneratingPaused(project) {
  return !!loadProjectConfig(project).generating_paused;
}

function isPublishingPaused(project) {
  return !!loadProjectConfig(project).publishing_paused;
}

function isDoneForToday(project) {
  try {
    const d = getDb();
    const row = d.prepare(
      "SELECT done_for_today, done_at FROM project_settings WHERE project = ?"
    ).get(project);
    if (!row || !row.done_for_today) return false;
    // Stale check: if done_at is not today, it's expired
    const today = new Date().toISOString().slice(0, 10);
    const doneDate = (row.done_at || '').slice(0, 10);
    return doneDate === today;
  } catch { return false; }
}

function getProjectSettings(project) {
  try {
    const d = getDb();
    return d.prepare("SELECT * FROM project_settings WHERE project = ?").get(project) || {};
  } catch { return {}; }
}

// ─── State Persistence (survives restarts) ───────────────────────────────────

function persistState() {
  try {
    const state = {
      cooldowns: Object.fromEntries(_cooldowns),
      activeRuns: Object.fromEntries(_activeRuns),
      savedAt: Date.now(),
    };
    writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (err) {
    log('ERROR', `State persist failed: ${err.message}`);
  }
}

function loadState() {
  try {
    if (!existsSync(STATE_FILE)) return;
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    const age = Date.now() - (state.savedAt || 0);
    if (age > 30 * 60 * 1000) { log('INFO', 'State file too old (>30min), ignoring'); return; }
    if (state.cooldowns) {
      for (const [k, v] of Object.entries(state.cooldowns)) _cooldowns.set(k, v);
    }
    if (state.activeRuns) {
      for (const [k, v] of Object.entries(state.activeRuns)) _activeRuns.set(k, v);
    }
    log('INFO', `Restored state: ${cooldowns.size} cooldowns, ${activeRuns.size} activeRuns (${Math.round(age/1000)}s old)`);
  } catch (err) {
    log('WARN', `State load failed: ${err.message}`);
  }
}

// ─── Agent Prompts ────────────────────────────────────────────────────────────

let AGENT_PROMPTS = {};
try {
  AGENT_PROMPTS = JSON.parse(readFileSync(join(__dirname, 'agent-prompts.json'), 'utf-8'));
  log('INFO', `Loaded ${Object.keys(AGENT_PROMPTS).length} agent prompts`);
} catch (err) {
  log('ERROR', `Failed to load agent-prompts.json: ${err.message}`);
  process.exit(1);
}

// ─── Known Job IDs (for webhook routing) ──────────────────────────────────────

// Load projects dynamically from the projects directory
function loadProjects() {
  try {
    const files = readdirSync(PROJECTS_DIR);
    return files
      .filter(f => f.endsWith('.json') && !f.startsWith('.') && !f.startsWith('_'))
      .map(f => {
        try {
          const config = JSON.parse(readFileSync(join(PROJECTS_DIR, f), 'utf-8'));
          return { slug: f.replace('.json', ''), ...config };
        } catch {
          return { slug: f.replace('.json', '') };
        }
      });
  } catch (err) {
    log('ERROR', `loadProjects: ${err.message}`);
    return [
      { slug: 'nakupsrebra' },
      { slug: 'baseman-blog' },
      { slug: 'avant2go-subscribe' },
      { slug: 'lightingdesign-studio' },
    ];
  }
}
const PROJECTS = loadProjects();
// Keep backward compat: places that use PROJECTS as string[] get slugs
const PROJECT_SLUGS = PROJECTS.map(p => typeof p === 'string' ? p : p.slug);

const OTI_JOBS = {
  'cf5262ea-bee8-498d-b615-c44d65488b3f': 'nakupsrebra',
  '119b883b-4844-48b9-b954-4f7edd98a66b': 'baseman-blog',
  '4fdb8605-2ff2-49c8-a300-8840c9e066fc': 'avant2go-subscribe',
};

// Track completions per agent run (keyed by date or runId)
const otiCompletions = { date: '', completed: new Set() };

// ─── Pipeline Chain ───────────────────────────────────────────────────────────
// agent:project → { checkStatus, nextAgent }
// When an agent finishes, check DB for articles in checkStatus,
// then spawn nextAgent for that project

const PIPELINE_CHAIN = {
  // Liso finishes → check for 'todo' articles → spawn Pino
  'liso': { checkStatus: 'todo', nextAgent: 'pino' },
  // Pino finishes → check for 'review' articles → spawn Rada
  'pino': { checkStatus: 'review', nextAgent: 'rada' },
  // Rada finishes → check for 'ready_for_design' articles → spawn Zala
  'rada': { checkStatus: 'ready_for_design', nextAgent: 'zala' },
  // Zala finishes → check for 'ready' articles → spawn Lana
  'zala': { checkStatus: 'ready', nextAgent: 'lana' },
  // Lana finishes → check for published articles → spawn Bea
  'lana': { checkStatus: 'published', nextAgent: 'bea' },
  // Bea finishes → terminal
  'bea': null,
};

// ─── State ────────────────────────────────────────────────────────────────────

const _cooldowns = new Map();
const _activeRuns = new Map();

// Proxy maps that auto-persist on mutation
const cooldowns = {
  get: (k) => _cooldowns.get(k),
  set: (k, v) => { _cooldowns.set(k, v); persistState(); },
  has: (k) => _cooldowns.has(k),
  delete: (k) => { _cooldowns.delete(k); persistState(); },
  get size() { return _cooldowns.size; },
  entries: () => _cooldowns.entries(),
  [Symbol.iterator]: () => _cooldowns[Symbol.iterator](),
};
const activeRuns = {
  get: (k) => _activeRuns.get(k),
  set: (k, v) => { _activeRuns.set(k, v); persistState(); },
  has: (k) => _activeRuns.has(k),
  delete: (k) => { _activeRuns.delete(k); persistState(); },
  get size() { return _activeRuns.size; },
  entries: () => _activeRuns.entries(),
  [Symbol.iterator]: () => _activeRuns[Symbol.iterator](),
};

// ─── Database ─────────────────────────────────────────────────────────────────

let db;
function getDb() {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma('journal_mode = WAL');
  }
  return db;
}

let writeDb;
function getWriteDb() {
  if (!writeDb) {
    writeDb = new Database(DB_PATH);
    writeDb.pragma('journal_mode = WAL');
  }
  return writeDb;
}

function findArticles(status, project, agent) {
  // Bea: only published articles that don't have social posts yet
  if (agent === 'bea') {
    return getDb().prepare(
      `SELECT a.id, a.title, a.priority FROM articles a
       WHERE a.status IN ('published', 'promoted') AND a.project = ?
         AND a.id NOT IN (SELECT DISTINCT article_id FROM social_posts WHERE platform = 'twitter')
       ORDER BY a.updated_at DESC LIMIT 3`
    ).all(project);
  }
  return getDb().prepare(
    `SELECT id, title, priority FROM articles WHERE status = ? AND project = ?
     ORDER BY CASE priority WHEN 'now' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, updated_at ASC LIMIT 5`
  ).all(status, project);
}

/**
 * WIP limit check: should we spawn this agent or is downstream blocked?
 * Returns true if blocked (don't spawn).
 */
const WIP_LIMITS = {
  pino: 3,   // max 3 articles downstream per project
  rada: 3,
  zala: 2,
};

function isWipBlocked(agent, project) {
  if (agent === 'lana' || agent === 'liso' || agent === 'bea') return false;
  const d = getDb();
  const downstreamStatuses = {
    pino: ['review', 'ready_for_design', 'ready', 'awaiting_approval'],
    rada: ['ready_for_design', 'ready', 'awaiting_approval'],
    zala: ['ready', 'awaiting_approval'],
  };
  const statuses = downstreamStatuses[agent];
  if (!statuses) return false;
  const placeholders = statuses.map(() => '?').join(',');
  const row = d.prepare(
    `SELECT COUNT(*) as c FROM articles WHERE project = ? AND status IN (${placeholders})`
  ).get(project, ...statuses);
  const limit = WIP_LIMITS[agent] || 3;
  return row.c >= limit;
}

// Liso STOP RULE: don't create briefs if too many in-progress
function isLisoBlocked() {
  const d = getDb();
  for (const project of PROJECT_SLUGS) {
    const row = d.prepare(
      "SELECT COUNT(*) as c FROM articles WHERE project = ? AND status IN ('todo','writing','review','ready_for_design','ready')"
    ).get(project);
    if (row.c > 5) {
      log('INFO', `Liso STOP: ${project} has ${row.c} in-progress articles (>5)`);
      return true;
    }
  }
  return false;
}

/**
 * Create an article brief for human-requested topics.
 * Returns the new article ID.
 */
function enqueueArticle({ project, title, keyword, outline, angle, whyNow, priority, notes }) {
  const wdb = getWriteDb();
  const slug = title.toLowerCase()
    .replace(/[čć]/g, 'c').replace(/[šś]/g, 's').replace(/[žź]/g, 'z')
    .replace(/đ/g, 'd').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
    .slice(0, 80);
  const result = wdb.prepare(`
    INSERT INTO articles (project, title, slug, primary_keyword, outline, angle, why_now, status, priority, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?, datetime('now'), datetime('now'))
  `).run(project, title, slug, keyword || null, outline || null, angle || null, whyNow || null, priority || 'high', notes || 'human-requested');

  return result.lastInsertRowid;
}

function writeArticleEvent(articleId, project, eventType, opts = {}) {
  try {
    const wdb = getWriteDb();
    wdb.prepare(`
      INSERT INTO article_events (article_id, project, phase, event_type, agent, agent_type, status, priority, blocked_reason, error_message, detail, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      articleId, project, opts.phase ?? null, eventType,
      opts.agent ?? null, opts.agentType ?? 'pipeline',
      opts.status ?? null, opts.priority ?? null,
      opts.blockedReason ?? null, opts.errorMessage ?? null,
      opts.detail ?? null, opts.metadata ? JSON.stringify(opts.metadata) : null,
    );

  } catch (err) {
    log('ERROR', `Event write failed: ${err.message}`);
  }
}

function writeArticleEventsForAgent(agentKey, eventType, opts = {}) {
  // Write events for all articles the agent is working on
  const [agent, proj] = agentKey.split(':');
  const statusMap = { pino: 'todo', rada: 'review', zala: 'ready_for_design', lana: 'ready', liso: 'backlog', bea: 'published' };
  const checkStatus = statusMap[agent];
  if (!checkStatus) return;

  const projects = proj === 'all' ? PROJECT_SLUGS : [proj];
  for (const p of projects) {
    const articles = findArticles(checkStatus, p, agent);
    for (const a of articles) {
      writeArticleEvent(a.id, p, eventType, { ...opts, agent, phase: checkStatus });
    }
  }
}

function logAudit(event) {
  try {
    const wdb = getWriteDb();
    wdb.prepare(`
      INSERT INTO router_log (timestamp, source_job_id, source_agent, project, action, target_job_id, target_agent, article_ids, reason)
      VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.sourceJobId ?? null, event.sourceAgent ?? null,
      event.project ?? null, event.action,
      event.targetJobId ?? null, event.targetAgent ?? null,
      event.articleIds ?? null, event.reason ?? null,
    );

  } catch (err) {
    log('ERROR', `Audit log failed: ${err.message}`);
  }
}

function ensureSchema() {
  const wdb = getWriteDb();
  wdb.exec(`
    CREATE TABLE IF NOT EXISTS router_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      source_job_id TEXT, source_agent TEXT, project TEXT,
      action TEXT NOT NULL,
      target_job_id TEXT, target_agent TEXT,
      article_ids TEXT, reason TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_router_log_ts ON router_log(timestamp);
  `);

}

// ─── Agent Spawning (direct, no cron) ─────────────────────────────────────────

/**
 * Spawn an agent directly via /hooks/agent
 * @param {string} agentKey - e.g. "rada:nakupsrebra" or "lana:all"
 * @returns {Promise<{ok: boolean, runId?: string, error?: string}>}
 */
async function spawnAgent(agentKey) {
  // Try exact key first, then fall back to template (e.g. "zala:_template")
  const [agentName, projectSlug] = agentKey.split(':');
  let prompt = AGENT_PROMPTS[agentKey] || AGENT_PROMPTS[`${agentName}:_template`];
  if (!prompt) {
    return { ok: false, error: `No prompt found for ${agentKey}` };
  }

  // Inject project-specific design system for Zala
  let message = prompt.message;
  if (agentName === 'zala' && projectSlug && projectSlug !== '_template') {
    try {
      const projects = loadProjects();
      const projConfig = projects.find(p => p.slug === projectSlug);
      if (projConfig && projConfig.design_system) {
        const dsContent = readFileSync(projConfig.design_system, 'utf-8');
        message = message.replace('{{DESIGN_SYSTEM}}', dsContent);
        message = message.replace('{{PROJECT_SLUG}}', projectSlug);
        log('INFO', `Injected design system for ${projectSlug} (${dsContent.length} chars)`);
      } else {
        message = message.replace('{{DESIGN_SYSTEM}}', '(No design system found for this project. Use clean semantic HTML.)');
        message = message.replace('{{PROJECT_SLUG}}', projectSlug);
        log('WARN', `No design_system in config for ${projectSlug}`);
      }
    } catch (err) {
      log('WARN', `Failed to load design system for ${projectSlug}: ${err.message}`);
      message = message.replace('{{DESIGN_SYSTEM}}', '(Design system file not found. Use clean semantic HTML.)');
      message = message.replace('{{PROJECT_SLUG}}', projectSlug);
    }
  }

  // H4: Each agent run gets its own session (prevents context accumulation)
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const runSuffix = Math.random().toString(36).slice(2, 8);
  const sessionKey = `pipeline:${agentKey.replace(':', '-')}:${dateStr}-${runSuffix}`;

  const body = JSON.stringify({
    message,
    deliver: true,  // announce completion back
    model: prompt.model || 'sonnet',
    allowUnsafeExternalContent: true,  // trusted: Router is localhost, we control prompts
    sessionKey,
  });

  try {
    const res = await fetch(HOOKS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HOOKS_TOKEN}`,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, runId: data.runId, sessionKey };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Spawn agent with retry
 */
/**
 * Count articles in the agent's input status (for completion detection baseline).
 */
function countInitialArticles(agentKey) {
  const statusForAgent = { liso: 'backlog', pino: 'todo', rada: 'review', zala: 'ready_for_design', lana: 'ready', bea: 'published' };
  const [agent, proj] = agentKey.split(':');
  const inputStatus = statusForAgent[agent];
  if (!inputStatus) return 0;
  try {
    const d = getDb();
    const projects = proj === 'all' ? PROJECT_SLUGS : [proj];
    let count = 0;
    for (const p of projects) {
      const row = d.prepare('SELECT COUNT(*) as c FROM articles WHERE status = ? AND project = ?').get(inputStatus, p);
      count += row.c;
    }
    return count;
  } catch { return 0; }
}

async function spawnAgentWithRetry(agentKey, context) {
  const result = await spawnAgent(agentKey);
  if (result.ok) {
    log('INFO', `✅ Spawned ${agentKey} (runId: ${result.runId})`);
    logAudit({ ...context, action: 'spawned', reason: `runId=${result.runId}` });
    activeRuns.set(agentKey, {
      runId: result.runId, sessionKey: result.sessionKey,
      startedAt: Date.now(), initialRemaining: countInitialArticles(agentKey),
    });
    writeArticleEventsForAgent(agentKey, 'agent_started', {
      status: 'started', metadata: { runId: result.runId },
    });
    return result;
  }

  log('WARN', `❌ Failed to spawn ${agentKey}: ${result.error}. Retrying in 5s...`);
  
  // Retry once after 5s
  await new Promise(r => setTimeout(r, 5000));
  const retry = await spawnAgent(agentKey);
  if (retry.ok) {
    log('INFO', `✅ Retry succeeded: ${agentKey} (runId: ${retry.runId})`);
    logAudit({ ...context, action: 'retry_spawned', reason: `runId=${retry.runId}` });
    activeRuns.set(agentKey, {
      runId: retry.runId, sessionKey: retry.sessionKey,
      startedAt: Date.now(), initialRemaining: countInitialArticles(agentKey),
    });
    return retry;
  }

  log('ERROR', `❌ Retry failed: ${agentKey}: ${retry.error}`);
  logAudit({ ...context, action: 'spawn_failed', reason: retry.error });
  return retry;
}

// ─── Core Logic ───────────────────────────────────────────────────────────────

function recordOtiCompletion(project) {
  const today = new Date().toISOString().slice(0, 10);
  if (otiCompletions.date !== today) {
    otiCompletions.date = today;
    otiCompletions.completed = new Set();
  }
  otiCompletions.completed.add(project);
  return otiCompletions.completed.size >= 3;
}

/**
 * Handle: a pipeline agent finished. Check DB and spawn next agent.
 */
async function handleAgentCompletion(sourceAgent, project, sourceJobId) {
  const result = { triggered: [], skipped: [], errors: [] };
  const chain = PIPELINE_CHAIN[sourceAgent];

  // Terminal stage
  if (!chain) {
    log('INFO', `${sourceAgent}/${project} completed → terminal stage`);
    logAudit({ sourceAgent, project, action: 'terminal', sourceJobId });
    result.skipped.push(`${sourceAgent}/${project}: terminal`);
    return result;
  }

  const { checkStatus, nextAgent } = chain;

  // For Liso: check all projects (Liso is project-agnostic)
  const projectsToCheck = sourceAgent === 'liso' ? PROJECT_SLUGS : [project];

  for (const proj of projectsToCheck) {
    // For agents that are project-agnostic (lana, liso), use the unified key
    const isUnifiedAgent = nextAgent === 'lana' || nextAgent === 'liso' || nextAgent === 'bea';
    const cooldownKey = isUnifiedAgent ? `${nextAgent}:all` : `${nextAgent}:${proj}`;
    const agentKey = isUnifiedAgent ? `${nextAgent}:all` : `${nextAgent}:${proj}`;
    const lastTrigger = cooldowns.get(cooldownKey) || 0;
    const now = Date.now();

    // Cooldown check
    if (now - lastTrigger < COOLDOWN_MS) {
      const remainSec = Math.round((COOLDOWN_MS - (now - lastTrigger)) / 1000);
      log('INFO', `Cooldown: ${cooldownKey} (${remainSec}s remaining)`);
      result.skipped.push(`${cooldownKey}: cooldown`);
      // For unified agents, skip ALL projects (one cooldown covers all)
      if (isUnifiedAgent) break;
      continue;
    }

    // Pause checks
    if ((nextAgent === 'lana' || nextAgent === 'bea') && isPublishingPaused(proj)) {
      log('INFO', `Chain skip ${nextAgent}/${proj}: publishing_paused`);
      result.skipped.push(`${nextAgent}/${proj}: publishing_paused`);
      continue;
    }
    if (nextAgent !== 'lana' && nextAgent !== 'bea' && isGeneratingPaused(proj)) {
      log('INFO', `Chain skip ${nextAgent}/${proj}: generating_paused`);
      result.skipped.push(`${nextAgent}/${proj}: generating_paused`);
      continue;
    }

    // Check DB
    const articles = findArticles(checkStatus, proj, nextAgent);
    if (articles.length === 0) {
      log('INFO', `No '${checkStatus}' articles for ${proj}, skipping ${nextAgent}`);
      logAudit({ sourceAgent, project: proj, action: 'no_work', targetAgent: nextAgent, reason: `No articles in ${checkStatus}` });
      result.skipped.push(`${nextAgent}/${proj}: no articles in ${checkStatus}`);
      continue;
    }

    // Intelligent retry guard: auto-fail articles that exceeded max revisions (Pino only)
    if (nextAgent === 'pino') {
      const MAX_REVISIONS = 2;
      for (const a of articles) {
        const full = getDb().prepare('SELECT revision_count, feedback FROM articles WHERE id = ?').get(a.id);
        if (full && (full.revision_count || 0) >= MAX_REVISIONS) {
          log('WARN', `Article ${a.id} ("${a.title}") exceeded ${MAX_REVISIONS} revisions → auto-failing`);
          getDb().prepare("UPDATE articles SET status = 'failed', feedback = feedback || '\n\n[AUTO-FAILED] Exceeded max revision attempts (' || ? || '). Needs human review.', updated_at = datetime('now') WHERE id = ?").run(MAX_REVISIONS, a.id);
          writeArticleEvent(a.id, proj, 'auto_failed', { agent: 'router', reason: `Exceeded ${MAX_REVISIONS} revisions` });
          logAudit({ sourceAgent: 'router', project: proj, action: 'auto_failed', targetAgent: 'pino', articleId: a.id, reason: `revision_count >= ${MAX_REVISIONS}` });
        }
      }
      // Re-fetch after filtering out failed articles
      const remaining = findArticles(checkStatus, proj, nextAgent);
      if (remaining.length === 0) {
        result.skipped.push(`${nextAgent}/${proj}: all articles exceeded revision limit`);
        continue;
      }
    }

    // WIP check: skip if downstream is blocked (saves Opus tokens)
    // Exception: priority 'now' articles bypass WIP
    const hasNow = articles.some(a => a.priority === 'now');
    if (!hasNow && isWipBlocked(nextAgent, proj)) {
      log('INFO', `WIP blocked: ${nextAgent}/${proj}, downstream has articles`);
      logAudit({ sourceAgent, project: proj, action: 'wip_blocked', targetAgent: nextAgent, reason: 'Downstream not clear' });
      // Write blocked event for each article
      for (const a of articles) {
        writeArticleEvent(a.id, proj, 'agent_blocked', {
          agent: nextAgent, phase: checkStatus,
          blockedReason: 'Other articles need to finish first',
        });
      }
      result.skipped.push(`${nextAgent}/${proj}: WIP blocked`);
      continue;
    }

    // Spawn the agent
    const spawnResult = await spawnAgentWithRetry(agentKey, {
      sourceJobId,
      sourceAgent,
      project: proj,
      targetAgent: nextAgent,
      articleIds: articles.map(a => a.id).join(','),
    });

    if (spawnResult.ok) {
      cooldowns.set(cooldownKey, now);
      result.triggered.push(`${nextAgent}/${proj}`);
      // Unified agents: one spawn handles all projects, stop looping
      if (isUnifiedAgent) break;
    } else {
      result.errors.push(`${nextAgent}/${proj}: ${spawnResult.error}`);
    }
  }

  return result;
}

/**
 * Process incoming webhook
 */
async function processWebhook(payload) {
  const result = { triggered: [], skipped: [], errors: [] };
  const jobId = payload?.jobId || payload?.job?.id || payload?.id;
  const status = payload?.status || payload?.runStatus;

  if (!jobId) {
    result.errors.push('No jobId in payload');
    return result;
  }

  // Only process successful completions
  if (status && status !== 'ok') {
    log('INFO', `Job ${jobId} status=${status}, skipping`);
    result.skipped.push(`${jobId}: status=${status}`);
    return result;
  }

  // ── Oti fan-in ──
  const otiProject = OTI_JOBS[jobId];
  if (otiProject) {
    const allDone = recordOtiCompletion(otiProject);
    log('INFO', `Oti/${otiProject} done (${otiCompletions.completed.size}/3)`);
    logAudit({
      sourceJobId: jobId, sourceAgent: 'oti', project: otiProject,
      action: allDone ? 'fan_in_complete' : 'fan_in_waiting',
      targetAgent: 'liso',
      reason: `${otiCompletions.completed.size}/3 Otis done`,
    });

    if (allDone) {
      if (isLisoBlocked()) {
        log('INFO', 'All 3 Otis done but Liso STOP RULE active, skipping');
        result.skipped.push('liso: STOP RULE (>5 in-progress)');
        return result;
      }
      log('INFO', 'All 3 Otis done → spawning Liso');
      const spawnResult = await spawnAgentWithRetry('liso:all', {
        sourceJobId: jobId, sourceAgent: 'oti', project: 'all', targetAgent: 'liso',
      });
      if (spawnResult.ok) {
        cooldowns.set('liso:all', Date.now());
        result.triggered.push('liso/all');
      } else {
        result.errors.push(`liso: ${spawnResult.error}`);
      }
    } else {
      result.skipped.push(`liso: waiting (${otiCompletions.completed.size}/3)`);
    }
    return result;
  }

  // ── Detect which pipeline agent completed ──
  // The webhook payload should contain the source agent info
  // We detect by matching jobId to known cron jobs OR by payload metadata

  // Check if this is a pipeline agent completion announced back
  const sourceAgent = payload?.sourceAgent || detectAgent(jobId, payload);
  const project = payload?.project || detectProject(jobId, payload);

  if (sourceAgent && PIPELINE_CHAIN.hasOwnProperty(sourceAgent)) {
    const chainResult = await handleAgentCompletion(sourceAgent, project, jobId);
    result.triggered.push(...chainResult.triggered);
    result.skipped.push(...chainResult.skipped);
    result.errors.push(...chainResult.errors);
    return result;
  }

  log('INFO', `Unknown job ${jobId}, ignoring`);
  result.skipped.push(`${jobId}: unrecognized`);
  return result;
}

/**
 * Detect which agent completed based on job ID
 */
function detectAgent(jobId, payload) {
  // Map cron job IDs to agents (for backward compat with cron-triggered runs)
  const PINO_IDS = ['ff39b38f', 'cb9a9224', '04cbd999'];
  const RADA_IDS = ['bf1d7630', 'a6c043d4', '006aa8c9'];
  const ZALA_IDS = ['dd8294c1', '3323e568', 'e2fe61f7'];
  const LANA_ID = 'c3b66832';
  const LISO_ID = '13d8409f';

  const short = jobId.slice(0, 8);
  if (PINO_IDS.some(id => short === id)) return 'pino';
  if (RADA_IDS.some(id => short === id)) return 'rada';
  if (ZALA_IDS.some(id => short === id)) return 'zala';
  if (short === LANA_ID.slice(0, 8)) return 'lana';
  if (short === LISO_ID.slice(0, 8)) return 'liso';

  // Check payload for agent name hints
  const msg = JSON.stringify(payload).toLowerCase();
  if (msg.includes('pino')) return 'pino';
  if (msg.includes('rada')) return 'rada';
  if (msg.includes('zala')) return 'zala';
  if (msg.includes('lana')) return 'lana';
  if (msg.includes('liso')) return 'liso';

  return null;
}

function detectProject(jobId, payload) {
  const projectMap = {
    'ff39b38f': 'nakupsrebra', 'bf1d7630': 'nakupsrebra', 'dd8294c1': 'nakupsrebra',
    'cb9a9224': 'baseman-blog', 'a6c043d4': 'baseman-blog', '3323e568': 'baseman-blog',
    '04cbd999': 'avant2go-subscribe', '006aa8c9': 'avant2go-subscribe', 'e2fe61f7': 'avant2go-subscribe',
  };
  const short = jobId.slice(0, 8);
  if (projectMap[short]) return projectMap[short];

  // Liso and Lana are project-agnostic
  if (short === '13d8409f' || short === 'c3b66832') return 'all';

  return 'all';
}

// ─── Completion Detection ─────────────────────────────────────────────────────

const AGENT_MAX_DURATION_MS = {
  liso: 10 * 60 * 1000,
  pino: 15 * 60 * 1000,
  rada: 10 * 60 * 1000,
  zala: 10 * 60 * 1000,
  lana: 5 * 60 * 1000,
  bea: 10 * 60 * 1000,
  bordi: 5 * 60 * 1000,
};

/**
 * Check activeRuns for completion or timeout.
 * Completion = articles moved past the agent's input status.
 * Timeout = agent exceeded max duration and articles are unmoved.
 */
function detectCompletions() {
  const statusForAgent = { liso: 'backlog', pino: 'todo', rada: 'review', zala: 'ready_for_design', lana: 'ready', bea: 'published' };
  const d = getDb();

  for (const [agentKey, run] of [..._activeRuns.entries()]) {
    const [agent, proj] = agentKey.split(':');
    const elapsed = Date.now() - run.startedAt;
    const maxDuration = AGENT_MAX_DURATION_MS[agent] || 15 * 60 * 1000;
    const inputStatus = statusForAgent[agent];
    if (!inputStatus) continue;

    // Check if articles still in the input status for active (non-paused) projects
    const projects = proj === 'all' ? PROJECT_SLUGS : [proj];
    let remaining = 0;
    for (const p of projects) {
      // Skip paused projects — their articles won't move, shouldn't block detection
      const settings = d.prepare('SELECT paused FROM project_settings WHERE project = ?').get(p);
      if (settings?.paused) continue;
      if (isGeneratingPaused(p) && agent !== 'lana' && agent !== 'bea') continue;
      if (isPublishingPaused(p) && (agent === 'lana' || agent === 'bea')) continue;

      const count = d.prepare('SELECT COUNT(*) as c FROM articles WHERE status = ? AND project = ?').get(inputStatus, p);
      remaining += count.c;
    }

    // Also detect completion if articles were updated since the run started
    const runStartIso = new Date(run.startedAt).toISOString();
    const recentlyMoved = d.prepare(`
      SELECT COUNT(*) as c FROM articles 
      WHERE project IN (${projects.map(() => '?').join(',')}) 
        AND updated_at > ? 
        AND status != ?
    `).get(...projects, runStartIso, inputStatus);

    if (remaining === 0 || (recentlyMoved.c > 0 && remaining <= (run.initialRemaining ?? remaining))) {
      // Agent completed: articles moved past input status
      log('INFO', `✅ Completion detected: ${agentKey} (${Math.round(elapsed/1000)}s)`);
      writeAgentRun(agent, proj, run.runId, 'ok', elapsed, null, run.sessionKey);
      activeRuns.delete(agentKey);
    } else if (elapsed > maxDuration) {
      const mins = Math.round(elapsed / 60000);
      log('WARN', `⏰ Timeout: ${agentKey} after ${mins}min, ${remaining} articles unmoved`);
      writeAgentRun(agent, proj, run.runId, 'timeout', elapsed, `Timed out after ${mins}min, ${remaining} articles unmoved`, run.sessionKey);
      activeRuns.delete(agentKey);

      // H3: Reset stuck articles to their input status (undo "writing" etc.)
      const inProgressStatus = { pino: 'writing', rada: 'review', zala: 'ready_for_design' };
      const resetFrom = inProgressStatus[agent];
      if (resetFrom) {
        try {
          const wdb = getWriteDb();
          for (const p of projects) {
            const reset = wdb.prepare(
              "UPDATE articles SET status = ?, claimed_by = NULL, claimed_at = NULL, updated_at = datetime('now') WHERE status = ? AND project = ? AND claimed_by = ?"
            ).run(inputStatus, resetFrom, p, agent);
            if (reset.changes > 0) {
              log('INFO', `Reset ${reset.changes} articles from '${resetFrom}' → '${inputStatus}' for ${p} (${agent} timeout)`);
            }
          }
        } catch (err) {
          log('ERROR', `Timeout reset failed: ${err.message}`);
        }
      }

      // O1: Alert on ALL agent timeouts (not just Lana)
      sendTelegramAlert(`⚠️ ${agent} timeout: ${remaining} articles unmoved after ${mins}min.`);
    }
  }
}

/**
 * Generate a human-readable task summary for an agent run.
 * Pulls recent articles the agent was working on.
 */
function generateTaskSummary(agent, project, status) {
  try {
    const d = getDb();
    const agentLabels = {
      liso: 'Topic research',
      pino: 'Draft writing',
      rada: 'Editorial review',
      zala: 'Design & formatting',
      lana: 'Publishing',
      bea: 'Social posts',
      bordi: 'Social publishing',
    };

    const label = agentLabels[agent] || agent;
    const projects = project === 'all' ? PROJECT_SLUGS : [project];

    // Find articles this agent recently touched (within last 30 min)
    const titles = [];
    for (const p of projects) {
      const rows = d.prepare(`
        SELECT title FROM articles
        WHERE project = ? AND updated_at > datetime('now', '-30 minutes')
        ORDER BY updated_at DESC LIMIT 3
      `).all(p);
      for (const r of rows) {
        if (r.title) titles.push(r.title.length > 50 ? r.title.slice(0, 47) + '...' : r.title);
      }
    }

    if (titles.length === 0) {
      return `${label} (${project})`;
    }
    return `${label}: ${titles.join(', ')}`;
  } catch (err) {
    log('WARN', `generateTaskSummary: ${err.message}`);
    return `${agent} (${project})`;
  }
}

function writeAgentRun(agent, project, runId, status, durationMs, error, sessionKey) {
  try {
    const model = AGENT_PROMPTS[`${agent}:${project}`]?.model || AGENT_PROMPTS[`${agent}:all`]?.model || 'unknown';
    const summary = generateTaskSummary(agent, project, status);

    // Phase 1: Write run immediately. Tokens are NULL — backfillTokens() handles Phase 2.
    const wdb = getWriteDb();
    wdb.prepare(`
      INSERT INTO agent_runs (agent_name, agent_type, job_id, session_key, status, project, started_at, finished_at, duration_ms, error, model, task_summary)
      VALUES (?, 'pipeline', ?, ?, ?, ?, datetime('now', ?), datetime('now'), ?, ?, ?, ?)
    `).run(
      agent, runId, sessionKey || null, status, project === 'all' ? null : project,
      `-${Math.round(durationMs/1000)} seconds`,
      Math.round(durationMs), error, model, summary
    );

    // Write event for affected articles
    const eventType = status === 'ok' ? 'agent_completed' : 'agent_failed';
    const projects = project === 'all' ? PROJECT_SLUGS : [project];
    const statusForAgent = { liso: 'backlog', pino: 'todo', rada: 'review', zala: 'ready_for_design', lana: 'ready', bea: 'published' };
    const inputStatus = statusForAgent[agent];
    // For completed: articles already moved, so we look one status ahead
    // For failed/timeout: articles are still in inputStatus
    if (status !== 'ok' && inputStatus) {
      const d = getDb();
      for (const p of projects) {
        const stuck = d.prepare('SELECT id FROM articles WHERE status = ? AND project = ? LIMIT 5').all(inputStatus, p);
        for (const a of stuck) {
          writeArticleEvent(a.id, p, eventType, {
            agent, phase: inputStatus, status,
            errorMessage: error, metadata: { runId, durationMs },
          });
        }
      }
    }
  } catch (err) {
    log('ERROR', `writeAgentRun failed: ${err.message}`);
  }
}

// ─── Alerting ─────────────────────────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = '8589191593:AAEmIPR6pn1L4WeJEZ07bbhYkK6dKBzyOV8';
const TELEGRAM_CHAT_ID = '260532163';
let lastAlertAt = 0;

async function sendTelegramAlert(text) {
  // Rate limit: max 1 alert per 5 minutes
  if (Date.now() - lastAlertAt < 5 * 60 * 1000) {
    log('INFO', `Alert throttled: ${text.slice(0, 80)}`);
    return;
  }
  lastAlertAt = Date.now();
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(10_000),
    });
    log('INFO', `📨 Alert sent: ${text.slice(0, 80)}`);
  } catch (err) {
    log('ERROR', `Alert failed: ${err.message}`);
  }
}

// ─── DB Polling (fallback for missed webhooks) ────────────────────────────────

/**
 * Periodic DB check: find stuck articles and spawn agents if needed.
 * Runs every 2 minutes as the primary chain mechanism.
 */
async function pollForStuckArticles() {
  // 0. Detect completions/timeouts first, then backfill any missing token data
  detectCompletions();
  backfillTokens();

  // 0.5. Reset stale done_for_today flags (from yesterday)
  try {
    const wdb = getWriteDb();
    wdb.prepare("UPDATE project_settings SET done_for_today = 0, updated_at = datetime('now') WHERE done_for_today = 1 AND DATE(done_at) < DATE('now')").run();
  } catch (err) {
    log('ERROR', `Reset done_for_today: ${err.message}`);
  }

  // 0.6. Auto-approve: move awaiting_approval → ready for projects with auto_approve=1
  try {
    const d = getDb();
    const autoApproveProjects = d.prepare(
      "SELECT project FROM project_settings WHERE auto_approve = 1"
    ).all();
    if (autoApproveProjects.length > 0) {
      const wdb = getWriteDb();
      for (const { project } of autoApproveProjects) {
        const moved = wdb.prepare(
          "UPDATE articles SET status = 'ready', updated_at = datetime('now') WHERE status = 'awaiting_approval' AND project = ?"
        ).run(project);
        if (moved.changes > 0) {
          log('INFO', `Auto-approve: moved ${moved.changes} articles to ready for ${project}`);
          // Write audit events
          const articles = d.prepare("SELECT id FROM articles WHERE status = 'ready' AND project = ? ORDER BY updated_at DESC LIMIT ?").all(project, moved.changes);
          for (const a of articles) {
            writeArticleEvent(a.id, project, 'auto_approved', {
              agent: 'router', agentType: 'system',
              phase: 'awaiting_approval', detail: 'Vacation mode: auto-approved',
            });
          }
        }
      }
    }
  } catch (err) {
    log('ERROR', `Auto-approve: ${err.message}`);
  }

  // 0.7. Router-side done_for_today fallback (if Lana crashed before setting flag)
  try {
    const d = getDb();
    for (const project of PROJECT_SLUGS) {
      const settings = getProjectSettings(project);
      if (settings.done_for_today) continue; // already set
      const limit = settings.vacation_mode ? (settings.vacation_limit || 2) : (settings.daily_limit || 1);
      const published = d.prepare(
        "SELECT COUNT(*) as c FROM articles WHERE project = ? AND status = 'published' AND DATE(published_at) = DATE('now')"
      ).get(project);
      if (published && published.c >= limit) {
        const wdb = getWriteDb();
        wdb.prepare("UPDATE project_settings SET done_for_today = 1, done_at = datetime('now'), updated_at = datetime('now') WHERE project = ?").run(project);
        log('INFO', `Router fallback: set done_for_today for ${project} (${published.c}/${limit} published)`);
      }
    }
  } catch (err) {
    log('ERROR', `Done-for-today fallback: ${err.message}`);
  }
  // 1. Priority "now" articles — bypass cooldowns, trigger immediately
  const statusToAgent = {
    'todo': 'pino',
    'review': 'rada',
    'ready_for_design': 'zala',
    'ready': 'lana',
    'published': 'bea',
  };

  for (const [status, agent] of Object.entries(statusToAgent)) {
    const isUnifiedAgent = agent === 'lana' || agent === 'liso' || agent === 'bea';

    for (const project of PROJECT_SLUGS) {
      const d = getDb();
      const urgent = d.prepare(
        "SELECT id, title FROM articles WHERE status = ? AND project = ? AND priority = 'now' LIMIT 3"
      ).all(status, project);

      if (urgent.length > 0) {
        // Pause checks apply even for priority=now
        if ((agent === 'lana' || agent === 'bea') && isPublishingPaused(project)) { log('INFO', `Skip NOW ${agent}/${project}: publishing_paused`); continue; }
        if (agent === 'lana' && isDoneForToday(project)) { log('INFO', `Skip NOW ${agent}/${project}: done_for_today`); continue; }
        if (agent !== 'lana' && agent !== 'bea' && isGeneratingPaused(project)) { log('INFO', `Skip NOW ${agent}/${project}: generating_paused`); continue; }

        const cooldownKey = isUnifiedAgent ? `now:${agent}:all` : `now:${agent}:${project}`;
        const lastTrigger = cooldowns.get(cooldownKey) || 0;
        if (Date.now() - lastTrigger < 60_000) {
          if (isUnifiedAgent) break;
          continue;
        }

        const agentKey = isUnifiedAgent ? `${agent}:all` : `${agent}:${project}`;
        log('INFO', `🔥 Priority NOW: ${urgent.length} articles in '${status}' for ${project}, spawning ${agent}`);
        
        const spawnResult = await spawnAgentWithRetry(agentKey, {
          sourceAgent: 'priority', project, targetAgent: agent,
          articleIds: urgent.map(a => a.id).join(','),
          reason: `Priority: now`,
        });

        if (spawnResult.ok) {
          cooldowns.set(cooldownKey, Date.now());
          const mainCooldownKey = isUnifiedAgent ? `${agent}:all` : `${agent}:${project}`;
          cooldowns.set(mainCooldownKey, Date.now());
          if (isUnifiedAgent) break;
        }
        continue;
      }
    }
  }

  // 2. Active articles — poll DB for work at ALL pipeline stages.
  // This is the PRIMARY chain mechanism since /hooks/agent completions
  // go to the main session, not back to the router.
  // Short age thresholds + cooldowns = fast pipeline without double-spawns.
  const STATUS_AGE_MINUTES = {
    'todo': 5,              // Pino: pick up soon after Liso creates briefs
    'review': 5,            // Rada: pick up soon after Pino writes
    'ready_for_design': 5,  // Zala: pick up soon after Rada edits
    'ready': 5,             // Lana: pick up soon after Zala designs
  };

  for (const [status, agent] of Object.entries(statusToAgent)) {
    const isUnifiedAgent = agent === 'lana' || agent === 'liso' || agent === 'bea';
    const ageMinutes = STATUS_AGE_MINUTES[status] || 60;

    for (const project of PROJECT_SLUGS) {
      const d = getDb();
      let ready;
      if (agent === 'bea') {
        // Bea: only published articles without social posts
        ready = d.prepare(
          `SELECT a.id, a.title FROM articles a
           WHERE a.status IN ('published', 'promoted') AND a.project = ?
             AND a.id NOT IN (SELECT DISTINCT article_id FROM social_posts WHERE platform = 'twitter')
           ORDER BY a.updated_at DESC LIMIT 3`
        ).all(project);
      } else {
        ready = d.prepare(
          `SELECT id, title FROM articles WHERE status = ? AND project = ? AND updated_at < datetime('now', '-${ageMinutes} minutes') ORDER BY CASE priority WHEN 'now' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, updated_at ASC LIMIT 3`
        ).all(status, project);
      }

      if (ready.length === 0) continue;

      // Pause checks
      if ((agent === 'lana' || agent === 'bea') && isPublishingPaused(project)) {
        log('INFO', `Skip ${agent}/${project}: publishing_paused`);
        for (const a of ready) {
          writeArticleEvent(a.id, project, 'agent_blocked', {
            agent, phase: status, blockedReason: 'Publishing paused for this project',
          });
        }
        continue;
      }
      if (agent === 'lana' && isDoneForToday(project)) {
        continue; // silent skip, no log spam
      }
      if (agent !== 'lana' && agent !== 'bea' && isGeneratingPaused(project)) {
        log('INFO', `Skip ${agent}/${project}: generating_paused`);
        continue;
      }

      // WIP check
      if (isWipBlocked(agent, project)) continue;

      // H6: Circuit breaker — skip articles with 3+ consecutive failures (last 24h only)
      try {
        const failedArticles = getDb().prepare(
          `SELECT a.id FROM articles a WHERE a.status = ? AND a.project = ?
           AND (SELECT COUNT(*) FROM article_events ae
                WHERE ae.article_id = a.id AND ae.event_type IN ('agent_failed','timeout')
                AND ae.created_at > datetime('now', '-24 hours')
                AND ae.created_at > COALESCE(
                  (SELECT MAX(ae2.created_at) FROM article_events ae2 WHERE ae2.article_id = a.id AND ae2.event_type IN ('agent_completed','status_change','enqueued')),
                  '2000-01-01'
                )) >= 3`
        ).all(status, project);
        if (failedArticles.length > 0) {
          const wdb = getWriteDb();
          for (const fa of failedArticles) {
            wdb.prepare("UPDATE articles SET status = 'failed', feedback = 'Circuit breaker: 3+ consecutive agent failures', updated_at = datetime('now') WHERE id = ?").run(fa.id);
            writeArticleEvent(fa.id, project, 'circuit_breaker', {
              agent, phase: status, agentType: 'system',
              detail: `Moved to failed after 3+ consecutive failures`,
            });
            log('WARN', `🔌 Circuit breaker: article #${fa.id} moved to failed (3+ failures in ${status})`);
          }
          sendTelegramAlert(`🔌 Circuit breaker: ${failedArticles.length} article(s) in ${project} moved to failed after repeated ${agent} failures. Check pipeline.`);
        }
      } catch (err) {
        log('ERROR', `Circuit breaker check: ${err.message}`);
      }

      const cooldownKey = isUnifiedAgent ? `${agent}:all` : `${agent}:${project}`;
      const lastTrigger = cooldowns.get(cooldownKey) || 0;
      if (Date.now() - lastTrigger < COOLDOWN_MS) continue; // 5 min cooldown

      const agentKey = isUnifiedAgent ? `${agent}:all` : `${agent}:${project}`;

      // Don't spawn if this agent already has an active run (stale after 15 min)
      const active = activeRuns.get(agentKey);
      if (active && (Date.now() - active.startedAt) < 15 * 60 * 1000) {
        log('INFO', `Skip ${agentKey}: already running (runId=${active.runId}, ${Math.round((Date.now() - active.startedAt)/60000)}min ago)`);
        continue;
      }
      if (active) {
        log('WARN', `Clearing stale activeRun for ${agentKey} (${Math.round((Date.now() - active.startedAt)/60000)}min old)`);
        activeRuns.delete(agentKey);
      }

      log('INFO', `Poll: ${ready.length} articles in '${status}' for ${project} (>${ageMinutes}min), spawning ${agent}`);
      
      const spawnResult = await spawnAgentWithRetry(agentKey, {
        sourceAgent: 'poll', project, targetAgent: agent,
        articleIds: ready.map(a => a.id).join(','),
        reason: `In ${status} >${ageMinutes}min`,
      });

      if (spawnResult.ok) {
        cooldowns.set(cooldownKey, Date.now());
        if (isUnifiedAgent) break;
      }
    }
  }

  // 3. Liso safety net — if Oti webhooks failed, detect fresh intel and spawn Liso
  // Normally Liso is triggered by Oti fan-in (3/3 webhooks), but if webhooks are
  // broken, we check if daily_intel has entries from today and Liso hasn't run.
  try {
    const lisoCooldown = cooldowns.get('liso:all') || 0;
    if (Date.now() - lisoCooldown > 6 * 60 * 60 * 1000) { // Only if Liso hasn't run in 6h
      const d = getDb();
      const today = new Date().toISOString().slice(0, 10);
      const intelCount = d.prepare(
        "SELECT COUNT(DISTINCT project) as c FROM daily_intel WHERE date(created_at) = ?"
      ).get(today);
      if (intelCount && intelCount.c >= 3) {
        // All 3 Otis wrote intel today but Liso hasn't run
        const todoCount = d.prepare(
          "SELECT COUNT(*) as c FROM articles WHERE status = 'todo'"
        ).get();
        // Only spawn Liso if we have fewer than 10 todo articles (don't flood)
        if (todoCount.c < 10) {
          log('INFO', 'Liso safety net: 3 projects have fresh intel, spawning Liso');
          const spawnResult = await spawnAgentWithRetry('liso:all', {
            sourceAgent: 'poll-safety', project: 'all', targetAgent: 'liso',
            reason: 'Safety net: Oti intel detected, Liso not triggered via webhook',
          });
          if (spawnResult.ok) cooldowns.set('liso:all', Date.now());
        }
      }
    }
  } catch (err) {
    log('ERROR', `Liso safety net: ${err.message}`);
  }

  // 4. Bordi — check for approved social posts and spawn publisher
  try {
    const bordiCooldown = cooldowns.get('bordi:all') || 0;
    if (Date.now() - bordiCooldown > 10 * 60 * 1000) { // 10min cooldown
      const d = getDb();
      // Exclude posts from projects with publishing paused
      const allProjects = PROJECT_SLUGS || [];
      const activeProjects = allProjects.filter(p => !isPublishingPaused(p));
      const placeholders = activeProjects.map(() => '?').join(',');
      const approved = activeProjects.length > 0
        ? d.prepare(
            `SELECT COUNT(*) as c FROM social_posts sp
             JOIN articles a ON sp.article_id = a.id
             WHERE sp.status = 'approved' AND a.project IN (${placeholders})`
          ).get(...activeProjects)
        : { c: 0 };
      if (approved && approved.c > 0) {
        const active = activeRuns.get('bordi:all');
        if (!active || (Date.now() - active.startedAt) > 10 * 60 * 1000) {
          if (active) activeRuns.delete('bordi:all');
          log('INFO', `Bordi: ${approved.c} approved social posts, spawning publisher`);
          const spawnResult = await spawnAgentWithRetry('bordi:all', {
            sourceAgent: 'poll', project: 'all', targetAgent: 'bordi',
            reason: `${approved.c} approved social posts`,
          });
          if (spawnResult.ok) cooldowns.set('bordi:all', Date.now());
        }
      }
    }
  } catch (err) {
    log('ERROR', `Bordi check: ${err.message}`);
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // Create New Project (SaaS Onboarding)
  if (req.method === 'POST' && req.url === '/pipeline/projects') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const config = JSON.parse(body);
        if (!config.project_id || !config.client_name) {
          throw new Error('Missing project_id or client_name');
        }

        // 1. Write Config File
        if (!existsSync(PROJECTS_DIR)) mkdirSync(PROJECTS_DIR, { recursive: true });
        const configPath = join(PROJECTS_DIR, `${config.project_id}.json`);
        writeFileSync(configPath, JSON.stringify(config, null, 2));

        // 2. Insert into DB
        const wdb = getWriteDb();
        try {
          wdb.prepare(`
            INSERT INTO project_settings (project, daily_limit, vacation_mode, auto_approve, paused, updated_at)
            VALUES (?, 2, 0, 0, 0, datetime('now'))
          `).run(config.project_id);
        } catch (e) { /* ignore if exists */ }

        // 3. Restart Router to pick up new config file (Simple Reload)
        setTimeout(() => process.exit(0), 500);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', msg: 'Project created. Router restarting...' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', error: err.message }));
      }
    });
    return;
  }

  // Delete Project (SaaS Teardown)
  if (req.method === 'DELETE' && req.url.startsWith('/pipeline/projects/')) {
    const projectId = req.url.split('/').pop();
    if (!projectId || projectId.includes('..')) { // basic safety
       res.writeHead(400, { 'Content-Type': 'application/json' }); 
       res.end(JSON.stringify({ error: 'Invalid ID' })); 
       return;
    }
    
    try {
      // 1. Delete Config
      const configPath = join(PROJECTS_DIR, `${projectId}.json`);
      if (existsSync(configPath)) unlinkSync(configPath);
      
      // 2. Delete DB Record
      const wdb = getWriteDb();
      wdb.prepare('DELETE FROM project_settings WHERE project = ?').run(projectId);
      
      // 3. Restart Router
      setTimeout(() => process.exit(0), 500);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', msg: 'Project deleted' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Health
  if (req.method === 'GET' && req.url === '/pipeline/health') {
    try {
      const d = getDb();
      const row = d.prepare('SELECT COUNT(*) as c FROM articles').get();
      const statusCounts = d.prepare(
        "SELECT status, COUNT(*) as c FROM articles WHERE status NOT IN ('published','promoted','failed') GROUP BY status"
      ).all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        version: 2,
        uptime: process.uptime(),
        articles: row.c,
        pipeline: Object.fromEntries(statusCounts.map(r => [r.status, r.c])),
        cooldowns: Object.fromEntries(_cooldowns),
        activeRuns: Object.fromEntries(_activeRuns),
        otiCompletions: { date: otiCompletions.date, count: otiCompletions.completed.size },
        paused: Object.fromEntries(PROJECT_SLUGS.map(p => {
          const cfg = loadProjectConfig(p);
          return [p, {
            generating: !!cfg.generating_paused,
            generating_by: cfg.generating_paused_by || null,
            generating_at: cfg.generating_paused_at || null,
            publishing: !!cfg.publishing_paused,
            publishing_by: cfg.publishing_paused_by || null,
            publishing_at: cfg.publishing_paused_at || null,
          }];
        })),
        settings: Object.fromEntries(PROJECT_SLUGS.map(p => [p, getProjectSettings(p)])),
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', error: err.message }));
    }
    return;
  }

  // Per-project agent status (for Control Panel semaphores)
  if (req.method === 'GET' && req.url === '/pipeline/agents') {
    try {
      const d = getDb();
      const result = {};

      const statusToAgent = { todo: 'pino', review: 'rada', ready_for_design: 'zala', ready: 'lana' };
      const agentEmoji = { pino: '🕷️', rada: '🦉', zala: '🎨', lana: '🕊️', liso: '🦊' };
      const agentNames = { pino: 'Pino', rada: 'Rada', zala: 'Zala', lana: 'Lana', liso: 'Liso' };

      // Get all active pipeline articles (1 query)
      const articles = d.prepare(
        "SELECT id, project, status, priority, updated_at FROM articles WHERE status NOT IN ('published','promoted','failed','backlog') ORDER BY updated_at"
      ).all();

      if (articles.length === 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
        return;
      }

      const articleIds = articles.map(a => a.id);
      const idPlaceholders = articleIds.map(() => '?').join(',');

      // Batch: last event per article (1 query)
      const lastEvents = new Map();
      try {
        const rows = d.prepare(`
          SELECT ae.article_id, ae.event_type, ae.agent, ae.detail, ae.created_at
          FROM article_events ae
          INNER JOIN (SELECT article_id, MAX(id) as max_id FROM article_events WHERE article_id IN (${idPlaceholders}) GROUP BY article_id) latest
          ON ae.id = latest.max_id
        `).all(...articleIds);
        for (const r of rows) lastEvents.set(r.article_id, r);
      } catch { /* table may not exist */ }

      // Batch: last agent run per article (1 query)
      const lastRuns = new Map();
      try {
        const rows = d.prepare(`
          SELECT ar.article_id, ar.agent_name, ar.status, ar.finished_at, ar.duration_ms, ar.error
          FROM agent_runs ar
          INNER JOIN (SELECT article_id, MAX(id) as max_id FROM agent_runs WHERE article_id IN (${idPlaceholders}) GROUP BY article_id) latest
          ON ar.id = latest.max_id
        `).all(...articleIds);
        for (const r of rows) lastRuns.set(r.article_id, {
          agent: r.agent_name, status: r.status, finishedAt: r.finished_at,
          durationMs: r.duration_ms, error: r.error,
        });
      } catch { /* */ }

      // Batch: retry counts (1 query)
      const retryCounts = new Map();
      try {
        const rows = d.prepare(`
          SELECT article_id, COUNT(*) as c FROM article_events
          WHERE article_id IN (${idPlaceholders}) AND event_type = 'manual_reject'
          GROUP BY article_id
        `).all(...articleIds);
        for (const r of rows) retryCounts.set(r.article_id, r.c);
      } catch { /* */ }

      // Batch: downstream blockers per project (1 query for all blocking articles)
      const blockers = new Map();
      try {
        const rows = d.prepare(`
          SELECT project, id, title, status FROM articles
          WHERE status IN ('review','ready_for_design','ready','awaiting_approval')
          ORDER BY updated_at
        `).all();
        // Group by project, keep first per project
        for (const r of rows) {
          if (!blockers.has(r.project)) blockers.set(r.project, r);
        }
      } catch { /* */ }

      for (const a of articles) {
        const agent = statusToAgent[a.status];
        if (!agent) {
          if (a.status === 'writing') {
            result[a.id] = {
              semaphore: 'running', agent: 'pino',
              agentName: agentNames.pino, agentEmoji: agentEmoji.pino, detail: '',
            };
          }
          continue;
        }

        const isUnified = agent === 'lana' || agent === 'liso' || agent === 'bea';
        const agentKey = isUnified ? `${agent}:all` : `${agent}:${a.project}`;
        const activeRun = activeRuns.get(agentKey);
        const lastTrigger = cooldowns.get(isUnified ? `${agent}:all` : `${agent}:${a.project}`) || 0;
        const ageMinutes = (Date.now() - new Date(a.updated_at + 'Z').getTime()) / 60000;

        let semaphore = 'idle';
        let detail = '';

        if (activeRun && (Date.now() - activeRun.startedAt) < 30 * 60 * 1000) {
          semaphore = 'running';
          const mins = Math.round((Date.now() - activeRun.startedAt) / 60000);
          detail = mins < 1 ? 'Just started' : `${mins} min`;
        } else if (isWipBlocked(agent, a.project) && a.priority !== 'now') {
          semaphore = 'blocked';
          detail = 'Other articles need to finish first';
        } else if (ageMinutes >= 5) {
          const cooldownRemain = Math.max(0, (lastTrigger + COOLDOWN_MS) - Date.now());
          semaphore = 'queued';
          detail = cooldownRemain > 0 ? (cooldownRemain > 60000 ? `~${Math.round(cooldownRemain/60000)} min` : `~${Math.round(cooldownRemain/1000)}s`) : '';
        } else {
          semaphore = 'queued';
          detail = `~${Math.ceil(5 - ageMinutes)} min`;
        }

        // Check failed state from last run
        const lastAgentRun = lastRuns.get(a.id) ?? null;
        if (lastAgentRun?.status === 'error' && semaphore !== 'running') {
          semaphore = 'failed';
          detail = lastAgentRun.error ? lastAgentRun.error.slice(0, 80) : 'Agent failed';
        }

        // Blocked diagnostic (use pre-fetched blockers)
        let blockedDiagnostic = null;
        if (semaphore === 'blocked') {
          const blocker = blockers.get(a.project);
          if (blocker && blocker.id !== a.id) {
            blockedDiagnostic = {
              reason: 'wip_limit',
              detail: `#${blocker.id} "${blocker.title?.slice(0,40)}" is in ${blocker.status}`,
              blockingArticleId: blocker.id,
              suggestion: 'Publish or advance the blocking article, or set priority to "now" to bypass',
            };
          }
        }

        result[a.id] = {
          semaphore, agent,
          agentName: agentNames[agent], agentEmoji: agentEmoji[agent],
          detail, retryCount: retryCounts.get(a.id) ?? 0,
          ...(activeRun ? { runId: activeRun.runId, startedAt: activeRun.startedAt } : {}),
          ...(lastEvents.has(a.id) ? { lastEvent: lastEvents.get(a.id) } : {}),
          ...(lastAgentRun ? { lastAgentRun } : {}),
          ...(blockedDiagnostic ? { blockedDiagnostic } : {}),
        };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      log('ERROR', `[/pipeline/agents] ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // A1: Project settings (GET + PATCH)
  if (req.method === 'GET' && req.url === '/pipeline/settings') {
    try {
      const d = getDb();
      const rows = d.prepare('SELECT * FROM project_settings').all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === 'PATCH' && req.url === '/pipeline/settings') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const { project, ...updates } = JSON.parse(body);
        if (!project || !PROJECT_SLUGS.includes(project)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Invalid project. Valid: ${PROJECT_SLUGS.join(', ')}` }));
          return;
        }
        const allowed = ['daily_limit', 'vacation_limit', 'vacation_mode', 'auto_approve', 'paused', 'done_for_today', 'publish_mode'];
        const sets = [];
        const vals = [];
        for (const [k, v] of Object.entries(updates)) {
          if (!allowed.includes(k)) continue;
          sets.push(`${k} = ?`);
          vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
        }
        if (sets.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No valid fields to update' }));
          return;
        }
        sets.push("updated_at = datetime('now')");
        vals.push(project);
        const wdb = getWriteDb();
        wdb.prepare(`UPDATE project_settings SET ${sets.join(', ')} WHERE project = ?`).run(...vals);
        log('INFO', `Settings updated for ${project}: ${JSON.stringify(updates)}`);

        // Audit event
        try {
          wdb.prepare(
            `INSERT INTO article_events (article_id, project, phase, event_type, agent, agent_type, detail, created_at)
             VALUES (0, ?, 'settings', 'config_change', 'dashboard', 'human', ?, datetime('now'))`
          ).run(project, JSON.stringify(updates));
        } catch { /* non-critical */ }

        const row = getDb().prepare('SELECT * FROM project_settings WHERE project = ?').get(project);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, settings: row }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Stats
  if (req.method === 'GET' && req.url === '/pipeline/stats') {
    try {
      const d = getDb();
      const recent = d.prepare('SELECT * FROM router_log ORDER BY id DESC LIMIT 20').all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ recent }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', error: err.message }));
    }
    return;
  }

  // Manual trigger endpoint
  if (req.method === 'POST' && req.url === '/pipeline/trigger') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { agent, project } = JSON.parse(body);
        const agentKey = agent === 'lana' || agent === 'liso' || agent === 'bea' ? `${agent}:all` : `${agent}:${project}`;
        const result = await spawnAgentWithRetry(agentKey, {
          sourceAgent: 'manual', project: project || 'all', targetAgent: agent,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Enqueue article (human override)
  if (req.method === 'POST' && req.url === '/pipeline/enqueue') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (!data.project || !data.title) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'project and title required' }));
          return;
        }
        if (!PROJECT_SLUGS.includes(data.project)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Invalid project. Valid: ${PROJECT_SLUGS.join(', ')}` }));
          return;
        }
        const articleId = enqueueArticle(data);
        log('INFO', `📝 Enqueued article #${articleId}: "${data.title}" [${data.project}] priority=${data.priority || 'high'}`);
        logAudit({
          sourceAgent: 'human', project: data.project, action: 'enqueued',
          targetAgent: 'pino', articleIds: String(articleId),
          reason: `priority=${data.priority || 'high'}`,
        });

        // If priority=now, trigger Pino immediately (don't wait for poll)
        let triggered = false;
        if (data.priority === 'now') {
          const agentKey = `pino:${data.project}`;
          if (!isWipBlocked('pino', data.project) || data.priority === 'now') {
            const spawnResult = await spawnAgentWithRetry(agentKey, {
              sourceAgent: 'human', project: data.project, targetAgent: 'pino',
              articleIds: String(articleId), reason: 'Human enqueue priority=now',
            });
            triggered = spawnResult.ok;
            if (spawnResult.ok) {
              cooldowns.set(`pino:${data.project}`, Date.now());
            }
          }
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, articleId, triggered, priority: data.priority || 'high' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Webhook (localhost-only, no auth needed — Router binds to 127.0.0.1)
  // ─── Pause/Resume per project ──────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/pipeline/pause') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      const { project, type, paused, by } = payload;
      if (!project || !type || typeof paused !== 'boolean') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Required: project, type (generating|publishing), paused (bool)' }));
        return;
      }
      if (!['generating', 'publishing'].includes(type)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'type must be generating or publishing' }));
        return;
      }
      const configPath = join(PROJECTS_DIR, `${project}.json`);
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        const key = `${type}_paused`;
        config[key] = paused;
        config[`${key}_by`] = by || 'dashboard';
        config[`${key}_at`] = new Date().toISOString();
        writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
        log('INFO', `${type} ${paused ? 'PAUSED' : 'RESUMED'} for ${project} by ${by || 'dashboard'}`);

        // Write event to article_events for audit trail
        try {
          const wdb = getWriteDb();
          wdb.prepare(
            `INSERT INTO article_events (article_id, project, phase, event_type, agent, agent_type, detail, created_at)
             VALUES (0, ?, ?, 'config_change', 'dashboard', 'human', ?, datetime('now'))`,
          ).run(project, type, `${type} ${paused ? 'paused' : 'resumed'} by ${by || 'dashboard'}`);
        } catch { /* non-critical */ }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, project, type, paused }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/pipeline/hook') {

    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      let payload;
      try { payload = JSON.parse(body); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      log('INFO', `Webhook: jobId=${payload?.jobId || '?'}, status=${payload?.status || '?'}`);
      try {
        const result = await processWebhook(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ...result }));
      } catch (err) {
        log('ERROR', `Webhook failed: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ─── Startup ──────────────────────────────────────────────────────────────────

try { ensureSchema(); } catch (err) {
  log('ERROR', `Schema failed: ${err.message}`);
  process.exit(1);
}

// Restore state from previous run
loadState();

// Poll every 2 minutes — primary chain mechanism since /hooks/agent completions
// go to the main session, not back to the router. Lightweight (few SQLite reads).
setInterval(pollForStuckArticles, 2 * 60 * 1000);

server.listen(PORT, '127.0.0.1', () => {
  log('INFO', `Pipeline Router v2 on 127.0.0.1:${PORT}`);
  log('INFO', `Mode: direct agent spawning (no cron dependencies)`);
  log('INFO', `Agents: ${Object.keys(AGENT_PROMPTS).join(', ')}`);
  log('INFO', `Cooldown: ${COOLDOWN_MS / 1000}s | Poll: every 2m | DB: ${DB_PATH}`);
});

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(join(LOG_DIR, `${ts.slice(0, 10)}.log`), line + '\n');
  } catch {}
}

process.on('SIGTERM', () => { persistState(); if (db) db.close(); if (writeDb) writeDb.close(); server.close(() => process.exit(0)); });
process.on('SIGINT', () => { persistState(); if (db) db.close(); if (writeDb) writeDb.close(); server.close(() => process.exit(0)); });
