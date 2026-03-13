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
import { execSync } from 'node:child_process';
let runHobi;
try {
  const mod = await import('./src/agents/hobi.js');
  runHobi = mod.run;
} catch (e) {
  console.log('[Router] Optional module hobi.js not found, skipping.');
}


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
const DB_PATH = process.env.PIPELINE_DB || path.join(process.env.HOME, 'clawd-saas-core/db/pipeline.db');
const HOOKS_URL = process.env.HOOKS_URL || 'http://127.0.0.1:18789/hooks/agent';
const HOOKS_TOKEN = process.env.HOOKS_TOKEN || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const COOLDOWN_MS = parseInt(process.env.COOLDOWN_MS || '300000', 10); // 5 min
const MAX_GLOBAL_CONCURRENT = parseInt(process.env.MAX_GLOBAL_CONCURRENT || '3', 10);
const DEFAULT_MAX_CONCURRENT = parseInt(process.env.DEFAULT_MAX_CONCURRENT || '1', 10);
const LOG_DIR = process.env.LOG_DIR || join(__dirname, 'logs');
const PROJECTS_DIR = process.env.PROJECTS_DIR || path.join(process.env.HOME, 'clawd-saas-core/projects');
const STATE_FILE = join(__dirname, 'router-state.json');
const SESSIONS_FILES = [
  process.env.SESSIONS_FILE || path.join(process.env.OPENCLAW_AGENTS_DIR || path.join(process.env.HOME, '.openclaw/agents'), 'main/sessions/sessions.json'),
  path.join(process.env.OPENCLAW_AGENTS_DIR || path.join(process.env.HOME, '.openclaw/agents'), 'factory/sessions/sessions.json'),
  path.join(process.env.OPENCLAW_AGENTS_DIR || path.join(process.env.HOME, '.openclaw/agents'), 'alpha/sessions/sessions.json'),
];
// Keep legacy constant for backward compat
const SESSIONS_FILE = SESSIONS_FILES[0];

// ─── Session Token Reader ─────────────────────────────────────────────────────

/**
 * Read token usage from OpenClaw session data (single attempt, no retry).
 * Checks all agent session files (main, factory, alpha) since V2 routes
 * pipeline spawns to the factory agent.
 * Returns { tokensIn, tokensOut, model } or null if not yet available.
 */
function readSessionUsage(sessionKey) {
  const agentPrefixes = ['agent:main:', 'agent:factory:', 'agent:alpha:'];
  for (const sessFile of SESSIONS_FILES) {
    try {
      const raw = readFileSync(sessFile, 'utf-8');
      const sessions = JSON.parse(raw);
      for (const prefix of agentPrefixes) {
        const session = sessions[`${prefix}${sessionKey}`];
        if (session && (session.totalTokens || session.outputTokens)) {
          const outputTokens = session.outputTokens || 0;
          const totalTokens = session.totalTokens || 0;
          const inputTokens = totalTokens > outputTokens ? totalTokens - outputTokens : 0;
          return { tokensIn: inputTokens, tokensOut: outputTokens, model: session.model || null };
        }
      }
    } catch (err) {
      // File might not exist for some agents, skip silently
    }
  }
  log('WARN', `readSessionUsage(${sessionKey}): not found in any agent session file`);
  return null;
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
        AND started_at > datetime('now', '-5 days')
      ORDER BY id DESC LIMIT 50
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
  // Single source of truth: SQLite
  try {
    const row = getDb().prepare('SELECT generating_paused FROM project_settings WHERE project = ?').get(project);
    return !!row?.generating_paused;
  } catch { return false; }
}

function isPublishingPaused(project) {
  // Single source of truth: SQLite
  try {
    const row = getDb().prepare('SELECT publishing_paused FROM project_settings WHERE project = ?').get(project);
    return !!row?.publishing_paused;
  } catch { return false; }
}

function shouldSkipAgent(project, agent) {
  // Auto-skip Prevo if no translation configured for this project
  if (agent === 'prevo') {
    try {
      const row = getDb().prepare('SELECT translate_to FROM project_settings WHERE project = ?').get(project);
      if (!row?.translate_to) return true; // No translation targets = skip Prevo
    } catch { return true; }
  }

  const cfg = loadProjectConfig(project);
  return Array.isArray(cfg.skip_agents) && cfg.skip_agents.includes(agent);
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
  // Zala finishes → check for 'ready' articles → spawn Prevo (if translation enabled) or Lana
  'zala': { checkStatus: 'ready', nextAgent: 'prevo' },
  // Prevo finishes → check for 'ready' articles → spawn Lana
  'prevo': { checkStatus: 'ready', nextAgent: 'lana' },
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
     ORDER BY CASE priority WHEN 'now' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, updated_at ASC LIMIT 3`
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
  if (agent === 'lana' || agent === 'bea') return false;
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
// isLisoBlocked removed — replaced by per-project backlog check in Oti handler

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
  const statusMap = { pino: 'todo', rada: 'review', zala: 'ready_for_design', prevo: 'ready', lana: 'ready', liso: 'backlog', bea: 'published' };
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

  // Inject {{PROJECT_SLUG}} for any template-based prompt (Liso, Zala, etc.)
  let message = prompt.message;
  if (projectSlug && projectSlug !== '_template' && projectSlug !== 'all') {
    message = message.replaceAll('{{PROJECT_SLUG}}', projectSlug);
  }

  // Inject project-specific design system for Zala
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
    agentId: 'factory',  // V2: Route to factory agent (isolated workspace + tool allowlist)
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
  const statusForAgent = { liso: 'backlog', pino: 'todo', rada: 'review', zala: 'ready_for_design', prevo: 'ready', lana: 'ready', bea: 'published' };
  const [agent, proj] = agentKey.split(':');
  const inputStatus = statusForAgent[agent];
  if (!inputStatus) return 0;
  try {
    const d = getDb();
    const projects = proj === 'all' ? PROJECT_SLUGS : [proj];
    let count = 0;
    for (const p of projects) {
      if (agent === 'bea') { const row = d.prepare("SELECT COUNT(*) as c FROM articles a WHERE a.status = ? AND a.project = ? AND a.id NOT IN (SELECT DISTINCT article_id FROM social_posts)").get(inputStatus, p); count += row.c; } else { const row = d.prepare('SELECT COUNT(*) as c FROM articles WHERE status = ? AND project = ?').get(inputStatus, p); count += row.c; }
    }
    return count;
  } catch { return 0; }
}

// ─── Concurrency Limits ───────────────────────────────────────────────────────

function getConcurrencyLimit(project) {
  if (!project || project === 'all') return MAX_GLOBAL_CONCURRENT;
  try {
    const row = getDb().prepare('SELECT max_concurrent FROM project_settings WHERE project = ?').get(project);
    return row?.max_concurrent ?? DEFAULT_MAX_CONCURRENT;
  } catch { return DEFAULT_MAX_CONCURRENT; }
}

function countActiveRunsForProject(project) {
  if (!project || project === 'all') return _activeRuns.size;
  let count = 0;
  for (const [key] of _activeRuns) {
    if (key.endsWith(`:${project}`)) count++;
  }
  return count;
}

function checkConcurrencyLimits(agentKey) {
  const [, project] = agentKey.split(':');

  // Global limit
  if (_activeRuns.size >= MAX_GLOBAL_CONCURRENT) {
    return { allowed: false, reason: `Global limit reached (${_activeRuns.size}/${MAX_GLOBAL_CONCURRENT})` };
  }

  // Per-project limit
  if (project && project !== 'all') {
    const limit = getConcurrencyLimit(project);
    const running = countActiveRunsForProject(project);
    if (running >= limit) {
      return { allowed: false, reason: `Project limit reached for ${project} (${running}/${limit})` };
    }
  }

  return { allowed: true };
}

function isTransientError(errorMsg) {
  if (!errorMsg) return false;
  const transient = ['draining', 'restart', 'ECONNREFUSED', 'ECONNRESET', 'timeout', 'socket hang up', '503', '502'];
  return transient.some(t => errorMsg.toLowerCase().includes(t.toLowerCase()));
}

/**
 * Sanitize error messages for customer-facing API responses.
 * Internal details stay in logs, customers get friendly text.
 */
function sanitizeError(err) {
  const msg = typeof err === 'string' ? err : err?.message || '';
  // Log the real error internally
  log('ERROR', `API error (sanitized for customer): ${msg}`);
  // Return friendly message
  if (isTransientError(msg)) return 'The system is temporarily busy. Please try again in a moment.';
  if (msg.includes('SQLITE') || msg.includes('database')) return 'A temporary data issue occurred. Please try again.';
  if (msg.includes('JSON') || msg.includes('parse')) return 'Invalid request format. Please check your input.';
  if (msg.includes('not found') || msg.includes('No prompt')) return 'The requested resource was not found.';
  return 'Something went wrong. Please try again or contact support.';
}

async function spawnAgentWithRetry(agentKey, context) {
  // Concurrency gate
  const concCheck = checkConcurrencyLimits(agentKey);
  if (!concCheck.allowed) {
    log('INFO', `⏳ Concurrency limit: ${agentKey} — ${concCheck.reason}`);
    logAudit({ ...context, action: 'concurrency_limited', reason: concCheck.reason });
    return { ok: false, error: concCheck.reason, concurrencyLimited: true };
  }

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

  // Transient errors (gateway drain, restart, connection issues): retry up to 3 times with backoff
  const maxRetries = isTransientError(result.error) ? 3 : 1;
  const baseDelay = isTransientError(result.error) ? 10000 : 5000; // 10s for drain, 5s for others

  log('WARN', `❌ Failed to spawn ${agentKey}: ${result.error}. ${isTransientError(result.error) ? 'Transient error, retrying with backoff...' : 'Retrying in 5s...'}`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const delay = baseDelay * attempt; // 10s, 20s, 30s for transient; 5s for others
    await new Promise(r => setTimeout(r, delay));
    
    const retry = await spawnAgent(agentKey);
    if (retry.ok) {
      log('INFO', `✅ Retry ${attempt}/${maxRetries} succeeded: ${agentKey} (runId: ${retry.runId})`);
      logAudit({ ...context, action: 'retry_spawned', reason: `runId=${retry.runId} (attempt ${attempt + 1})` });
      activeRuns.set(agentKey, {
        runId: retry.runId, sessionKey: retry.sessionKey,
        startedAt: Date.now(), initialRemaining: countInitialArticles(agentKey),
      });
      return retry;
    }

    log('WARN', `❌ Retry ${attempt}/${maxRetries} failed: ${agentKey}: ${retry.error}`);
    
    if (attempt === maxRetries) {
      // Only alert on non-transient errors or if all retries exhausted
      log('ERROR', `❌ All retries failed: ${agentKey}: ${retry.error}`);
      logAudit({ ...context, action: 'spawn_failed', reason: retry.error });
      // Don't alarm customers with transient gateway issues
      if (!isTransientError(retry.error)) {
        sendTelegramAlert(`🚨 Agent spawn failed: <b>${agentKey}</b>\n${retry.error}`);
      } else {
        log('WARN', `Suppressed alert for transient error: ${agentKey} (gateway likely restarting)`);
      }
      return retry;
    }
  }
}

// ─── Core Logic ───────────────────────────────────────────────────────────────

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
  // For unified agents (lana, bea), check all projects; otherwise check only the source project
  const projectsToCheck = project === 'all' ? PROJECT_SLUGS : [project];

  for (const proj of projectsToCheck) {
    // For agents that are project-agnostic (lana, liso), use the unified key
    const isUnifiedAgent = nextAgent === 'lana' || nextAgent === 'bea';
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

    // Per-project agent skip (e.g. skip_agents: ["bea", "bordi"])
    if (shouldSkipAgent(proj, nextAgent)) {
      log('INFO', `Chain skip ${nextAgent}/${proj}: skip_agents config`);
      result.skipped.push(`${nextAgent}/${proj}: skip_agents`);
      continue;
    }

    // Pause checks
    if ((nextAgent === 'lana' || nextAgent === 'bea') && isPublishingPaused(proj)) {
      log('INFO', `Chain skip ${nextAgent}/${proj}: publishing_paused`);
      result.skipped.push(`${nextAgent}/${proj}: publishing_paused`);
      continue;
    }

    // publish_mode gate: if 'approval', move ready→awaiting_approval instead of spawning Lana
    if (nextAgent === 'lana') {
      const projSettings = getProjectSettings(proj);
      if (projSettings.publish_mode === 'approval') {
        const readyArticles = findArticles('ready', proj, 'lana');
        if (readyArticles.length > 0) {
          const wdb = getWriteDb();
          for (const a of readyArticles) {
            wdb.prepare("UPDATE articles SET status = 'awaiting_approval', updated_at = datetime('now') WHERE id = ?").run(a.id);
            writeArticleEvent(a.id, proj, 'moved_to_approval', { reason: 'publish_mode=approval', agent: 'router' });
            log('INFO', `publish_mode=approval: article ${a.id} → awaiting_approval`);
          }
        }
        result.skipped.push(`lana/${proj}: publish_mode=approval`);
        continue;
      }
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
          getDb().prepare("UPDATE articles SET status = 'failed', feedback = feedback || '\n\nThis article needs manual review — the writing agent was unable to produce an approved draft after multiple attempts.', updated_at = datetime('now') WHERE id = ?").run(MAX_REVISIONS, a.id);
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

  // ── Oti → Liso (per-project, no fan-in) ──
  const otiProject = OTI_JOBS[jobId];
  if (otiProject) {
    log('INFO', `Oti/${otiProject} done → spawning Liso for ${otiProject}`);
    logAudit({
      sourceJobId: jobId, sourceAgent: 'oti', project: otiProject,
      action: 'oti_complete', targetAgent: 'liso',
      reason: `Oti/${otiProject} completed, triggering per-project Liso`,
    });

    // Per-project backlog check (replaces global isLisoBlocked)
    const d = getDb();
    const backlog = d.prepare(
      "SELECT COUNT(*) as c FROM articles WHERE project = ? AND status IN ('todo','writing','review','ready_for_design','ready')"
    ).get(otiProject);
    if (backlog && backlog.c > 5) {
      log('INFO', `Liso skip: ${otiProject} has ${backlog.c} in-progress articles (>5)`);
      result.skipped.push(`liso/${otiProject}: backlog full (${backlog.c})`);
      return result;
    }

    // Check if project is paused
    if (isGeneratingPaused(otiProject)) {
      log('INFO', `Liso skip: ${otiProject} generating is paused`);
      result.skipped.push(`liso/${otiProject}: generating_paused`);
      return result;
    }

    const agentKey = `liso:${otiProject}`;
    const cooldownKey = `liso:${otiProject}`;
    const lastTrigger = cooldowns.get(cooldownKey) || 0;
    if (Date.now() - lastTrigger < COOLDOWN_MS) {
      log('INFO', `Liso cooldown for ${otiProject}`);
      result.skipped.push(`liso/${otiProject}: cooldown`);
      return result;
    }

    const spawnResult = await spawnAgentWithRetry(agentKey, {
      sourceJobId: jobId, sourceAgent: 'oti', project: otiProject, targetAgent: 'liso',
    });
    if (spawnResult.ok) {
      cooldowns.set(cooldownKey, Date.now());
      result.triggered.push(`liso/${otiProject}`);
    } else {
      result.errors.push(`liso/${otiProject}: ${spawnResult.error}`);
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
  prevo: 10 * 60 * 1000,
  lana: 20 * 60 * 1000,
  bea: 10 * 60 * 1000,
  bordi: 5 * 60 * 1000,
};

/**
 * Check activeRuns for completion or timeout.
 * Completion = articles moved past the agent's input status.
 * Timeout = agent exceeded max duration and articles are unmoved.
 */
function detectCompletions() {
  const statusForAgent = { liso: 'backlog', pino: 'todo', rada: 'review', zala: 'ready_for_design', prevo: 'ready', lana: 'ready', bea: 'published' };
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
      if (shouldSkipAgent(p, agent)) continue;
      if (isGeneratingPaused(p) && agent !== 'lana' && agent !== 'bea') continue;
      if (isPublishingPaused(p) && (agent === 'lana' || agent === 'bea')) continue;

      if (agent === 'bea') { const count = d.prepare("SELECT COUNT(*) as c FROM articles a WHERE a.status = ? AND a.project = ? AND a.id NOT IN (SELECT DISTINCT article_id FROM social_posts)").get(inputStatus, p); remaining += count.c; } else { const count = d.prepare('SELECT COUNT(*) as c FROM articles WHERE status = ? AND project = ?').get(inputStatus, p); remaining += count.c; }
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
      writeAgentRun(agent, proj, run.runId, 'timeout', elapsed, `Processing took longer than expected. Will retry automatically.`, run.sessionKey);
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
      prevo: 'Translation',
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
    const statusForAgent = { liso: 'backlog', pino: 'todo', rada: 'review', zala: 'ready_for_design', prevo: 'ready', lana: 'ready', bea: 'published' };
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

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
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

  // 0.1. Silent pause mode — if ALL projects are paused, skip article polling
  // Still runs completions/resets above, but doesn't scan for new work or write blocked events
  try {
    const allPaused = PROJECT_SLUGS.every(p => {
      const s = getDb().prepare('SELECT paused FROM project_settings WHERE project = ?').get(p);
      return s?.paused;
    });
    if (allPaused) {
      // Only log once every 30 minutes to avoid spam
      if (!pollForStuckArticles._lastSilentLog || Date.now() - pollForStuckArticles._lastSilentLog > 30 * 60 * 1000) {
        log('INFO', '😴 All projects paused — silent mode (skipping article scan)');
        pollForStuckArticles._lastSilentLog = Date.now();
      }
      return; // Skip all article scanning below
    }
  } catch (err) {
    log('ERROR', `Silent pause check: ${err.message}`);
  }

  // 0.5. Reset stale done_for_today flags (from yesterday)
  try {
    const wdb = getWriteDb();
    wdb.prepare("UPDATE project_settings SET done_for_today = 0, updated_at = datetime('now') WHERE done_for_today = 1 AND DATE(done_at) < DATE('now')").run();
  } catch (err) {
    log('ERROR', `Reset done_for_today: ${err.message}`);
  }

  try {
    const d = getDb();
    const autoApproveProjects = d.prepare(
      "SELECT project FROM project_settings WHERE auto_approve = 1 OR vacation_mode = 1"
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
    sendTelegramAlert(`🚨 Auto-approve error: ${err.message}`);
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
    const isUnifiedAgent = agent === 'lana' || agent === 'bea';

    for (const project of PROJECT_SLUGS) {
      const d = getDb();
      const urgent = d.prepare(
        "SELECT id, title FROM articles WHERE status = ? AND project = ? AND priority = 'now' LIMIT 3"
      ).all(status, project);

      if (urgent.length > 0) {
        // Per-project agent skip
        if (shouldSkipAgent(project, agent)) { log('INFO', `Skip NOW ${agent}/${project}: skip_agents`); continue; }
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
    const isUnifiedAgent = agent === 'lana' || agent === 'bea';
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

      // Per-project agent skip
      if (shouldSkipAgent(project, agent)) continue;

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
                WHERE ae.article_id = a.id AND ae.event_type = 'agent_failed'
                AND ae.created_at > datetime('now', '-24 hours')
                AND ae.created_at > COALESCE(
                  (SELECT MAX(ae2.created_at) FROM article_events ae2 WHERE ae2.article_id = a.id AND ae2.event_type IN ('agent_completed','status_change','enqueued')),
                  '2000-01-01'
                )) >= 3`
        ).all(status, project);
        if (failedArticles.length > 0) {
          const wdb = getWriteDb();
          for (const fa of failedArticles) {
            wdb.prepare("UPDATE articles SET status = 'failed', feedback = 'This article encountered repeated processing issues and has been paused for review. Please check the content and retry.', updated_at = datetime('now') WHERE id = ?").run(fa.id);
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

      // H7: Lifetime retry cap — 10+ total failures ever → permanently failed
      try {
        const lifetimeFailed = getDb().prepare(
          `SELECT a.id FROM articles a WHERE a.status = ? AND a.project = ?
           AND (SELECT COUNT(*) FROM article_events ae
                WHERE ae.article_id = a.id AND ae.event_type = 'agent_failed') >= 10`
        ).all(status, project);
        if (lifetimeFailed.length > 0) {
          const wdb = getWriteDb();
          for (const fa of lifetimeFailed) {
            wdb.prepare("UPDATE articles SET status = 'failed', feedback = 'Article exceeded lifetime failure limit (10+ total failures). Requires manual review and reset.', updated_at = datetime('now') WHERE id = ?").run(fa.id);
            writeArticleEvent(fa.id, project, 'circuit_breaker', {
              agent, phase: status, agentType: 'system',
              detail: `Moved to failed: lifetime cap exceeded (10+ total failures)`,
            });
            log('WARN', `🔌 Lifetime cap: article #${fa.id} permanently failed (10+ total failures)`);
          }
          sendTelegramAlert(`🔌 Lifetime cap: ${lifetimeFailed.length} article(s) in ${project} permanently failed after 10+ total failures.`);
        }
      } catch (err) {
        log('ERROR', `Lifetime cap check: ${err.message}`);
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

  // 3. Liso safety net — per-project: if Oti webhook failed, detect fresh intel
  try {
    const d = getDb();
    const today = new Date().toISOString().slice(0, 10);
    for (const project of PROJECT_SLUGS) {
      if (isGeneratingPaused(project)) continue;
      const settings = getProjectSettings(project);
      if (settings.paused) continue;
      if (shouldSkipAgent(project, 'liso')) continue;

      const lisoCooldown = cooldowns.get(`liso:${project}`) || 0;
      if (Date.now() - lisoCooldown < 6 * 60 * 60 * 1000) continue; // Liso ran recently

      const hasIntel = d.prepare(
        "SELECT COUNT(*) as c FROM daily_intel WHERE date(created_at) = ? AND project = ?"
      ).get(today, project);
      if (!hasIntel || hasIntel.c === 0) continue;

      const todoCount = d.prepare(
        "SELECT COUNT(*) as c FROM articles WHERE status IN ('todo','writing') AND project = ?"
      ).get(project);
      if (todoCount.c >= 5) continue;

      log('INFO', `Liso safety net: ${project} has fresh intel but Liso hasn't run`);
      const spawnResult = await spawnAgentWithRetry(`liso:${project}`, {
        sourceAgent: 'poll-safety', project, targetAgent: 'liso',
        reason: 'Safety net: Oti intel detected, Liso not triggered via webhook',
      });
      if (spawnResult.ok) cooldowns.set(`liso:${project}`, Date.now());
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
    sendTelegramAlert(`🚨 Bordi check error: ${err.message}`);
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

function getGatewayUptime() {
  try {
    // Find gateway PID by process name (works regardless of systemd user session)
    const pid = execSync("pgrep -f 'openclaw.*gateway' | head -1", { timeout: 2000 }).toString().trim();
    if (!pid || pid === '0') return 0;
    const uptime = execSync(`ps -p ${pid} -o etimes=`, { timeout: 1000 }).toString().trim();
    return parseInt(uptime, 10) || 0;
  } catch (e) {
    return 0;
  }
}

const server = http.createServer(async (req, res) => {
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
        gateway_uptime: getGatewayUptime(),
        articles: row.c,
        pipeline: Object.fromEntries(statusCounts.map(r => [r.status, r.c])),
        cooldowns: Object.fromEntries(_cooldowns),
        activeRuns: Object.fromEntries(_activeRuns),
        concurrency: {
          global: { active: _activeRuns.size, limit: MAX_GLOBAL_CONCURRENT },
          perProject: Object.fromEntries(PROJECT_SLUGS.map(p => [p, {
            active: countActiveRunsForProject(p),
            limit: getConcurrencyLimit(p),
          }])),
        },
        paused: Object.fromEntries(PROJECT_SLUGS.map(p => {
          const row = d.prepare('SELECT generating_paused, publishing_paused, paused_by, paused_at, publish_mode FROM project_settings WHERE project = ?').get(p) || {};
          return [p, {
            generating: !!row.generating_paused,
            generating_by: row.generating_paused ? (row.paused_by || null) : null,
            generating_at: row.generating_paused ? (row.paused_at || null) : null,
            publishing: !!row.publishing_paused,
            publishing_by: row.publishing_paused ? (row.paused_by || null) : null,
            publishing_at: row.publishing_paused ? (row.paused_at || null) : null,
            publish_mode: row.publish_mode || 'auto',
          }];
        })),
        settings: Object.fromEntries(PROJECT_SLUGS.map(p => [p, getProjectSettings(p)])),
        circuitBreaker: (() => {
          try {
            const tripped = d.prepare(
              "SELECT id, project, title, status, updated_at FROM articles WHERE status = 'failed' AND updated_at > datetime('now', '-7 days') ORDER BY updated_at DESC LIMIT 10"
            ).all();
            return { trippedArticles: tripped.length, recent: tripped };
          } catch { return { trippedArticles: 0, recent: [] }; }
        })(),
        lastErrors: (() => {
          try {
            return d.prepare(
              "SELECT agent_name, project, status, error, finished_at FROM agent_runs WHERE status IN ('error','timeout') AND finished_at > datetime('now', '-24 hours') ORDER BY finished_at DESC LIMIT 10"
            ).all();
          } catch { return []; }
        })(),
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', error: sanitizeError(err) }));
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

        const isUnified = agent === 'lana' || agent === 'bea';
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
        if ((lastAgentRun?.status === 'error' || lastAgentRun?.status === 'timeout') && semaphore !== 'running') {
          // Transient/timeout errors → show as "retrying" not "failed"
          if (isTransientError(lastAgentRun.error) || lastAgentRun.status === 'timeout') {
            semaphore = 'queued';
            detail = 'Retrying automatically...';
          } else {
            semaphore = 'failed';
            detail = 'Needs attention';
          }
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
      res.end(JSON.stringify({ error: sanitizeError(err) }));
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
      res.end(JSON.stringify({ error: sanitizeError(err) }));
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
        const allowed = ['daily_limit', 'vacation_limit', 'vacation_mode', 'auto_approve', 'paused', 'done_for_today', 'publish_mode', 'generating_paused', 'publishing_paused', 'paused_by', 'paused_at', 'max_concurrent', 'translate_to'];
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
        res.end(JSON.stringify({ error: sanitizeError(err) }));
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
      res.end(JSON.stringify({ status: 'error', error: sanitizeError(err) }));
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
        const agentKey = agent === 'lana' || agent === 'bea' ? `${agent}:all` : `${agent}:${project}`;
        const result = await spawnAgentWithRetry(agentKey, {
          sourceAgent: 'manual', project: project || 'all', targetAgent: agent,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: sanitizeError(err) }));
      }
    });
    return;
  }

  // ─── Manual / Hook Endpoint ───────────────────────────────────────────────────
  // Single endpoint for external hooks (freelancers) and internal cron hooks
  if (req.method === 'POST' && req.url === '/hooks/agent') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        let payload;
        try { payload = JSON.parse(body); } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        const { agent, task } = payload;

        // Specialized agents (Freelancers)
        if (agent === 'hobi') {
          log('INFO', `Hook: Triggering Hobi (task=${task})`);
          try {
            
            let hobiResult;
            if (runHobi) {
              hobiResult = await runHobi({ payload });
            } else {
              console.log('[Router] runHobi is not available.');
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(hobiResult));
          } catch (err) {
            log('ERROR', `Hobi failed: ${err.message}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: sanitizeError(err) }));
          }
          return;
        }

        // Standard Pipeline agents
        if (agent) {
          // Existing logic for manual triggers
          // ...
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unknown agent' }));

      } catch (err) {
        log('ERROR', `Hook failed: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: sanitizeError(err) }));
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
        res.end(JSON.stringify({ error: sanitizeError(err) }));
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
      try {
        const wdb = getWriteDb();
        const col = `${type}_paused`;
        const pausedVal = paused ? 1 : 0;
        const byVal = by || 'dashboard';
        const atVal = new Date().toISOString();

        // Single source of truth: SQLite
        wdb.prepare(`UPDATE project_settings SET ${col} = ?, paused_by = ?, paused_at = ?, updated_at = datetime('now') WHERE project = ?`)
          .run(pausedVal, byVal, atVal, project);

        // Keep the legacy 'paused' column in sync (generating_paused drives it)
        if (type === 'generating') {
          wdb.prepare("UPDATE project_settings SET paused = ?, updated_at = datetime('now') WHERE project = ?").run(pausedVal, project);
        }

        // Also update JSON file for backward compat (agents read project config)
        try {
          const configPath = join(PROJECTS_DIR, `${project}.json`);
          const config = JSON.parse(readFileSync(configPath, 'utf-8'));
          config[`${type}_paused`] = paused;
          config[`${type}_paused_by`] = byVal;
          config[`${type}_paused_at`] = atVal;
          writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
        } catch { /* JSON sync is best-effort now, DB is authoritative */ }

        log('INFO', `${type} ${paused ? 'PAUSED' : 'RESUMED'} for ${project} by ${byVal}`);

        // Audit event
        try {
          wdb.prepare(
            `INSERT INTO article_events (article_id, project, phase, event_type, agent, agent_type, detail, created_at)
             VALUES (0, ?, ?, 'config_change', 'dashboard', 'human', ?, datetime('now'))`,
          ).run(project, type, `${type} ${paused ? 'paused' : 'resumed'} by ${byVal}`);
        } catch { /* non-critical */ }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, project, type, paused }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: sanitizeError(err) }));
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
        res.end(JSON.stringify({ ok: false, error: sanitizeError(err) }));
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
