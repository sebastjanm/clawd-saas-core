const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('/home/clawdbot/clawd/content-pipeline/pipeline.db');
const posts = JSON.parse(fs.readFileSync('/home/clawdbot/clawd/content-pipeline/scripts/social_posts_temp.json', 'utf8'));

const insertStmt = db.prepare(`
  INSERT INTO social_posts (article_id, platform, content, media_brief, status, created_at)
  VALUES (@article_id, @platform, @content, @media_brief, 'draft', DATETIME('now'))
`);

let count = 0;
for (const post of posts) {
  try {
    // Ensure media_brief is null if not present
    if (!post.media_brief) post.media_brief = null;
    
    insertStmt.run(post);
    count++;
    console.log(`Inserted post for article ${post.article_id} on ${post.platform}`);
  } catch (err) {
    console.error(`Error inserting post for article ${post.article_id} on ${post.platform}:`, err.message);
  }
}

console.log(`Total inserted: ${count}`);
