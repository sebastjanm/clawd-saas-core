#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'pipeline.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const [,, command, arg] = process.argv;

function now() { return new Date().toISOString().replace('T', ' ').split('.')[0]; }

switch (command) {
  case 'query': {
    try {
      const sql = arg;
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = db.prepare(sql).all();
        console.log(JSON.stringify(rows, null, 2));
      } else {
        const result = db.prepare(sql).run();
        console.log(JSON.stringify({ changes: result.changes }));
      }
    } catch (e) {
      console.error('Query error:', e.message);
      process.exit(1);
    }
    break;
  }

  case 'insert': {
    const data = JSON.parse(arg);
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(',');
    const values = fields.map(f => data[f] === 'NOW' ? now() : data[f]);
    const sql = `INSERT INTO articles (${fields.join(',')}) VALUES (${placeholders})`;
    const result = db.prepare(sql).run(...values);
    console.log(JSON.stringify({ id: result.lastInsertRowid }));
    break;
  }

  case 'update': {
    const data = JSON.parse(arg);
    const id = data.id;
    delete data.id;
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data).map(v => v === 'NOW' ? now() : v);
    const sql = `UPDATE articles SET ${sets} WHERE id = ?`;
    const result = db.prepare(sql).run(...values, id);
    console.log(JSON.stringify({ changes: result.changes }));
    break;
  }

  case 'insert-social': {
    const data = JSON.parse(arg);
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(',');
    const values = fields.map(f => data[f]);
    const sql = `INSERT INTO social_posts (${fields.join(',')}) VALUES (${placeholders})`;
    const result = db.prepare(sql).run(...values);
    console.log(JSON.stringify({ id: result.lastInsertRowid }));
    break;
  }

  case 'log': {
    const data = JSON.parse(arg);
    const sql = `INSERT INTO pipeline_log (article_id, agent, action, details) VALUES (?, ?, ?, ?)`;
    db.prepare(sql).run(data.article_id || null, data.agent, data.action, data.details || null);
    console.log('✅ Logged');
    break;
  }

  case 'status': {
    const articles = db.prepare("SELECT project, status, COUNT(*) as count FROM articles GROUP BY project, status ORDER BY project, status").all();
    const recent = db.prepare("SELECT agent, action, COUNT(*) as count FROM pipeline_log WHERE created_at > datetime('now','-24 hours') GROUP BY agent, action").all();
    console.log('=== Pipeline Status ===');
    console.log(JSON.stringify(articles, null, 2));
    console.log('\n=== Last 24h Activity ===');
    console.log(JSON.stringify(recent, null, 2));
    break;
  }

  default:
    console.log('Usage: db-helper.js <command> [arg]');
    console.log('Commands: query, insert, update, insert-social, log, status');
    process.exit(1);
}

db.close();
