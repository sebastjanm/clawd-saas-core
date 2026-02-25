#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');
const cal = require('/home/clawdbot/projects/silver-investment-landing/content-calendar.json');

const DB_PATH = path.join(__dirname, '..', 'pipeline.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const insert = db.prepare(`
  INSERT OR IGNORE INTO articles (project, title, slug, primary_keyword, search_intent, status, published_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let imported = 0;
for (const a of cal.articles) {
  const statusMap = {
    'published': 'published',
    'draft_ready': 'ready',  // Day 13 awaiting review
    'pending': 'backlog'
  };
  const status = statusMap[a.status] || 'backlog';
  const keyword = a.slug.replace(/-/g, ' ');
  
  insert.run(
    'nakupsrebra',
    a.title,
    a.slug,
    keyword,
    'informational',
    status,
    a.published_at || null,
    a.date ? a.date + 'T00:00:00' : new Date().toISOString()
  );
  imported++;
}

console.log(`✅ Migrated ${imported} articles from silver content calendar`);

// Show status
const rows = db.prepare("SELECT status, COUNT(*) as count FROM articles WHERE project='nakupsrebra' GROUP BY status").all();
console.log('Status breakdown:', JSON.stringify(rows));

db.close();
