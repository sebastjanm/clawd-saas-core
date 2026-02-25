import 'server-only';
import Database from 'better-sqlite3';
import path from 'node:path';
import { logger } from '../logger';

const DB_PATH =
  process.env.PIPELINE_DB_PATH ??
  path.resolve('/home/clawdbot/clawd/content-pipeline/pipeline.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: false });
    _db.pragma('journal_mode = WAL');
    _db.pragma('busy_timeout = 5000');
    _db.pragma('foreign_keys = ON');
    console.log('📢 DASHBOARD DB PATH:', DB_PATH); // DEBUG LOG
    logger.info({ path: DB_PATH }, 'Database connected');
  }
  return _db;
}
