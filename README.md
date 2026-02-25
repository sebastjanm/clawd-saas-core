# 🏭 Clawd SaaS Core

The engine behind **EasyAI Start** and other AI Content Factories.
Designed for multi-tenant SaaS deployment.

## 🚀 Quick Start

1. **Clone & Install**
   ```bash
   git clone https://github.com/sebastjanm/clawd-saas-core.git
   cd clawd-saas-core
   npm install
   ```

2. **Initialize DB**
   ```bash
   sqlite3 db/pipeline.db < db/schema.sql
   ```

3. **Start Everything**
   ```bash
   pm2 start ecosystem.config.cjs
   # OR manually:
   # 1. Router
   PROJECTS_DIR=$PWD/projects PIPELINE_DB=$PWD/db/pipeline.db pm2 start router/router.js --name saas-router
   # 2. Dashboard
   cd dashboard && npm run build
   PIPELINE_DB_PATH=../db/pipeline.db PIPELINE_ROUTER_URL=http://localhost:4001 pm2 start npm --name "saas-dashboard" -- start -- -p 4000
   ```

## 🛠️ Management

### Add New Client (Project)
```bash
cd engine/scripts
node add-project.js "Client Name" "lang_code" "tone_description"
# Example: node add-project.js "Mizarstvo Hrast" sl "domače, strokovno"
```
**After adding:** Edit `projects/mizarstvo-hrast.json` to fill in VAT ID, Contact Email, and API keys.

### Worker Architecture
- **Engine:** `engine/agents/` (Pino, Rada, Vuk...) - Config-aware agents.
- **Router:** `router/` (Port 4001) - Event-driven orchestration.
- **DB:** `db/pipeline.db` (SQLite) - Isolated per VPS/Instance.
- **Dashboard:** `dashboard/` (Port 4000) - Next.js client portal.

## 🔐 Security
- API Auth is DISABLED by default in this demo/template.
- For production, set `DASHBOARD_TOKEN` in `.env` and uncomment `requireAuth` in `dashboard/src/app/api/**/*.ts`.

## 📦 Deployment
This repo is designed to be a "Master Image" template.
One VPS = One Tenant (or use `project_id` for multi-tenant on one big DB).
