import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

// No auth required — only returns a boolean, no sensitive data
export async function GET() {
  try {
    const configPath = path.join(process.env.HOME || '/root', '.openclaw', 'openclaw.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as { env?: Record<string, string> };
    const env = config.env ?? {};

    const hasKey =
      !!env.ANTHROPIC_API_KEY?.trim() || !!env.OPENAI_API_KEY?.trim();

    return NextResponse.json({ needsSetup: !hasKey });
  } catch {
    // Config missing or unreadable → assume setup needed
    return NextResponse.json({ needsSetup: true });
  }
}
