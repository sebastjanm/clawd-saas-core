import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse, ValidationError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const CONFIG_PATH = path.join(process.env.HOME || '/root', '.openclaw', 'openclaw.json');

type OpenClawConfig = {
  env?: Record<string, string>;
  models?: {
    providers?: Record<string, unknown>;
    [key: string]: unknown;
  };
  agents?: {
    defaults?: {
      model?: {
        primary?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function readConfig(): OpenClawConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfig(config: OpenClawConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function maskKey(key: string): string {
  if (!key || key.length < 12) return '***';
  const prefix = key.slice(0, key.indexOf('-', 4) + 1 || 7);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

function restartGateway(): void {
  try {
    execSync('openclaw gateway restart', { timeout: 15000 });
  } catch {
    // Non-fatal — config is written, gateway may restart later
    console.warn('[api-keys] Gateway restart failed (non-fatal)');
  }
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const config = readConfig();
    const env = config.env ?? {};

    const providers: Array<{
      provider: string;
      configured: boolean;
      maskedKey?: string;
    }> = [
      {
        provider: 'anthropic',
        configured: !!env.ANTHROPIC_API_KEY,
        maskedKey: env.ANTHROPIC_API_KEY ? maskKey(env.ANTHROPIC_API_KEY) : undefined,
      },
      {
        provider: 'openai',
        configured: !!env.OPENAI_API_KEY,
        maskedKey: env.OPENAI_API_KEY ? maskKey(env.OPENAI_API_KEY) : undefined,
      },
    ];

    return NextResponse.json({ providers });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const { provider, apiKey, model } = body as {
      provider: string;
      apiKey: string;
      model?: string;
    };

    if (!provider || !apiKey) {
      throw new ValidationError('provider and apiKey are required');
    }

    // Validate key format
    if (provider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
      throw new ValidationError('Anthropic keys must start with sk-ant-');
    }
    if (provider === 'openai' && !apiKey.startsWith('sk-')) {
      throw new ValidationError('OpenAI keys must start with sk-');
    }
    if (provider !== 'anthropic' && provider !== 'openai') {
      throw new ValidationError('provider must be "anthropic" or "openai"');
    }

    const config = readConfig();

    // Ensure nested objects exist
    if (!config.env) config.env = {};
    if (!config.models) config.models = {};
    if (!config.models.providers) config.models.providers = {};

    // Set the API key in env
    if (provider === 'anthropic') {
      config.env.ANTHROPIC_API_KEY = apiKey;
      config.models.providers.anthropic = {
        ...(config.models.providers.anthropic as Record<string, unknown> ?? {}),
        apiKey: '${env.ANTHROPIC_API_KEY}',
      };
    } else {
      config.env.OPENAI_API_KEY = apiKey;
      config.models.providers.openai = {
        ...(config.models.providers.openai as Record<string, unknown> ?? {}),
        apiKey: '${env.OPENAI_API_KEY}',
      };
    }

    // Update default model if provided
    if (model) {
      if (!config.agents) config.agents = {};
      if (!config.agents.defaults) config.agents.defaults = {};
      if (!config.agents.defaults.model) config.agents.defaults.model = {};
      config.agents.defaults.model.primary = model;
    }

    writeConfig(config);
    restartGateway();

    return NextResponse.json({ ok: true, provider });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const { provider } = body as { provider: string };

    if (!provider) {
      throw new ValidationError('provider is required');
    }

    const config = readConfig();

    if (provider === 'anthropic') {
      delete config.env?.ANTHROPIC_API_KEY;
      if (config.models?.providers) {
        delete (config.models.providers as Record<string, unknown>).anthropic;
      }
    } else if (provider === 'openai') {
      delete config.env?.OPENAI_API_KEY;
      if (config.models?.providers) {
        delete (config.models.providers as Record<string, unknown>).openai;
      }
    } else {
      throw new ValidationError('provider must be "anthropic" or "openai"');
    }

    writeConfig(config);
    restartGateway();

    return NextResponse.json({ ok: true, provider });
  } catch (error) {
    return errorResponse(error);
  }
}
