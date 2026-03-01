#!/bin/bash
# ============================================================================
# 🩺 Customer Health Monitor + Telegram Alerts
# ============================================================================
# Config: ~/.saas-customers (one line per customer: slug|host|port)
# Usage: ./customer-health.sh [--quiet]
# Cron:  */5 * * * * ~/clawd-saas-core/scripts/customer-health.sh --quiet
#
# Telegram alerts: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in ~/.saas-health.env
# ============================================================================
set -euo pipefail

CONFIG="${HOME}/.saas-customers"
ENV_FILE="${HOME}/.saas-health.env"
TIMEOUT=5
QUIET=false
[[ "${1:-}" == "--quiet" ]] && QUIET=true

# Load Telegram config if exists
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
if [[ -f "$ENV_FILE" ]]; then
  source "$ENV_FILE"
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "No customers configured. Create $CONFIG:"
  echo "  echo 'mizarstvo-hrast|10.0.0.5|4001' >> ~/.saas-customers"
  exit 0
fi

TOTAL=0
HEALTHY=0
PROBLEMS=()

while IFS='|' read -r slug host port; do
  [[ -z "$slug" || "$slug" == \#* ]] && continue
  TOTAL=$((TOTAL + 1))
  # Try router health endpoint first, then dashboard login as fallback
  url="http://${host}:${port}/pipeline/health"
  response=$(curl -s --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "UNREACHABLE")

  if echo "$response" | grep -q '"status":"ok"'; then
    found_health=true
  elif [[ "$response" == "UNREACHABLE" ]]; then
    # Fallback: check if dashboard responds
    fallback=$(curl -s --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" -o /dev/null -w "%{http_code}" "http://${host}:${port}/login" 2>/dev/null || echo "000")
    if [[ "$fallback" == "200" || "$fallback" == "307" ]]; then
      found_health=true
      response='{"status":"ok","uptime":0}'
    fi
  fi

  if [[ "${found_health:-}" == "true" ]]; then
    HEALTHY=$((HEALTHY + 1))
    uptime=$(echo "$response" | python3 -c "import sys,json; print(f'{json.load(sys.stdin)[\"uptime\"]/3600:.1f}h')" 2>/dev/null || echo "?")
    $QUIET || echo "✅ $slug ($host:$port) — up ${uptime}"
  else
    reason="unreachable"
    [[ "$response" != "UNREACHABLE" ]] && reason=$(echo "$response" | head -c 100)
    PROBLEMS+=("$slug ($host:$port) — $reason")
    $QUIET || echo "❌ $slug ($host:$port) — $reason"
  fi
done < "$CONFIG"

# Alert if problems found
if [[ ${#PROBLEMS[@]} -gt 0 ]]; then
  $QUIET || echo ""
  $QUIET || echo "⚠️  ${#PROBLEMS[@]}/$TOTAL customers DOWN"

  # Send Telegram alert
  if [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_ID" ]]; then
    MSG="🚨 *EasyAI Start — Customer Alert*%0A%0A${#PROBLEMS[@]}/$TOTAL instances DOWN:%0A"
    for p in "${PROBLEMS[@]}"; do
      MSG="${MSG}%0A❌ ${p}"
    done
    MSG="${MSG}%0A%0A_$(date -u +"%Y-%m-%d %H:%M UTC")_"

    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=${MSG}" \
      -d "parse_mode=Markdown" \
      -d "disable_notification=false" > /dev/null 2>&1

    $QUIET || echo "📱 Telegram alert sent"
  fi
  exit 1
else
  $QUIET || echo "✅ All $TOTAL customers healthy"
  exit 0
fi
