const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../db/pipeline.db'));

try {
  // Clean
  db.prepare("DELETE FROM articles").run();
  
  // Insert Test Article
  db.prepare(`
    INSERT INTO articles (title, project, status, primary_keyword, outline, created_at, scheduled_date)
    VALUES (?, ?, ?, ?, ?, datetime('now'), date('now', '+1 day'))
  `).run('SaaS Engine Test Article', 'avant2go-demo', 'todo', 'saas test', '## Intro\n## Body\n## Conclusion');
  
  console.log('✅ SAAS DB: Inserted 1 TODO article.');
} catch (e) {
  console.error('❌ SAAS DB Error:', e.message);
  process.exit(1);
}
