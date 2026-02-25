const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const [,, name, lang, tone] = process.argv;

if (!name) {
  console.log('Usage: node add-project.js <Name> <Lang> <Tone>');
  process.exit(1);
}

const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dbPath = process.env.PIPELINE_DB || path.join(__dirname, '../../db/pipeline.db');
const db = new Database(dbPath);

console.log(`🚀 Adding RICH Project: ${name} (${id})`);

// 1. Create Rich Config
const config = {
  project_id: id,
  client: {
    company_name: name,
    legal_entity: "",
    vat_id: "",
    address: "",
    website: "",
    contact: {
      primary_name: "",
      email: "",
      phone: ""
    },
    plan: "standard", // standard, pro, enterprise
    billing_cycle: "monthly"
  },
  language: lang || 'en',
  writing: {
    tone: tone || 'professional',
    word_count: '800-1200',
    target_audience: 'General public',
    forbidden: ['AI jargon', 'Delve', 'Landscape'],
    guidelines: 'Write helpful, informative content.',
    mission: `Establish ${name} as a thought leader in their industry.`
  },
  social: {
    platforms: ['linkedin', 'facebook'],
    tone: "engaging"
  },
  integrations: {
    wordpress_url: "",
    wordpress_user: "",
    wordpress_key: ""
  }
};

const configPath = path.join(__dirname, '../../projects', `${id}.json`);
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log(`✅ Config created: ${configPath}`);
console.log(`📝 TODO: Edit ${id}.json with VAT, Contact & API details.`);

// 2. Insert into DB
try {
  const stmt = db.prepare(`
    INSERT INTO project_settings (project, daily_limit, vacation_mode, auto_approve, paused, updated_at)
    VALUES (?, 2, 0, 0, 0, datetime('now'))
  `);
  stmt.run(id);
  console.log(`✅ DB Record inserted for ${id}`);
} catch (e) {
  if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
    console.log(`⚠️ Project ${id} already in DB.`);
  } else {
    console.error('❌ DB Error:', e.message);
  }
}
