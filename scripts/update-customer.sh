#!/bin/bash
# ============================================================================
# 🔄 EasyAI Start — Customer Update Script
# ============================================================================
# Pulls latest code, rebuilds, and restarts services on customer VPSes.
#
# Usage:
#   ./update-customer.sh <slug>          # Update one customer
#   ./update-customer.sh --all           # Update all customers
#   ./update-customer.sh --all --dry-run # Preview what would happen
#
# Config: ~/.saas-customers (slug|host|port)
# SSH:    Requires root SSH key access to customer VPSes
# ============================================================================
set -euo pipefail

CONFIG="${HOME}/.saas-customers"
DRY_RUN=false
TARGET=""
INSTALL_DIR="/root/clawd-saas-core"  # Default remote install path

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) TARGET="__all__"; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) TARGET="$1"; shift ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 <slug|--all> [--dry-run]"
  echo ""
  echo "Customers:"
  if [[ -f "$CONFIG" ]]; then
    while IFS='|' read -r slug host port; do
      [[ "$host" == "127.0.0.1" ]] && echo "  $slug (local, port $port)" || echo "  $slug ($host, port $port)"
    done < "$CONFIG"
  fi
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "❌ No customer config at $CONFIG"
  exit 1
fi

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

update_remote() {
  local slug="$1" host="$2" port="$3"

  echo ""
  echo "============================================"
  echo -e "🔄 Updating: ${GREEN}${slug}${NC} (${host}:${port})"
  echo "============================================"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "  ${YELLOW}[DRY RUN]${NC} Would SSH to ${host} and:"
    echo "    1. git pull"
    echo "    2. npm install (router + dashboard)"
    echo "    3. npm run build (dashboard)"
    echo "    4. pm2 restart saas-router saas-dashboard"
    return 0
  fi

  ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "root@${host}" bash <<-REMOTE
    set -e
    cd ${INSTALL_DIR}
    echo "  📥 Pulling latest..."
    git pull --ff-only 2>&1 | tail -1

    echo "  📦 Installing deps..."
    npm install --production > /dev/null 2>&1
    cd dashboard && npm install > /dev/null 2>&1

    echo "  📦 Updating OpenClaw..."
    npm update -g openclaw > /dev/null 2>&1 || true

    echo "  🔨 Building dashboard..."
    npm run build > /dev/null 2>&1
    cd ..

    echo "  🔄 Restarting services..."
    pm2 restart saas-router saas-dashboard 2>&1 | grep -E "✓|online"

    echo "  🔄 Restarting OpenClaw gateway..."
    openclaw gateway restart > /dev/null 2>&1 || true

    echo "  🩺 Health check..."
    sleep 3
    STATUS=\$(curl -sf http://127.0.0.1:${port}/api/health 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "unreachable")
    if [[ "\$STATUS" == "ok" ]]; then
      echo "  ✅ ${slug} healthy"
    else
      echo "  ⚠️  ${slug} health check returned: \$STATUS"
      exit 1
    fi

    GW_STATUS=\$(curl -sf http://127.0.0.1:18789 > /dev/null 2>&1 && echo "ok" || echo "unreachable")
    if [[ "\$GW_STATUS" == "ok" ]]; then
      echo "  ✅ OpenClaw gateway healthy"
    else
      echo "  ⚠️  OpenClaw gateway: \$GW_STATUS"
    fi
REMOTE

  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo -e "  ${RED}❌ Update failed for ${slug}${NC}"
    return 1
  fi
}

update_local() {
  local slug="$1" port="$2"

  echo ""
  echo "============================================"
  echo -e "🔄 Updating: ${GREEN}${slug}${NC} (local, port ${port})"
  echo "============================================"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "  ${YELLOW}[DRY RUN]${NC} Would update local SaaS instance"
    return 0
  fi

  cd "${HOME}/clawd-saas-core"
  echo "  📥 Pulling latest..."
  git pull --ff-only 2>&1 | tail -1

  echo "  📦 Installing deps..."
  npm install --production > /dev/null 2>&1
  cd dashboard && npm install > /dev/null 2>&1

  echo "  🔨 Building dashboard..."
  npm run build > /dev/null 2>&1
  cd ..

  echo "  🔄 Restarting services..."
  export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
  pm2 restart saas-router saas-dashboard 2>&1 | grep -E "✓|online"

  sleep 3
  STATUS=$(curl -sf "http://127.0.0.1:${port}/api/health" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "unreachable")
  if [[ "$STATUS" == "ok" ]]; then
    echo "  ✅ ${slug} healthy"
  else
    echo "  ⚠️  ${slug} health check returned: $STATUS"
    return 1
  fi
}

# Main
FAILED=0
UPDATED=0

while IFS='|' read -r slug host port; do
  [[ -z "$slug" || "$slug" == \#* ]] && continue

  if [[ "$TARGET" != "__all__" && "$TARGET" != "$slug" ]]; then
    continue
  fi

  if [[ "$host" == "127.0.0.1" || "$host" == "localhost" ]]; then
    update_local "$slug" "$port" || FAILED=$((FAILED+1))
  else
    update_remote "$slug" "$host" "$port" || FAILED=$((FAILED+1))
  fi
  UPDATED=$((UPDATED+1))
done < "$CONFIG"

echo ""
echo "============================================"
if [[ $UPDATED -eq 0 ]]; then
  echo "❌ No matching customer found for: $TARGET"
  exit 1
elif [[ $FAILED -gt 0 ]]; then
  echo "⚠️  Done: $UPDATED updated, $FAILED failed"
  exit 1
else
  echo "✅ All $UPDATED customer(s) updated successfully"
fi
echo "============================================"
