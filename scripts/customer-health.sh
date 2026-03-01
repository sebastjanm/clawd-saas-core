#!/bin/bash
# ============================================================================
# Customer Health Monitor
# ============================================================================
# Config: ~/.saas-customers (one line per customer: slug|host|port)
# Usage: ./customer-health.sh [--quiet]
# Cron:  */5 * * * * ~/clawd-saas-core/scripts/customer-health.sh --quiet
# ============================================================================
set -euo pipefail

CONFIG="${HOME}/.saas-customers"
TIMEOUT=5
QUIET=false
[[ "${1:-}" == "--quiet" ]] && QUIET=true

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
  url="http://${host}:${port}/pipeline/health"
  response=$(curl -s --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "UNREACHABLE")

  if echo "$response" | grep -q '"status":"ok"'; then
    HEALTHY=$((HEALTHY + 1))
    uptime=$(echo "$response" | python3 -c "import sys,json; print(f'{json.load(sys.stdin)[\"uptime\"]/3600:.1f}h')" 2>/dev/null || echo "?")
    $QUIET || echo "✅ $slug ($host:$port) — up ${uptime}"
  else
    reason="unreachable"
    [[ "$response" != "UNREACHABLE" ]] && reason=$(echo "$response" | head -c 100)
    PROBLEMS+=("❌ $slug ($host:$port) — $reason")
    $QUIET || echo "❌ $slug ($host:$port) — $reason"
  fi
done < "$CONFIG"

if [[ ${#PROBLEMS[@]} -gt 0 ]]; then
  echo ""
  echo "⚠️  ${#PROBLEMS[@]}/$TOTAL customers DOWN:"
  printf '  %s\n' "${PROBLEMS[@]}"
  exit 1
else
  $QUIET || echo "✅ All $TOTAL customers healthy"
  exit 0
fi
