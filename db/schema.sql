CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE pipeline_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER,
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id)
);
CREATE TABLE IF NOT EXISTS "articles" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT,
  primary_keyword TEXT,
  search_intent TEXT CHECK(search_intent IN ('informational','commercial','comparison','transactional')),
  outline TEXT,
  draft_md TEXT,
  final_md TEXT,
  feedback TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog','todo','writing','review','ready','ready_for_design','awaiting_approval','published','promoted','failed')),
  claimed_by TEXT,
  claimed_at TEXT,
  published_url TEXT,
  published_at TEXT,
  promoted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')), 
  strategy TEXT, 
  notes TEXT, 
  scheduled_date TEXT, 
  day_number INTEGER, cover_image TEXT, angle TEXT, why_now TEXT, source_intel TEXT, market_context TEXT, priority TEXT DEFAULT 'normal' CHECK(priority IN ('normal','high','now')), abstract TEXT, asset_type TEXT DEFAULT 'article', brief JSON, learnings JSON, metrics JSON, revision_count INTEGER DEFAULT 0,
  UNIQUE(project, slug)
);
CREATE TABLE agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK(agent_type IN ('pipeline','freelancer','system')),
  job_id TEXT,
  session_key TEXT,
  status TEXT NOT NULL CHECK(status IN ('running','ok','error','timeout','killed')),
  task_summary TEXT,
  article_id INTEGER REFERENCES articles(id),
  project TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  duration_ms INTEGER,
  tokens_in INTEGER,
  tokens_out INTEGER,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
, model TEXT);
CREATE INDEX idx_agent_runs_agent ON agent_runs(agent_name, started_at DESC);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE INDEX idx_agent_runs_article ON agent_runs(article_id);
CREATE TABLE router_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      source_job_id TEXT,
      source_agent TEXT,
      project TEXT,
      action TEXT NOT NULL,
      target_job_id TEXT,
      target_agent TEXT,
      article_ids TEXT,
      reason TEXT
    );
CREATE INDEX idx_router_log_ts ON router_log(timestamp);
CREATE TRIGGER clear_claim_on_status_change AFTER UPDATE OF status ON articles FOR EACH ROW WHEN NEW.status <> OLD.status BEGIN UPDATE articles SET claimed_by = NULL, claimed_at = NULL WHERE id = NEW.id; END;
CREATE TABLE project_competitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  domain TEXT NOT NULL,
  name TEXT,
  relevance_notes TEXT,
  last_scanned TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')), discovered_via TEXT DEFAULT 'manual',
  UNIQUE(project, domain)
);
CREATE TABLE competitor_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  competitor_domain TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  discovered_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project, url)
);
CREATE TABLE topic_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  topic TEXT NOT NULL,
  suggested_keywords TEXT,
  source_urls TEXT,
  relevance_score INTEGER CHECK(relevance_score BETWEEN 1 AND 10),
  demand_score INTEGER CHECK(demand_score BETWEEN 1 AND 10),
  competition_score INTEGER CHECK(competition_score BETWEEN 1 AND 10),
  timeliness_score INTEGER CHECK(timeliness_score BETWEEN 1 AND 10),
  reasoning TEXT,
  status TEXT DEFAULT 'new' CHECK(status IN ('new','accepted','rejected','used')),
  created_at TEXT DEFAULT (datetime('now')),
  used_by_article_id INTEGER REFERENCES articles(id)
);
CREATE TABLE serp_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  keyword TEXT NOT NULL,
  our_position INTEGER,
  our_url TEXT,
  top_competitors TEXT,
  people_also_ask TEXT,
  checked_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project, keyword)
);
CREATE TABLE daily_intel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  date TEXT NOT NULL,
  top_signal TEXT,
  stories TEXT,           -- JSON array of {headline, summary, source_url, relevance}
  data_points TEXT,       -- JSON object of project-specific metrics (prices, stats)
  signals_to_watch TEXT,  -- JSON array of upcoming events/trends
  article_ideas TEXT,     -- JSON array of {title, angle, keyword}
  raw_md TEXT,            -- Human-readable markdown (for morning briefing)
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project, date)
);
CREATE TABLE article_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id),
  project TEXT NOT NULL,
  phase TEXT,
  event_type TEXT NOT NULL,
  agent TEXT,
  agent_type TEXT CHECK(agent_type IN ('pipeline', 'system', 'human')),
  status TEXT,
  priority TEXT,
  blocked_reason TEXT,
  error_message TEXT,
  detail TEXT,
  metadata JSON,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ae_article ON article_events(article_id, created_at DESC);
CREATE INDEX idx_ae_type ON article_events(event_type, created_at DESC);
CREATE TABLE daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    date DATE NOT NULL,
    articles_generated INTEGER DEFAULT 0,
    articles_published INTEGER DEFAULT 0,
    cost_today REAL DEFAULT 0.0,
    UNIQUE(project, date)
);
CREATE TABLE project_settings (
  project TEXT PRIMARY KEY,
  daily_limit INTEGER DEFAULT 1,
  vacation_limit INTEGER DEFAULT 2,
  vacation_mode BOOLEAN DEFAULT 0,
  auto_approve BOOLEAN DEFAULT 0,
  paused BOOLEAN DEFAULT 0,
  done_for_today BOOLEAN DEFAULT 0,
  done_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
, publish_mode TEXT DEFAULT 'auto' CHECK(publish_mode IN ('auto','approval')));
CREATE TABLE IF NOT EXISTS "social_posts" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('twitter','linkedin','facebook','instagram','tiktok')),
  content TEXT NOT NULL,
  media_brief TEXT,
  media_url TEXT,
  posted_at TEXT,
  post_url TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','awaiting_approval','approved','posted','rejected','failed')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id)
);
CREATE TABLE strategy_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  decision_type TEXT NOT NULL CHECK(decision_type IN ('kill_pillar','boost_pillar','add_pillar','avoid_topic','scale_up','scale_down','content_mix','platform_focus','custom')),
  target TEXT NOT NULL,
  reason TEXT NOT NULL,
  data_source TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','applied')),
  created_by TEXT DEFAULT 'vuk',
  approved_at TEXT,
  applied_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
