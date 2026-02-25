#!/bin/bash
cd /home/clawdbot/clawd
echo "📊 Content Pipeline Status — $(date '+%Y-%m-%d %H:%M CET')"
echo "========================================="
node content-pipeline/scripts/db-helper.js status
