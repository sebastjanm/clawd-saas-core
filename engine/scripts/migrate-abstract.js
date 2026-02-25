const Database = require('better-sqlite3');
const db = new Database('/home/clawdbot/clawd/content-pipeline/pipeline.db');

console.log('Starting abstract migration...');

const articles = db.prepare("SELECT id, final_md, title FROM articles WHERE abstract IS NULL AND final_md IS NOT NULL").all();

let updated = 0;

const updateStmt = db.prepare("UPDATE articles SET abstract = ? WHERE id = ?");

for (const article of articles) {
  let abstract = '';
  
  if (article.final_md) {
    // Try meta description
    const metaMatch = article.final_md.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    if (metaMatch) {
      abstract = metaMatch[1];
    } else {
      // Fallback to first paragraph
      const pMatch = article.final_md.match(/<p>(.*?)<\/p>/i);
      if (pMatch) {
        abstract = pMatch[1].replace(/<[^>]+>/g, ''); // strip internal tags
        if (abstract.length > 200) abstract = abstract.substring(0, 200) + '...';
      }
    }
  }

  if (abstract) {
    updateStmt.run(abstract, article.id);
    updated++;
    console.log(`Updated #${article.id}: ${abstract.substring(0, 50)}...`);
  } else {
    console.log(`Skipped #${article.id} (no content found)`);
  }
}

console.log(`Migration complete. Updated ${updated} articles.`);
