# Customer Setup — API Keys & Configuration

## Getting an API Key

### Anthropic (recommended)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to **API Keys** in the left sidebar
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-`)

### OpenAI

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to **API Keys** in the left sidebar
4. Click **Create new secret key**
5. Copy the key (starts with `sk-`)

## Expected Costs

For moderate content volume (2-3 articles/day):
- **Anthropic:** $20-50/month depending on article length and agent usage
- **OpenAI:** $20-50/month depending on model selection

Costs depend on:
- Number of articles per day
- Article length (word count targets)
- Number of active agents (writer, editor, publisher, etc.)
- Model tier (Haiku/GPT-4o-mini for simple tasks, Sonnet/GPT-4o for writing)

## What the Key Is Used For

Your API key powers the AI agents that run your content pipeline:
- **Liso** (topic selector) — picks the next article to write
- **Pino** (writer) — drafts articles based on your config
- **Rada** (editor) — reviews and polishes drafts
- **Zala** (designer) — converts markdown to publish-ready HTML
- **Lana** (publisher) — handles final publication
- **Bea** (social) — creates social media posts
- **Vuk** (strategist) — suggests new topics

The key is stored locally on your VPS in `~/.openclaw/openclaw.json` and is never sent to EasyAI servers.

## How to Rotate Your Key

1. Generate a new key on your provider's console
2. Edit the config file:
   ```bash
   nano ~/.openclaw/openclaw.json
   ```
3. Replace the `providerApiKey` value with your new key
4. Restart the gateway:
   ```bash
   openclaw gateway restart
   ```
5. Revoke the old key on your provider's console

## Troubleshooting

### Key Invalid / Authentication Error

- Verify the key starts with the correct prefix (`sk-ant-` for Anthropic, `sk-` for OpenAI)
- Check that the key hasn't been revoked on the provider console
- Ensure you have billing set up on your provider account
- Check the config file: `cat ~/.openclaw/openclaw.json`

### Gateway Not Responding

```bash
# Check gateway status
curl http://127.0.0.1:18789

# Restart gateway
openclaw gateway restart

# Check logs
openclaw gateway logs
```

### Pipeline Not Running

```bash
# Check PM2 services
pm2 status

# Check router health
curl http://127.0.0.1:4001/pipeline/health

# Restart everything
pm2 restart saas-router saas-dashboard
openclaw gateway restart
```

### Full Verification

Run the verification script:
```bash
./scripts/verify-install.sh
```
