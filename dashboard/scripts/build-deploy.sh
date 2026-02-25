#!/bin/bash
# Build + deploy Oly Control with proper static file linking
set -e

cd /home/clawdbot/projects/oly-center

echo "Building..."
npm run build

echo "Linking static assets into standalone..."
rm -f .next/standalone/.next/static
ln -sf /home/clawdbot/projects/oly-center/.next/static /home/clawdbot/projects/oly-center/.next/standalone/.next/static

# Public dir (symlink for runtime updates)
rm -rf .next/standalone/public
ln -sf /home/clawdbot/projects/oly-center/public .next/standalone/public

echo "Restarting..."
pm2 restart oly-control

echo "✅ Deployed"
