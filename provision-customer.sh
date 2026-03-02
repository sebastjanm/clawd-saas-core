#!/bin/bash
# ============================================================================
# 🏭 EasyAI Start — Customer Provisioning Script
# ============================================================================
# Usage: ./provision-customer.sh <slug> <company> <language> [domain] [--api-key KEY] [--provider anthropic|openai]
# ============================================================================
set -euo pipefail

NODE_VERSION="22"
SLUG=""
COMPANY=""
LANG="en"
DOMAIN=""
API_KEY=""
PROVIDER="anthropic"
DEFAULT_MODEL=""

# Parse positional and named args
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key) API_KEY="$2"; shift 2 ;;
    --provider) PROVIDER="$2"; shift 2 ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done

SLUG="${POSITIONAL[0]:-}"
COMPANY="${POSITIONAL[1]:-}"
LANG="${POSITIONAL[2]:-en}"
DOMAIN="${POSITIONAL[3]:-}"

if [[ -z "$SLUG" || -z "$COMPANY" ]]; then
  echo "Usage: $0 <slug> <company> <language> [domain] [--api-key KEY] [--provider anthropic|openai]"
  exit 1
fi

# Set default model based on provider
if [[ "$PROVIDER" == "openai" ]]; then
  DEFAULT_MODEL="${DEFAULT_MODEL:-openai/gpt-4o}"
else
  DEFAULT_MODEL="${DEFAULT_MODEL:-anthropic/claude-sonnet-4-6}"
fi

# Set provider env key name
if [[ "$PROVIDER" == "openai" ]]; then
  PROVIDER_ENV_KEY="OPENAI_API_KEY"
else
  PROVIDER_ENV_KEY="ANTHROPIC_API_KEY"
fi

# Prompt for API key if not provided
if [[ -z "$API_KEY" ]]; then
  read -rp "Enter your AI API key: " API_KEY
fi

# Validate API key format
if [[ "$PROVIDER" == "anthropic" && ! "$API_KEY" =~ ^sk-ant- ]]; then
  echo "❌ Invalid Anthropic API key (must start with sk-ant-)"
  exit 1
elif [[ "$PROVIDER" == "openai" && ! "$API_KEY" =~ ^sk- ]]; then
  echo "❌ Invalid OpenAI API key (must start with sk-)"
  exit 1
fi

REPO_URL="https://github.com/sebastjanm/clawd-saas-core.git"
INSTALL_DIR="$HOME/clawd-saas-core"
DASHBOARD_PORT=4000
ROUTER_PORT=4001
DASHBOARD_TOKEN=$(openssl rand -hex 24)
GATEWAY_TOKEN=$(openssl rand -hex 24)
WEBHOOK_TOKEN=$(openssl rand -hex 32)

echo "============================================"
echo "🏭 Provisioning: $COMPANY ($SLUG)"
echo "   Language: $LANG"
echo "   Domain:   ${DOMAIN:-none}"
echo "============================================"

# 1. System packages
echo "📦 1/12: System packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl git build-essential sqlite3 python3 > /dev/null 2>&1
echo "   ✅ Done"

# 2. Node.js (pinned version via nvm)
echo "📦 2/12: Node.js v${NODE_VERSION}..."
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash 2>/dev/null
fi
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm install "$NODE_VERSION" > /dev/null 2>&1
nvm alias default "$NODE_VERSION" > /dev/null 2>&1
echo "   ✅ Node $(node -v)"

# 3. PM2
echo "📦 3/12: PM2..."
command -v pm2 &> /dev/null || npm install -g pm2 > /dev/null 2>&1
echo "   ✅ Ready"

# 4. OpenClaw
echo "📦 4/12: OpenClaw..."
npm install -g openclaw > /dev/null 2>&1
echo "   ✅ OpenClaw $(openclaw --version 2>/dev/null || echo 'installed')"

# 5. Clone/update
echo "📦 5/12: Repository..."
if [ ! -d "$INSTALL_DIR" ]; then
  git clone "$REPO_URL" "$INSTALL_DIR" 2>/dev/null
  echo "   ✅ Cloned"
else
  cd "$INSTALL_DIR" && git pull --ff-only 2>/dev/null
  echo "   ✅ Updated"
fi
cd "$INSTALL_DIR"

# 6. Dependencies
echo "📦 6/12: Dependencies..."
npm install --production > /dev/null 2>&1
cd dashboard && npm install > /dev/null 2>&1 && cd ..
echo "   ✅ Done"

# 7. Database
echo "📦 7/12: Database..."
mkdir -p db
if [ ! -f "db/pipeline.db" ]; then
  sqlite3 db/pipeline.db < db/schema.sql
  echo "   ✅ Created"
else
  echo "   ✅ Exists"
fi

# 8. Customer config
echo "📦 8/12: Configuration..."

cat > .env << ENVEOF
# EasyAI Start — $COMPANY
# Generated: $(date -u +"%Y-%m-%d %H:%M UTC")
DASHBOARD_TOKEN=$DASHBOARD_TOKEN
PIPELINE_DB=$INSTALL_DIR/db/pipeline.db
PROJECTS_DIR=$INSTALL_DIR/projects
PIPELINE_ROUTER_PORT=$ROUTER_PORT
COMPANY_NAME=$COMPANY
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

# 9. OpenClaw gateway
echo "📦 9/12: OpenClaw gateway..."
mkdir -p ~/.openclaw
sed -e "s|{{PROVIDER}}|$PROVIDER|g" \
    -e "s|{{LLM_API_KEY}}|$API_KEY|g" \
    -e "s|{{DEFAULT_MODEL}}|$DEFAULT_MODEL|g" \
    -e "s|{{GATEWAY_TOKEN}}|$GATEWAY_TOKEN|g" \
    -e "s|{{WEBHOOK_TOKEN}}|$WEBHOOK_TOKEN|g" \
    -e "s|{{PROVIDER_ENV_KEY}}|$PROVIDER_ENV_KEY|g" \
    "$INSTALL_DIR/config/openclaw.json.template" > ~/.openclaw/openclaw.json
openclaw gateway start > /dev/null 2>&1 || true
sleep 2
if curl -sf http://127.0.0.1:18789 > /dev/null 2>&1; then
  echo "   ✅ Gateway running"
else
  echo "   ⚠️  Gateway may not be responding yet (will retry after launch)"
fi

# 10. Build & launch
echo "📦 10/12: Build & launch..."
cd "$INSTALL_DIR/dashboard" && npm run build > /dev/null 2>&1

pm2 delete saas-router 2>/dev/null || true
pm2 delete saas-dashboard 2>/dev/null || true

cd "$INSTALL_DIR"
PIPELINE_DB="$INSTALL_DIR/db/pipeline.db" \
PROJECTS_DIR="$INSTALL_DIR/projects" \
PIPELINE_ROUTER_PORT=$ROUTER_PORT \
HOOKS_URL="http://127.0.0.1:18789/hooks/agent" \
HOOKS_TOKEN="$GATEWAY_TOKEN" \
pm2 start router/router.js --name saas-router

cd "$INSTALL_DIR/dashboard"
DASHBOARD_TOKEN=$DASHBOARD_TOKEN \
PIPELINE_DB_PATH="$INSTALL_DIR/db/pipeline.db" \
PIPELINE_ROUTER_URL="http://127.0.0.1:$ROUTER_PORT" \
COMPANY_NAME="$COMPANY" \
NEXT_PUBLIC_COMPANY_NAME="$COMPANY" \
pm2 start npm --name saas-dashboard -- start -- -p $DASHBOARD_PORT

pm2 save > /dev/null 2>&1
pm2 startup 2>/dev/null | grep "sudo" | bash 2>/dev/null || true

# 11. Caddy reverse proxy (HTTPS)
echo "📦 11/12: HTTPS setup..."
if [[ -n "$DOMAIN" ]]; then
  # Install Caddy if not present
  if ! command -v caddy &> /dev/null; then
    sudo apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https > /dev/null 2>&1
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    sudo apt-get update -qq > /dev/null 2>&1
    sudo apt-get install -y -qq caddy > /dev/null 2>&1
  fi

  # Write Caddyfile
  sudo tee /etc/caddy/Caddyfile > /dev/null << CADDYEOF
$DOMAIN {
  reverse_proxy localhost:$DASHBOARD_PORT
}
CADDYEOF

  sudo systemctl enable caddy > /dev/null 2>&1
  sudo systemctl restart caddy > /dev/null 2>&1
  echo "   ✅ Caddy configured for $DOMAIN (auto-HTTPS)"
else
  echo "   ⏭️  No domain provided, skipping HTTPS"
  echo "   ⚠️  Dashboard accessible at http://<IP>:$DASHBOARD_PORT (not secure)"
fi

# 12. Firewall
echo "📦 12/12: Firewall..."
sudo ufw allow 22/tcp > /dev/null 2>&1
sudo ufw allow 80/tcp > /dev/null 2>&1
sudo ufw allow 443/tcp > /dev/null 2>&1
sudo ufw --force enable > /dev/null 2>&1
echo "   ✅ UFW enabled (SSH, HTTP, HTTPS only)"

cd "$INSTALL_DIR"
cat > CUSTOMER.md << RECEIPT
# Customer: $COMPANY
- **Slug:** $SLUG
- **Language:** $LANG
- **Provisioned:** $(date -u +"%Y-%m-%d %H:%M UTC")
- **Dashboard:** ${DOMAIN:-http://$(hostname -I 2>/dev/null | awk '{print $1}'):$DASHBOARD_PORT}
- **Router:** localhost:$ROUTER_PORT
- **Gateway:** localhost:18789
- **Domain:** ${DOMAIN:-not set}
- **Provider:** $PROVIDER
- **OpenClaw:** $(openclaw --version 2>/dev/null || echo "unknown")
- **API Key:** Stored in ~/.openclaw/openclaw.json (never share!)
RECEIPT

echo ""
echo "============================================"
echo "🎉 DONE"
echo "============================================"
echo ""
echo "Customer:   $COMPANY ($SLUG)"
if [[ -n "$DOMAIN" ]]; then
  echo "Dashboard:  https://$DOMAIN"
else
  echo "Dashboard:  http://$(hostname -I 2>/dev/null | awk '{print $1}'):$DASHBOARD_PORT"
fi
echo ""
echo "🔑 Token: $DASHBOARD_TOKEN"
echo ""
echo "📋 Next:"
echo "   1. Edit projects/$SLUG.json (client details, integrations)"
if [[ -z "$DOMAIN" ]]; then
  echo "   2. Add domain: edit /etc/caddy/Caddyfile, sudo systemctl restart caddy"
fi
echo "   3. Unpause: curl -X POST localhost:$ROUTER_PORT/pipeline/pause -H 'Content-Type: application/json' -d '{\"project\":\"$SLUG\",\"paused\":false}'"
echo "============================================"
