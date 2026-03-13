const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOME = process.env.HOME || '/home/clawdbot';
const SAAS_CORE = process.env.SAAS_CORE_ROOT || path.join(HOME, 'clawd-saas-core');

const drafts = JSON.parse(fs.readFileSync(path.join(SAAS_CORE, 'agents/bea_drafts.json'), 'utf8'));

drafts.forEach(post => {
  const payload = {
    article_id: post.article_id,
    platform: post.platform,
    content: post.content,
    media_brief: post.media_brief || null,
    status: post.status || 'draft'
  };
  try {
    // Correctly escape for shell: wrap in single quotes, replace single quote with closing quote + escaped quote + opening quote
    // But JSON.stringify handles escaping within the string. We just need to wrap the whole JSON in single quotes for bash.
    // And escape single quotes inside the JSON string itself for bash.
    const jsonArg = JSON.stringify(payload).replace(/'/g, "'\"'\"'");
    const cmd = `node ${path.join(SAAS_CORE, 'scripts/db-helper.js')} insert-social '${jsonArg}'`;
    console.log(`Executing for Article ${post.article_id} Platform ${post.platform}...`);
    execSync(cmd);
  } catch (e) {
    console.error(`Failed to insert post for article ${post.article_id}: ${e.message}`);
  }
});
