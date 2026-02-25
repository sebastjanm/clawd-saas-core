#!/bin/bash
# Extract ## Contract sections from agent .md files into contracts.json
# Source of truth: agent .md files. This generates the index.

AGENTS_DIR="/home/clawdbot/clawd/content-pipeline/agents"
OUT="/home/clawdbot/clawd/content-pipeline/contracts.json"

node -e "
const fs = require('fs');
const path = require('path');
const dir = '$AGENTS_DIR';
const contracts = {};

const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.includes('memory') && !f.includes('archive'));

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8');
  const match = content.match(/## Contract\n([\s\S]*?)(?=\n## |\$)/);
  if (!match) continue;

  const agent = file.replace('.md', '').replace(/-\w+$/, ''); // pino-writer -> pino
  const block = match[1].trim();
  const contract = {};

  for (const line of block.split('\n')) {
    const m = line.match(/^- \*\*(\w+)\:\*\* (.+)$/);
    if (m) {
      const key = m[1].toLowerCase();
      contract[key] = m[2].split(', ').map(s => s.trim());
    }
  }

  if (Object.keys(contract).length > 0) {
    contracts[agent] = contract;
  }
}

fs.writeFileSync('$OUT', JSON.stringify(contracts, null, 2) + '\n');
console.log('Extracted ' + Object.keys(contracts).length + ' contracts → $OUT');
"
