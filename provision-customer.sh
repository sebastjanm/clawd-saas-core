#!/bin/bash
# ============================================================================
# 🏭 Clawd SaaS — Customer Provisioning Script
# ============================================================================
# Usage: ./provision-customer.sh <customer-slug> <company-name> <language> [domain]
#
# Run on CUSTOMER'S VPS (fresh Ubuntu 22+).
# Installs everything → running content factory.
#
# Examples:
#   ./provision-customer.sh mizarstvo-hrast "Mizarstvo Hrast" sl hrast.example.com
#   ./provision-customer.sh acme-corp "ACME Corp" en
# ============================================================================
set -euo pipefail

SLUG="${1:-}"
COMPANY="${2:-}"
LANG="${3:-en}"
DOMAIN="${4:-}"

if [[ -z "$SLUG" || -z "$COMPANY" ]]; then
  echo "Usage: $0 <customer-slug> <company-name> <language> [domain]"
  exit 1
fi

REPO_URL="https://github.com/sebastjanm/clawd-saas-core.git"
INSTALL_DIR="$HOME/clawd-saas-core"
DASHBOARD_PORT=4000
ROUTER_PORT=4001
DASHBOARD_TOKEN=$(openssl rand -hex 24)

echo "============================================"
echo "🏭 Provisioning: $COMPANY ($SLUG)"
echo "   Language: $LANG"
echo "   Domain:   ${DOMAIN:-none (use IP)}"
echo "============================================"

# 1. System packages
echo "📦 1/8: System packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl git build-essential sqlite3 python3 ufw > /dev/null 2>&1
echo "   ✅ Done"

# 2. Node.js
echo "📦 2/8: Node.js..."
if ! command -v node &> /dev/null; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash 2>/dev/null
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  nvm install 22 > /dev/null 2>&1
  echo "   ✅ Node $(node -v) installed"
else
  echo "   ✅ Node $(node -v)"
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# 3. PM2
echo "📦 3/8: PM2..."
command -v pm2 &> /dev/null || npm install -g pm2 > /dev/null 2>&1
echo "   ✅ Ready"

# 4. Clone/update
echo "📦 4/8: Repository..."
if [ ! -d "$INSTALL_DIR" ]; then
  git clone "$REPO_URL" "$INSTALL_DIR" 2>/dev/null
  echo "   ✅ Cloned"
else
  cd "$INSTALL_DIR" && git pull --ff-only 2>/dev/null
  echo "   ✅ Updated"
fi
cd "$INSTALL_DIR"

# 5. Dependencies
echo "📦 5/8: Dependencies..."
npm install --production > /dev/null 2>&1
cd dashboard && npm install > /dev/null 2>&1 && cd ..
echo "   ✅ Done"

# 6. Database
echo "📦 6/8: Database..."
mkdir -p db
if [ ! -f "db/pipeline.db" ]; then
  sqlite3 db/pipeline.db < db/schema.sql
  echo "   ✅ Created"
else
  echo "   ✅ Exists"
fi

# 7. Customer config
echo "📦 7/8: Configuration..."

cat > .env << ENVEOF
# Clawd SaaS — $COMPANY
# Generated: $(date -u +"%Y-%m-%d %H:%M UTC")
DASHBOARD_TOKEN=$DASHBOARD_TOKEN
PIPELINE_DB=$INSTALL_DIR/db/pipeline.db
PROJECTS_DIR=$INSTALL_DIR/projects
PIPELINE_ROUTER_PORT=$ROUTER_PORT
ENVEOF
cp .env dashboard/.env.local

mkdir -p projects
cat > "projects/$SLUG.json" << PROJEOF
{
  "project_id": "$SLUG",
  "client": {
    "company_name": "$COMPANY",
    "legal_entity": "",
    "vat_id": "",
    "website": "",
    "contact": { "primary_name": "", "email": "", "phone": "" },
    "plan": "standard",
    "provisioned_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  },
  "language": "$LANG",
  "writing": {
    "tone": "professional",
    "word_count": "800-1200",
    "target_audience": "General",
    "forbidden": ["AI jargon", "Delve", "Landscape", "In today's fast-paced world"],
    "guidelines": "Write helpful, accurate content. No invented facts.",
    "mission": "Establish $COMPANY as a trusted voice in their industry."
  },
  "social": { "platforms": [], "tone": "engaging" },
  "integrations": {
    "wordpress_url": "",
    "wordpress_user": "",
    "wordpress_key": "",
    "blog_api_url": "",
    "blog_api_key": ""
  }
}
PROJEOF

node -e "
const Database = require('better-sqlite3');
const db = new Database('$INSTALL_DIR/db/pipeline.db');
try {
  db.prepare('INSERT INTO project_settings (project, daily_limit, vacation_mode, auto_approve, paused, updated_at) VALUES (?, 2, 0, 0, 1, datetime(\"now\"))').run('$SLUG');
  console.log('   ✅ Project inserted (paused)');
} catch(e) {
  if (e.message.includes('UNIQUE')) console.log('   ✅ Project exists');
  else throw e;
}
db.close();
"

# 8. Build & launch
echo "📦 8/8: Build & launch..."
cd "$INSTALL_DIR/dashboard" && npm run build > /dev/null 2>&1

pm2 delete saas-router 2>/dev/null || true
pm2 delete saas-dashboard 2>/dev/null || true

cd "$INSTALL_DIR"
PIPELINE_DB="$INSTALL_DIR/db/pipeline.db" \
PROJECTS_DIR="$INSTALL_DIR/projects" \
PIPELINE_ROUTER_PORT=$ROUTER_PORT \
pm2 start router/router.js --name saas-router

cd "$INSTALL_DIR/dashboard"
DASHBOARD_TOKEN=$DASHBOARD_TOKEN \
PIPELINE_DB_PATH="$INSTALL_DIR/db/pipeline.db" \
PIPELINE_ROUTER_URL="http://127.0.0.1:$ROUTER_PORT" \
pm2 start npm --name saas-dashboard -- start -- -p $DASHBOARD_PORT

pm2 save > /dev/null 2>&1
pm2 startup 2>/dev/null | grep "sudo" | bash 2>/dev/null || true

cd "$INSTALL_DIR"
cat > CUSTOMER.md << RECEIPT
# Customer: $COMPANY
- **Slug:** $SLUG
- **Language:** $LANG
- **Provisioned:** $(date -u +"%Y-%m-%d %H:%M UTC")
- **Dashboard:** :$DASHBOARD_PORT
- **Router:** :$ROUTER_PORT
- **Domain:** ${DOMAIN:-not set}
RECEIPT

echo ""
echo "============================================"
echo "🎉 DONE"
echo "============================================"
echo ""
echo "Customer:   $COMPANY ($SLUG)"
echo "Dashboard:  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):$DASHBOARD_PORT"
echo ""
echo "🔑 Token: $DASHBOARD_TOKEN"
echo ""
echo "📋 Next:"
echo "   1. Edit projects/$SLUG.json (client details, integrations)"
echo "   2. Set up Caddy reverse proxy for HTTPS"
echo "   3. Firewall: sudo ufw allow 22,80,443/tcp && sudo ufw enable"
echo "   4. Unpause: curl -X POST localhost:$ROUTER_PORT/pipeline/pause -H 'Content-Type: application/json' -d '{\"project\":\"$SLUG\",\"paused\":false}'"
echo "============================================"
