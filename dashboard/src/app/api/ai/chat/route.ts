/**
 * /api/ai/chat — Multi-model AI chat
 *
 * Architecture:
 * - Provider list + credentials: read from ~/.openclaw/openclaw.json (single source of truth)
 * - System prompt: read from webchat agent's SOUL.md
 * - LLM calls: direct to provider APIs (OpenAI-compatible format)
 * - Anthropic: uses its own message format (system separate, no system role in messages)
 * - Conversation history: stored in pipeline.db (ai_messages table)
 *
 * Why not the OpenClaw gateway?
 * The gateway's /v1/chat/completions always runs through an agent codepath
 * (loads workspace, injects AGENTS.md/SOUL.md, uses agent's pinned model).
 * It doesn't support per-request model selection. For a multi-model chat UI,
 * direct provider calls with OpenClaw-managed credentials is the right pattern.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse } from '@/lib/errors';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DB_PATH = process.env.PIPELINE_DB || '/home/clawdbot/clawd-saas-core/db/pipeline.db';
const OPENCLAW_HOME = join(process.env.HOME || '/home/clawdbot', '.openclaw');
const WEBCHAT_WORKSPACE = process.env.SAAS_CORE_DIR || '/home/clawdbot/clawd-saas-core/agents/webchat';

// ── Provider definitions ──
// Each provider needs: API URL, how to find its key in openclaw.json, and how to format requests.
// All except Anthropic use OpenAI-compatible format.

interface Provider {
  name: string;
  url: string;
  openclawId: string;        // provider ID in openclaw.json models allowlist
  headers: (key: string) => Record<string, string>;
  isAnthropic?: boolean;     // Anthropic needs special message format
}

const PROVIDERS: Record<string, Provider> = {
  anthropic: {
    name: 'Claude',
    url: 'https://api.anthropic.com/v1/messages',
    openclawId: 'anthropic',
    headers: (key) => ({ 'x-api-key': key, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' }),
    isAnthropic: true,
  },
  gemini: {
    name: 'Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    openclawId: 'google',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  openai: {
    name: 'ChatGPT',
    url: 'https://api.openai.com/v1/chat/completions',
    openclawId: 'openai-codex',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  deepseek: {
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/chat/completions',
    openclawId: 'deepseek',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  moonshot: {
    name: 'Kimi',
    url: 'https://api.moonshot.ai/v1/chat/completions',
    openclawId: 'moonshot',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  dashscope: {
    name: 'Qwen',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    openclawId: 'dashscope',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
};

// ── Config cache ──

let configCache: { data: any; readAt: number } | null = null;
let soulCache: { content: string; readAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

function readOpenClawConfig() {
  if (configCache && Date.now() - configCache.readAt < CACHE_TTL) {
    return configCache.data;
  }
  const raw = readFileSync(join(OPENCLAW_HOME, 'openclaw.json'), 'utf-8');
  const data = JSON.parse(raw);
  configCache = { data, readAt: Date.now() };
  return data;
}

function getSystemPrompt(): string {
  if (soulCache && Date.now() - soulCache.readAt < CACHE_TTL) {
    return soulCache.content;
  }
  try {
    const soul = readFileSync(join(WEBCHAT_WORKSPACE, 'SOUL.md'), 'utf-8').trim();
    soulCache = { content: soul, readAt: Date.now() };
    return soul;
  } catch {
    return 'You are a helpful AI assistant. Be concise and direct.';
  }
}

// ── Credential lookup ──
// Reads API keys from OpenClaw auth profiles (the same keys OpenClaw uses)

function getApiKey(openclawProviderId: string): string | null {
  try {
    // Check auth profiles for each registered agent (main has all keys)
    // Prefer token profiles over api_key profiles (tokens are subscription-based, no credit limits)
    const profilePath = join(OPENCLAW_HOME, 'agents', 'main', 'agent', 'auth-profiles.json');
    const data = JSON.parse(readFileSync(profilePath, 'utf-8'));
    const profiles = data.profiles || {};

    let apiKeyFallback: string | null = null;

    for (const [, profile] of Object.entries(profiles) as [string, any][]) {
      if (profile.provider !== openclawProviderId) continue;

      // Token profiles (subscription) take priority
      if (profile.type === 'token' && profile.token) {
        return profile.token;
      }
      // OAuth tokens
      if (profile.type === 'oauth' && profile.accessToken) {
        return profile.accessToken;
      }
      // API key as fallback
      if (profile.type === 'api_key' && profile.key) {
        apiKeyFallback = profile.key;
      }
    }

    if (apiKeyFallback) return apiKeyFallback;
  } catch { /* fall through */ }

  // Fallback 2: models.json (OpenClaw stores some keys here)
  try {
    const modelsPath = join(OPENCLAW_HOME, 'agents', 'main', 'agent', 'models.json');
    const modelsData = JSON.parse(readFileSync(modelsPath, 'utf-8'));
    const providers = modelsData.providers || {};
    if (providers[openclawProviderId]?.apiKey) {
      return providers[openclawProviderId].apiKey;
    }
  } catch { /* fall through */ }

  // Fallback: check env vars
  const envMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GEMINI_API_KEY',
    'openai-codex': 'OPENAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    moonshot: 'MOONSHOT_API_KEY',
    dashscope: 'DASHSCOPE_API_KEY',
  };
  return process.env[envMap[openclawProviderId] || ''] || null;
}

// ── Provider list (from OpenClaw allowlist) ──

const REVERSE_PROVIDER_MAP: Record<string, string> = {
  'openai-codex': 'openai',
  'google': 'gemini',
};

function buildProviderList() {
  const config = readOpenClawConfig();
  const agentDefaults = config?.agents?.defaults || {};
  const modelsAllowlist = agentDefaults.models || {};
  const modelConfig = agentDefaults.model || {};
  const primary = modelConfig.primary || '';

  const providers: Record<string, any> = {};

  for (const [modelRef, meta] of Object.entries(modelsAllowlist) as [string, any][]) {
    const slash = modelRef.indexOf('/');
    const rawProvider = slash > 0 ? modelRef.substring(0, slash) : modelRef;
    const modelId = slash > 0 ? modelRef.substring(slash + 1) : modelRef;
    const dashboardId = REVERSE_PROVIDER_MAP[rawProvider] || rawProvider;

    // Only include providers we have keys for
    // Skip suspended/disabled providers
    const HIDDEN_PROVIDERS = ['moonshot', 'dashscope'];
    if (HIDDEN_PROVIDERS.includes(dashboardId)) continue;

    const providerDef = PROVIDERS[dashboardId];
    if (!providerDef) continue;
    const hasKey = !!getApiKey(providerDef.openclawId);

    if (!providers[dashboardId]) {
      providers[dashboardId] = {
        name: providerDef.name,
        models: [],
        defaultModel: modelId,
        available: hasKey,
        aliases: {},
      };
    }

    providers[dashboardId].models.push(modelId);
    if (meta?.alias) {
      providers[dashboardId].aliases[modelId] = meta.alias;
    }
  }

  // Set primary provider's default model
  if (primary) {
    const slash = primary.indexOf('/');
    const rawProvider = slash > 0 ? primary.substring(0, slash) : primary;
    const modelId = slash > 0 ? primary.substring(slash + 1) : primary;
    const dashboardId = REVERSE_PROVIDER_MAP[rawProvider] || rawProvider;
    if (providers[dashboardId]) {
      providers[dashboardId].defaultModel = modelId;
    }
  }

  return providers;
}

// ── Database ──

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      conversation_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  return db;
}

// ── GET: providers + messages + conversations ──

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversation') || 'default';

    const db = getDb();
    const messages = db.prepare(
      'SELECT id, role, content, provider, model, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 50'
    ).all(conversationId).reverse();

    const conversations = db.prepare(`
      SELECT 
        conversation_id,
        MIN(created_at) as started_at,
        MAX(created_at) as last_message_at,
        COUNT(*) as message_count,
        (SELECT content FROM ai_messages m2 WHERE m2.conversation_id = m1.conversation_id AND m2.role = 'user' ORDER BY m2.id ASC LIMIT 1) as preview
      FROM ai_messages m1
      GROUP BY conversation_id
      ORDER BY MAX(created_at) DESC
    `).all();

    const providers = buildProviderList();
    db.close();

    return NextResponse.json({ messages, providers, conversations });
  } catch (err) {
    return errorResponse(err);
  }
}

// ── DELETE: remove conversation ──

export async function DELETE(request: Request) {
  try {
    await requireAuth(request);
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversation') || 'default';
    const db = getDb();
    db.prepare('DELETE FROM ai_messages WHERE conversation_id = ?').run(conversationId);
    db.close();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

// ── POST: send message, stream response ──

export async function POST(request: Request) {
  try {
    await requireAuth(request);

    const { message, provider: providerId = 'anthropic', model: modelOverride, conversationId = 'default' } = await request.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const provider = PROVIDERS[providerId];
    if (!provider) {
      return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 });
    }

    const apiKey = getApiKey(provider.openclawId);
    if (!apiKey) {
      return NextResponse.json({ error: `No API key for ${provider.name}. Check OpenClaw auth profiles.` }, { status: 503 });
    }

    // Get default model from OpenClaw config if not specified
    let model = modelOverride;
    if (!model) {
      const providerList = buildProviderList();
      model = providerList[providerId]?.defaultModel || providerList[providerId]?.models?.[0] || 'auto';
    }
    const systemPrompt = getSystemPrompt();
    const db = getDb();

    // Save user message
    db.prepare('INSERT INTO ai_messages (role, content, provider, model, conversation_id) VALUES (?, ?, ?, ?, ?)').run(
      'user', message.trim(), providerId, model, conversationId
    );

    // Build conversation context (last 20 messages)
    const history = db.prepare(
      'SELECT role, content FROM ai_messages WHERE conversation_id = ? AND role IN (\'user\', \'assistant\') ORDER BY id DESC LIMIT 20'
    ).all(conversationId).reverse() as { role: string; content: string }[];

    // Stream response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let body: Record<string, unknown>;

          if (provider.isAnthropic) {
            // Anthropic: system is a top-level field, not in messages
            body = {
              model,
              max_tokens: 4096,
              system: systemPrompt,
              messages: history,
              stream: true,
            };
          } else {
            // OpenAI-compatible (Gemini, DeepSeek, Moonshot, OpenAI)
            body = {
              model,
              messages: [{ role: 'system', content: systemPrompt }, ...history],
              stream: true,
            };
          }

          const res = await fetch(provider.url, {
            method: 'POST',
            headers: provider.headers(apiKey),
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const errorText = await res.text();
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: `${provider.name} error: ${res.status} ${errorText.slice(0, 200)}`, done: true })}\n\n`));
            controller.close();
            return;
          }

          const reader = res.body?.getReader();
          if (!reader) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: 'No response stream', done: true })}\n\n`));
            controller.close();
            return;
          }

          const decoder = new TextDecoder();
          let fullReply = '';
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                let content = '';

                if (provider.isAnthropic) {
                  // Anthropic stream format
                  if (parsed.type === 'content_block_delta') {
                    content = parsed.delta?.text || '';
                  }
                } else {
                  // OpenAI stream format
                  content = parsed.choices?.[0]?.delta?.content || '';
                }

                if (content) {
                  fullReply += content;
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content, done: false })}\n\n`));
                }
              } catch { /* skip */ }
            }
          }

          // Save assistant reply
          if (fullReply) {
            const saveDb = getDb();
            saveDb.prepare('INSERT INTO ai_messages (role, content, provider, model, conversation_id) VALUES (?, ?, ?, ?, ?)').run(
              'assistant', fullReply, providerId, model, conversationId
            );
            saveDb.close();
          }

          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`));
          controller.close();
        } catch (err: any) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content: `Error: ${err.message}`, done: true })}\n\n`));
          controller.close();
        }
      },
    });

    db.close();

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
