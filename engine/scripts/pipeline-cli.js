#!/usr/bin/env node
// Content pipeline CLI — JSON-speaking commands for Lobster workflows
const Database = require('better-sqlite3');
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'pipeline.db');

const cmd = process.argv[2];
const args = process.argv.slice(3);

function getDb() {
  return new Database(DB_PATH);
}

function json(data) {
  console.log(JSON.stringify(data));
}

// Helper: Check if content looks like HTML (not raw markdown)
function isHtmlContent(content) {
  if (!content) return false;
  // Must have at least some HTML tags
  const htmlTags = /<(p|h[1-6]|div|section|article|ul|ol|li|blockquote|pre|code|span|a|strong|em|img|table|thead|tbody|tr|td|th|header|footer|nav|main|aside)\b[^>]*>/i;
  const hasHtmlTags = htmlTags.test(content);
  
  // Check for markdown patterns that shouldn't be in HTML
  const markdownPatterns = [
    /^#{1,6}\s/m,           // Markdown headers: # Header
    /^\*\s/m,               // Bullet lists: * item
    /^-\s/m,                // Bullet lists: - item
    /^\d+\.\s/m,            // Numbered lists: 1. item
    /\*\*[^*]+\*\*/,        // Bold: **text**
    /\[([^\]]+)\]\(([^)]+)\)/,  // Links: [text](url)
  ];
  const hasMarkdownSyntax = markdownPatterns.some(p => p.test(content));
  
  // If it has markdown syntax but no HTML, it's raw markdown
  if (hasMarkdownSyntax && !hasHtmlTags) return false;
  
  // If it has HTML tags, consider it valid
  return hasHtmlTags;
}

const commands = {
  // Get next article ready for a stage
  'next': () => {
    const status = args[0] || 'backlog';
    const project = args[1] || null;
    const db = getDb();
    let q = 'SELECT * FROM articles WHERE status = ?';
    const params = [status];
    if (project) { q += ' AND project = ?'; params.push(project); }
    q += ' ORDER BY id LIMIT 1';
    const row = db.prepare(q).get(...params);
    json(row || { error: 'none', message: `No articles with status: ${status}` });
  },

  // List articles by status
  'list': () => {
    const status = args[0] || 'all';
    const db = getDb();
    let rows;
    if (status === 'all') {
      rows = db.prepare('SELECT id, project, title, slug, status, published_at FROM articles ORDER BY id').all();
    } else {
      rows = db.prepare('SELECT id, project, title, slug, status, published_at FROM articles WHERE status = ? ORDER BY id').all(status);
    }
    json({ count: rows.length, articles: rows });
  },

  // Update article status
  'update-status': () => {
    const id = parseInt(args[0]);
    const newStatus = args[1];
    if (!id || !newStatus) { json({ error: 'usage: update-status <id> <status>' }); return; }
    const db = getDb();
    const valid = ['backlog','todo','writing','review','ready','ready_for_design','awaiting_approval','published','promoted'];
    if (!valid.includes(newStatus)) { json({ error: `Invalid status. Use: ${valid.join(', ')}` }); return; }
    db.prepare("UPDATE articles SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, id);
    const row = db.prepare('SELECT id, title, status FROM articles WHERE id = ?').get(id);
    json({ ok: true, article: row });
  },

  // Set final_md on an article
  // Usage: set-content <id> [field] [filepath]
  //   - With filepath: reads from file
  //   - Without filepath: reads from stdin (pipe)
  'set-content': () => {
    const id = parseInt(args[0]);
    const field = args[1] || 'final_md'; // final_md or draft_md
    if (!id) { json({ error: 'usage: set-content <id> [field] [filepath]' }); return; }
    let content;
    if (args[2]) {
      // Read from file path
      try { content = require('fs').readFileSync(args[2], 'utf8'); }
      catch(e) { json({ error: `Cannot read file: ${args[2]}`, message: e.message }); return; }
    } else {
      // Read from stdin
      const chunks = [];
      const fd = require('fs').openSync('/dev/stdin', 'r');
      const buf = Buffer.alloc(4096);
      let n;
      while ((n = require('fs').readSync(fd, buf)) > 0) chunks.push(buf.slice(0, n));
      require('fs').closeSync(fd);
      content = Buffer.concat(chunks).toString('utf8');
    }
    if (!content || content.trim().length === 0) { json({ error: 'Empty content' }); return; }
    const db = getDb();
    db.prepare(`UPDATE articles SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`).run(content, id);
    json({ ok: true, id, field, length: content.length });
  },

  // Publish: route to correct deploy method based on project config
  'publish': () => {
    const id = parseInt(args[0]);
    if (!id) { json({ error: 'usage: publish <id>' }); return; }
    const db = getDb();
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!article) { json({ error: 'Article not found' }); return; }
    if (!article.final_md && !article.draft_md) { json({ error: 'No content to publish', id }); return; }

    // Load project config
    const projFile = path.join(__dirname, '..', 'projects', `${article.project}.json`);
    let projConfig;
    try { projConfig = JSON.parse(require('fs').readFileSync(projFile, 'utf8')); }
    catch(e) { json({ error: `Project config not found: ${projFile}` }); return; }

    const content = article.final_md || article.draft_md;
    
    // VALIDATION: Check if content is HTML, not raw markdown
    if (!isHtmlContent(content)) {
      json({ 
        error: 'Content appears to be raw markdown, not HTML. Run through Zala (designer) first.', 
        id, 
        hint: 'Set status to ready_for_design and let Zala convert it to HTML'
      }); 
      return; 
    }
    
    const deployMethod = (projConfig.deploy && projConfig.deploy.method) || 'vercel';

    if (deployMethod === 'api') {
      // API-based publish (e.g. baseman-blog)
      commands._publishApi(db, article, content, projConfig);
    } else {
      // File-based publish (e.g. nakupsrebra → write HTML + update index + git + vercel)
      commands._publishFile(db, article, content, projConfig);
    }
  },

  // Internal: API-based publish (PUT to blog API)
  '_publishApi': (db, article, content, projConfig) => {
    // Safety net: double-check HTML content (should be caught earlier in publish command)
    if (!isHtmlContent(content)) {
      json({ 
        error: 'Content appears to be raw markdown, not HTML. Run through Zala (designer) first.', 
        id: article.id
      }); 
      return; 
    }
    
    const apiEndpoint = projConfig.deploy.api_endpoint;
    const apiAuthEnv = projConfig.deploy.api_auth_env;
    if (!apiEndpoint) { json({ error: 'No api_endpoint in deploy config' }); return; }

    // Load API key from env file
    let apiKey;
    try {
      const envFile = require('fs').readFileSync(path.join(require('os').homedir(), '.env'), 'utf8');
      const match = envFile.match(new RegExp(`${apiAuthEnv}=(.+)`));
      apiKey = match ? match[1].trim() : null;
    } catch(e) { /* */ }
    if (!apiKey) { json({ error: `API key not found in ~/.env for ${apiAuthEnv}` }); return; }

    // Extract metadata from content or article fields
    const descMatch = content.match(/meta name="description" content="([^"]+)"/);
    const excerpt = descMatch ? descMatch[1] : (article.primary_keyword || article.title);
    const defaults = (projConfig.deploy.api_fields && projConfig.deploy.api_fields.defaults) || {};
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    // Estimate read time (words / 200)
    const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    const readTime = `${Math.max(1, Math.ceil(wordCount / 200))} min read`;

    const payload = {
      slug: article.slug,
      title: article.title,
      excerpt: excerpt.substring(0, 200),
      html: content,
      content: content,
      date: dateStr,
      read_time: readTime,
      category: article.primary_keyword || 'AI',
      author: defaults.author || 'Sebastjan Mislej',
      written_by: defaults.written_by || 'ai',
      is_published: true
    };
    // Add cover image if available (field name varies by project API)
    if (article.cover_image) {
      const imageField = (projConfig.deploy.api_fields && projConfig.deploy.api_fields.image_field) || 'image';
      payload[imageField] = article.cover_image;
    }

    // Sync HTTP request using execSync + curl
    const { execSync } = require('child_process');
    try {
      const payloadJson = JSON.stringify(payload).replace(/'/g, "'\\''");
      const curlCmd = `curl -s -w '\\n%{http_code}' -X POST '${apiEndpoint}' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${apiKey}' -d '${payloadJson}'`;
      const output = execSync(curlCmd, { encoding: 'utf8', timeout: 30000 });
      const lines = output.trim().split('\n');
      const httpCode = lines.pop();
      const body = lines.join('\n');

      if (parseInt(httpCode) >= 400) {
        json({ error: 'API publish failed', httpCode, body });
        return;
      }

      const publishedUrl = `https://${projConfig.fallback_domain || projConfig.domain}/blog/${article.slug}`;
      db.prepare("UPDATE articles SET status = 'published', published_url = ?, published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
        .run(publishedUrl, article.id);

      json({
        ok: true,
        method: 'api',
        id: article.id,
        title: article.title,
        slug: article.slug,
        url: publishedUrl,
        httpCode
      });
    } catch(e) {
      json({ error: 'API publish failed', message: e.message });
    }
  },

  // Internal: File-based publish (write HTML + update index)
  '_publishFile': (db, article, content, projConfig) => {
    const blogDir = projConfig.blog_dir || (projConfig.paths && projConfig.paths.blog_dir);
    if (!blogDir) { json({ error: 'No blog_dir in project config' }); return; }
    const blogPath = path.join(blogDir, `${article.slug}.html`);

    // Write article HTML
    require('fs').writeFileSync(blogPath, content, 'utf8');

    // Update blog index page
    const indexPath = path.join(blogDir, 'index.html');
    try {
      let indexHtml = require('fs').readFileSync(indexPath, 'utf8');
      if (!indexHtml.includes(`/blog/${article.slug}`)) {
        const descMatch = content.match(/meta name="description" content="([^"]+)"/);
        const desc = descMatch ? descMatch[1] : article.title;
        const months = ['januar','februar','marec','april','maj','junij','julij','avgust','september','oktober','november','december'];
        const now = new Date();
        const dateStr = `${now.getDate()}. ${months[now.getMonth()]} ${now.getFullYear()}`;
        const imgTag = article.cover_image
          ? `\n                <img src="${article.cover_image}" alt="${article.title}">`
          : '';
        const card = `            <a href="/blog/${article.slug}" class="blog-card">${imgTag}
                <div class="blog-card-content">
                    <h2>${article.title}</h2>
                    <p>${desc.substring(0, 200)}</p>
                    <span class="blog-meta">${dateStr} · NOVO</span>
                </div>
            </a>\n\n`;
        const insertPoint = indexHtml.indexOf('class="blog-card"');
        if (insertPoint > -1) {
          const before = indexHtml.lastIndexOf('\n', insertPoint);
          indexHtml = indexHtml.substring(0, before + 1) + card + indexHtml.substring(before + 1);
        }
        const novoRegex = / · NOVO<\/span>/g;
        let novoCount = 0;
        indexHtml = indexHtml.replace(novoRegex, (match) => {
          novoCount++;
          return novoCount === 1 ? match : '</span>';
        });
        require('fs').writeFileSync(indexPath, indexHtml, 'utf8');
      }
    } catch(e) { /* index update is best-effort */ }

    // Update DB
    db.prepare("UPDATE articles SET status = 'published', published_url = ?, published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
      .run(`https://www.${projConfig.domain}/blog/${article.slug}`, article.id);

    json({
      ok: true,
      method: 'file',
      id: article.id,
      title: article.title,
      slug: article.slug,
      url: `https://www.${projConfig.domain}/blog/${article.slug}`,
      blogPath,
      deployCommand: projConfig.deploy_command || (projConfig.deploy && projConfig.deploy.command)
    });
  },

  // Deploy: route based on project config deploy method
  'deploy': () => {
    const project = args[0] || 'nakupsrebra';
    const projFile = path.join(__dirname, '..', 'projects', `${project}.json`);
    let projConfig;
    try { projConfig = JSON.parse(require('fs').readFileSync(projFile, 'utf8')); }
    catch(e) { json({ error: `Project config not found: ${projFile}` }); return; }

    const deployMethod = (projConfig.deploy && projConfig.deploy.method) || 'vercel';

    if (deployMethod === 'api') {
      // API-based projects auto-deploy on publish — no separate deploy step needed
      json({ ok: true, project, method: 'api', message: 'API projects deploy on publish — no separate deploy needed' });
      return;
    }

    // File-based: run deploy command (vercel, etc.)
    const { execSync } = require('child_process');
    try {
      const deployCmd = projConfig.deploy_command || (projConfig.deploy && projConfig.deploy.command);
      if (!deployCmd) { json({ error: 'No deploy command in project config' }); return; }
      const output = execSync(deployCmd, { encoding: 'utf8', timeout: 120000 });
      json({ ok: true, project, method: deployMethod, output: output.trim().split('\n').slice(-3).join('\n') });
    } catch(e) {
      json({ error: 'Deploy failed', message: e.message });
    }
  },

  // Git publish: commit and push blog changes (file-based projects only)
  'git-publish': () => {
    const id = parseInt(args[0]);
    if (!id) { json({ error: 'usage: git-publish <id>' }); return; }
    const db = getDb();
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!article) { json({ error: 'Article not found' }); return; }

    const projFile = path.join(__dirname, '..', 'projects', `${article.project}.json`);
    let projConfig;
    try { projConfig = JSON.parse(require('fs').readFileSync(projFile, 'utf8')); }
    catch(e) { json({ error: `Project config not found: ${projFile}` }); return; }

    const deployMethod = (projConfig.deploy && projConfig.deploy.method) || 'vercel';
    if (deployMethod === 'api') {
      // API projects don't need git publish — content lives in the API
      json({ ok: true, id, slug: article.slug, method: 'api', message: 'API projects skip git-publish' });
      return;
    }

    const blogDirPath = projConfig.blog_dir || (projConfig.paths && projConfig.paths.blog_dir);
    const repoDir = projConfig.repo_dir || (projConfig.paths && projConfig.paths.repo_dir) || path.dirname(blogDirPath);
    const { execSync } = require('child_process');
    try {
      execSync(`cd ${repoDir} && git add -A`, { encoding: 'utf8' });
      const commitMsg = `Publish: ${article.title}`;
      try {
        execSync(`cd ${repoDir} && git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
      } catch(e) {
        if (!e.message.includes('nothing to commit')) throw e;
      }
      execSync(`cd ${repoDir} && git push`, { encoding: 'utf8', timeout: 30000 });
      const hash = execSync(`cd ${repoDir} && git rev-parse --short HEAD`, { encoding: 'utf8' }).trim();
      json({ ok: true, id, slug: article.slug, method: 'file', commitHash: hash });
    } catch(e) {
      json({ error: 'Git publish failed', message: e.message });
    }
  },

  // Social post: publish pending social posts for an article
  'social-post': () => {
    const articleId = parseInt(args[0]);
    if (!articleId) { json({ error: 'usage: social-post <article_id>' }); return; }
    const db = getDb();
    const posts = db.prepare("SELECT * FROM social_posts WHERE article_id = ? AND status IN ('draft','failed') ORDER BY id").all(articleId);
    if (!posts.length) { json({ ok: true, message: 'No pending social posts', posted: [] }); return; }

    const { execSync } = require('child_process');
    const results = [];
    for (const post of posts) {
      if (post.platform === 'twitter') {
        try {
          const content = post.content.replace(/'/g, "'\\''");
          const output = execSync(`bird tweet '${content}'`, { encoding: 'utf8', timeout: 30000 });
          const urlMatch = output.match(/https:\/\/x\.com\S+/);
          const postUrl = urlMatch ? urlMatch[0] : null;
          db.prepare("UPDATE social_posts SET status = 'posted', posted_at = datetime('now'), post_url = ? WHERE id = ?")
            .run(postUrl, post.id);
          results.push({ id: post.id, platform: 'twitter', status: 'posted', url: postUrl });
        } catch(e) {
          results.push({ id: post.id, platform: 'twitter', status: 'failed', error: e.message.substring(0, 200) });
        }
      } else {
        results.push({ id: post.id, platform: post.platform, status: 'skipped', reason: 'No CLI for ' + post.platform });
      }
    }
    json({ ok: true, posted: results });
  },

  // Social: list pending social posts
  'social-list': () => {
    const status = args[0] || 'draft';
    const db = getDb();
    const rows = db.prepare('SELECT * FROM social_posts WHERE status = ? ORDER BY id').all(status);
    json({ count: rows.length, posts: rows });
  },

  // Unpublish: remove article from production, set status back to 'review'
  'unpublish': () => {
    const id = parseInt(args[0]);
    if (!id) { json({ error: 'usage: unpublish <id>' }); return; }
    const db = getDb();
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!article) { json({ error: 'Article not found' }); return; }
    if (article.status !== 'published' && article.status !== 'promoted') {
      json({ error: `Article status is '${article.status}', not published/promoted` }); return;
    }

    const projFile = path.join(__dirname, '..', 'projects', `${article.project}.json`);
    let projConfig;
    try { projConfig = JSON.parse(require('fs').readFileSync(projFile, 'utf8')); }
    catch(e) { json({ error: `Project config not found: ${projFile}` }); return; }

    const deployMethod = (projConfig.deploy && projConfig.deploy.method) || 'vercel';
    const { execSync } = require('child_process');
    const steps = [];

    if (deployMethod === 'api') {
      // API: DELETE the article
      let apiKey;
      const apiAuthEnv = projConfig.deploy.api_auth_env;
      try {
        const envFile = require('fs').readFileSync(path.join(require('os').homedir(), '.env'), 'utf8');
        const match = envFile.match(new RegExp(`${apiAuthEnv}=(.+)`));
        apiKey = match ? match[1].trim() : null;
      } catch(e) { /* */ }
      if (!apiKey) { json({ error: `API key not found for ${apiAuthEnv}` }); return; }

      // Baseman uses /api/blog?slug= for DELETE (not /api/blog-html)
      const baseUrl = projConfig.deploy.api_endpoint.replace('/blog-html', '/blog').replace(/\/$/, '');
      const deleteUrl = `${baseUrl}?slug=${article.slug}`;
      try {
        const output = execSync(`curl -s -w '\\n%{http_code}' -X DELETE '${deleteUrl}' -H 'Authorization: Bearer ${apiKey}'`, { encoding: 'utf8', timeout: 15000 });
        const lines = output.trim().split('\n');
        const httpCode = lines.pop();
        steps.push({ step: 'api-delete', ok: parseInt(httpCode) < 400, httpCode });
      } catch(e) {
        steps.push({ step: 'api-delete', ok: false, error: e.message.substring(0, 200) });
      }
    } else {
      // File-based: delete HTML, remove from index, git push, redeploy
      const blogDir = projConfig.blog_dir || (projConfig.paths && projConfig.paths.blog_dir);
      const repoDir = projConfig.repo_dir || (projConfig.paths && projConfig.paths.repo_dir) || (blogDir ? path.dirname(blogDir) : null);

      // 1. Delete HTML file
      if (blogDir) {
        const blogPath = path.join(blogDir, `${article.slug}.html`);
        try {
          require('fs').unlinkSync(blogPath);
          steps.push({ step: 'delete-html', ok: true, path: blogPath });
        } catch(e) {
          steps.push({ step: 'delete-html', ok: false, error: e.message });
        }
      }

      // 2. Remove from index.html
      if (blogDir) {
        const indexPath = path.join(blogDir, 'index.html');
        try {
          let html = require('fs').readFileSync(indexPath, 'utf8');
          const cardRegex = new RegExp(`\\s*<a href="/blog/${article.slug}"[^]*?</a>\\s*`, 'g');
          const newHtml = html.replace(cardRegex, '\n');
          if (newHtml !== html) {
            require('fs').writeFileSync(indexPath, newHtml, 'utf8');
            steps.push({ step: 'remove-from-index', ok: true });
          } else {
            steps.push({ step: 'remove-from-index', ok: true, note: 'not in index' });
          }
        } catch(e) {
          steps.push({ step: 'remove-from-index', ok: false, error: e.message });
        }
      }

      // 3. Git commit + push
      if (repoDir) {
        try {
          execSync(`cd ${repoDir} && git add -A`, { encoding: 'utf8' });
          try {
            execSync(`cd ${repoDir} && git commit -m "Unpublish: ${article.title.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
          } catch(e) {
            if (!e.message.includes('nothing to commit')) throw e;
          }
          execSync(`cd ${repoDir} && git push`, { encoding: 'utf8', timeout: 30000 });
          steps.push({ step: 'git-push', ok: true });
        } catch(e) {
          steps.push({ step: 'git-push', ok: false, error: e.message.substring(0, 200) });
        }
      }

      // 4. Redeploy
      const deployCmd = projConfig.deploy_command || (projConfig.deploy && projConfig.deploy.command);
      if (deployCmd) {
        try {
          execSync(deployCmd, { encoding: 'utf8', timeout: 120000 });
          steps.push({ step: 'redeploy', ok: true });
        } catch(e) {
          steps.push({ step: 'redeploy', ok: false, error: e.message.substring(0, 200) });
        }
      }
    }

    // Update DB: status back to review, clear published fields
    db.prepare("UPDATE articles SET status = 'review', published_url = NULL, published_at = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
    steps.push({ step: 'db-update', ok: true, newStatus: 'review' });

    const allOk = steps.every(s => s.ok);
    json({ ok: allOk, id, title: article.title, slug: article.slug, method: deployMethod, steps });
  },

  // Delete: permanently remove article from production AND database
  'delete': () => {
    const id = parseInt(args[0]);
    if (!id) { json({ error: 'usage: delete <id>' }); return; }
    const db = getDb();
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!article) { json({ error: 'Article not found' }); return; }

    const steps = [];
    const wasPublished = article.status === 'published' || article.status === 'promoted';

    // If published, remove from production first
    if (wasPublished) {
      const projFile = path.join(__dirname, '..', 'projects', `${article.project}.json`);
      let projConfig;
      try { projConfig = JSON.parse(require('fs').readFileSync(projFile, 'utf8')); }
      catch(e) { json({ error: `Project config not found: ${projFile}` }); return; }

      const deployMethod = (projConfig.deploy && projConfig.deploy.method) || 'vercel';
      const { execSync } = require('child_process');

      if (deployMethod === 'api') {
        let apiKey;
        const apiAuthEnv = projConfig.deploy.api_auth_env;
        try {
          const envFile = require('fs').readFileSync(path.join(require('os').homedir(), '.env'), 'utf8');
          const match = envFile.match(new RegExp(`${apiAuthEnv}=(.+)`));
          apiKey = match ? match[1].trim() : null;
        } catch(e) { /* */ }
        if (apiKey) {
          const baseUrl = projConfig.deploy.api_endpoint.replace('/blog-html', '/blog').replace(/\/$/, '');
          try {
            const output = execSync(`curl -s -w '\\n%{http_code}' -X DELETE '${baseUrl}?slug=${article.slug}' -H 'Authorization: Bearer ${apiKey}'`, { encoding: 'utf8', timeout: 15000 });
            const lines = output.trim().split('\n');
            const httpCode = lines.pop();
            steps.push({ step: 'api-delete', ok: parseInt(httpCode) < 400, httpCode });
          } catch(e) {
            steps.push({ step: 'api-delete', ok: false, error: e.message.substring(0, 200) });
          }
        }
      } else {
        const blogDir = projConfig.blog_dir || (projConfig.paths && projConfig.paths.blog_dir);
        const repoDir = projConfig.repo_dir || (projConfig.paths && projConfig.paths.repo_dir) || (blogDir ? path.dirname(blogDir) : null);

        if (blogDir) {
          const blogPath = path.join(blogDir, `${article.slug}.html`);
          try { require('fs').unlinkSync(blogPath); steps.push({ step: 'delete-html', ok: true }); }
          catch(e) { steps.push({ step: 'delete-html', ok: false, error: e.message }); }

          const indexPath = path.join(blogDir, 'index.html');
          try {
            let html = require('fs').readFileSync(indexPath, 'utf8');
            const cardRegex = new RegExp(`\\s*<a href="/blog/${article.slug}"[^]*?</a>\\s*`, 'g');
            const newHtml = html.replace(cardRegex, '\n');
            if (newHtml !== html) require('fs').writeFileSync(indexPath, newHtml, 'utf8');
            steps.push({ step: 'remove-from-index', ok: true });
          } catch(e) { steps.push({ step: 'remove-from-index', ok: false, error: e.message }); }
        }

        if (repoDir) {
          try {
            execSync(`cd ${repoDir} && git add -A`, { encoding: 'utf8' });
            try { execSync(`cd ${repoDir} && git commit -m "Delete: ${article.title.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }); }
            catch(e) { if (!e.message.includes('nothing to commit')) throw e; }
            execSync(`cd ${repoDir} && git push`, { encoding: 'utf8', timeout: 30000 });
            steps.push({ step: 'git-push', ok: true });
          } catch(e) { steps.push({ step: 'git-push', ok: false, error: e.message.substring(0, 200) }); }
        }

        const deployCmd = projConfig.deploy_command || (projConfig.deploy && projConfig.deploy.command);
        if (deployCmd) {
          try {
            execSync(deployCmd, { encoding: 'utf8', timeout: 120000 });
            steps.push({ step: 'redeploy', ok: true });
          } catch(e) { steps.push({ step: 'redeploy', ok: false, error: e.message.substring(0, 200) }); }
        }
      }
    }

    // Delete social posts
    const socialDeleted = db.prepare('DELETE FROM social_posts WHERE article_id = ?').run(id);
    steps.push({ step: 'delete-social-posts', ok: true, count: socialDeleted.changes });

    // Delete article events (fix for FOREIGN KEY constraint)
    const eventsDeleted = db.prepare('DELETE FROM article_events WHERE article_id = ?').run(id);
    steps.push({ step: 'delete-events', ok: true, count: eventsDeleted.changes });

    // Delete pipeline logs
    const logsDeleted = db.prepare('DELETE FROM pipeline_log WHERE article_id = ?').run(id);
    steps.push({ step: 'delete-logs', ok: true, count: logsDeleted.changes });

    // Delete agent runs
    const runsDeleted = db.prepare('DELETE FROM agent_runs WHERE article_id = ?').run(id);
    steps.push({ step: 'delete-runs', ok: true, count: runsDeleted.changes });

    // Unlink topic suggestions (don't delete, just free up the topic)
    const topicsUnlinked = db.prepare('UPDATE topic_suggestions SET used_by_article_id = NULL WHERE used_by_article_id = ?').run(id);
    steps.push({ step: 'unlink-topics', ok: true, count: topicsUnlinked.changes });

    // Delete from DB
    db.prepare('DELETE FROM articles WHERE id = ?').run(id);
    steps.push({ step: 'delete-from-db', ok: true });

    const allOk = steps.every(s => s.ok);
    json({ ok: allOk, id, title: article.title, slug: article.slug, wasPublished, steps });
  },

  // Force-write: mark next todo article for a project as priority:forced
  'force-write': () => {
    const project = args[0];
    if (!project) { 
      console.log('Usage: pipeline-cli.js force-write <project>'); 
      process.exit(1); 
    }
    const db = getDb();
    const article = db.prepare("SELECT id,title,notes FROM articles WHERE project=? AND status IN ('todo','writing','backlog') ORDER BY CASE WHEN status='writing' THEN 0 WHEN status='todo' THEN 1 ELSE 2 END, created_at ASC LIMIT 1").get(project);
    if (!article) { 
      console.log(`No articles in todo/writing/backlog for ${project}`); 
      process.exit(0); 
    }
    const notes = article.notes ? article.notes + '\npriority:forced' : 'priority:forced';
    db.prepare("UPDATE articles SET notes=? WHERE id=?").run(notes, article.id);
    console.log(`✅ Force override set on article #${article.id}: "${article.title}"`);
  },

  // Status summary
  'status': () => {
    const db = getDb();
    const counts = db.prepare(`
      SELECT status, COUNT(*) as count FROM articles GROUP BY status ORDER BY 
      CASE status 
        WHEN 'backlog' THEN 1 WHEN 'todo' THEN 2 WHEN 'writing' THEN 3 
        WHEN 'review' THEN 4 WHEN 'ready' THEN 5 WHEN 'awaiting_approval' THEN 6 
        WHEN 'published' THEN 7 WHEN 'promoted' THEN 8 
      END
    `).all();
    const social = db.prepare("SELECT status, COUNT(*) as count FROM social_posts GROUP BY status").all();
    json({ articles: counts, social });
  }
};

if (!cmd || !commands[cmd]) {
  json({
    error: 'Unknown command',
    commands: Object.keys(commands),
    usage: 'pipeline-cli.js <command> [args...]'
  });
  process.exit(1);
}

commands[cmd]();
