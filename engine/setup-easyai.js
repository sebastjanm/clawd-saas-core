const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../db/pipeline.db'));

try {
  // Clean old demo data
  db.prepare("DELETE FROM articles").run();
  
  // Insert EasyAI Start Article
  db.prepare(`
    INSERT INTO articles (title, project, status, primary_keyword, outline, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'Welcome to EasyAI Start', 
    'easyai-start', 
    'todo', 
    'ai saas', 
    '## Introduction to EasyAI\n## Getting Started'
  );
  
  console.log('✅ EASYAI START: Initialized project & first article.');
} catch (e) {
  console.error('❌ EASYAI START Setup Error:', e.message);
}
