#!/bin/bash
# ============================================================================
# ✅ EasyAI Start — Installation Verification
# ============================================================================
# Checks that all services are running and responding.
# Exit 0 if all pass, 1 if any fail.
# ============================================================================
set -uo pipefail

ROUTER_PORT="${PIPELINE_ROUTER_PORT:-4001}"
DASHBOARD_PORT="${DASHBOARD_PORT:-4000}"
GATEWAY_PORT=18789
PASSED=0
FAILED=0

check() {
  local name="$1" url="$2"
  if curl -sf "$url" > /dev/null 2>&1; then
    echo "  ✅ $name"
    PASSED=$((PASSED+1))
  else
    echo "  ❌ $name"
    FAILED=$((FAILED+1))
  fi
}

echo "============================================"
echo "🩺 Verifying installation..."
echo "============================================"

# OpenClaw gateway
check "OpenClaw gateway (port $GATEWAY_PORT)" "http://127.0.0.1:$GATEWAY_PORT/health"

# Router health
check "Pipeline router (port $ROUTER_PORT)" "http://127.0.0.1:$ROUTER_PORT/pipeline/health"

# Dashboard
check "Dashboard (port $DASHBOARD_PORT)" "http://127.0.0.1:$DASHBOARD_PORT"

# PM2 services
echo ""
echo "  PM2 services:"
PM2_OK=true
for svc in saas-router saas-dashboard; do
  STATUS=$(pm2 show "$svc" 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "missing")
  if [[ "$STATUS" == "online" ]]; then
    echo "    ✅ $svc: online"
    PASSED=$((PASSED+1))
  else
    echo "    ❌ $svc: $STATUS"
    FAILED=$((FAILED+1))
    PM2_OK=false
  fi
done

echo ""
echo "============================================"
if [[ $FAILED -eq 0 ]]; then
  echo "✅ All $PASSED checks passed"
  exit 0
else
  echo "⚠️  $PASSED passed, $FAILED failed"
  exit 1
fi
