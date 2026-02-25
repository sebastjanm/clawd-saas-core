#!/bin/bash
set -e

echo "🏭 Installing Clawd SaaS Factory..."

# 1. Update System
sudo apt-get update && sudo apt-get install -y curl git build-essential sqlite3

# 2. Install Node.js (via Volta for stability)
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl https://get.volta.sh | bash
    export VOLTA_HOME="$HOME/.volta"
    export PATH="$VOLTA_HOME/bin:$PATH"
    volta install node@20
fi

# 3. Install PM2
npm install -g pm2

# 4. Clone Repo (if not exists)
if [ ! -d "$HOME/clawd-saas-core" ]; then
    echo "Cloning Core Repo..."
    git clone https://github.com/sebastjanm/clawd-saas-core.git "$HOME/clawd-saas-core"
else
    echo "Repo exists, pulling latest..."
    cd "$HOME/clawd-saas-core" && git pull
fi

cd "$HOME/clawd-saas-core"

# 5. Setup DB
if [ ! -f "db/pipeline.db" ]; then
    echo "Initializing Database..."
    mkdir -p db
    sqlite3 db/pipeline.db < db/schema.sql
fi

# 6. Install Dependencies & Build
echo "Installing dependencies..."
npm install
cd dashboard && npm install && npm run build && cd ..

# 7. Start Services
echo "Starting Services..."
# Router
pm2 start router/router.js --name saas-router --update-env
# Dashboard
cd dashboard
pm2 start npm --name "saas-dashboard" -- start -- -p 4000
pm2 save

echo "✅ Deployment Complete!"
echo "👉 Dashboard: http://$(curl -s ifconfig.me):4000"
