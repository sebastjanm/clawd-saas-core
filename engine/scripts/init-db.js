#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'pipeline.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS articles (
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
  status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog','todo','writing','review','ready','awaiting_approval','published','promoted','failed')),
  claimed_by TEXT,
  claimed_at TEXT,
  published_url TEXT,
  published_at TEXT,
  promoted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(project, slug)
);

CREATE TABLE IF NOT EXISTS pipeline_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER,
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE TABLE IF NOT EXISTS social_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('twitter','linkedin','facebook')),
  content TEXT NOT NULL,
  posted_at TEXT,
  post_url TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','posted','failed')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id)
);
`);

// Check if trigger exists, create if not
const triggerExists = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='articles_updated'").get();
if (!triggerExists) {
  db.exec(`
    CREATE TRIGGER articles_updated
      AFTER UPDATE ON articles
      BEGIN
        UPDATE articles SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
  `);
}

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
const count = db.prepare("SELECT COUNT(*) as c FROM articles").get();

console.log('✅ Database initialized:', DB_PATH);
console.log('Tables:', tables.map(t => t.name).join(', '));
console.log('Articles:', count.c);

db.close();
