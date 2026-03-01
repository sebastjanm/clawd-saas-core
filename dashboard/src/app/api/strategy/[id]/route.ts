import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { errorResponse, NotFoundError, ValidationError } from '@/lib/errors';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

const PROJECTS_DIR = '/home/clawdbot/clawd/content-pipeline/projects';

function applyDecision(decision: any) {
  const configPath = join(PROJECTS_DIR, `${decision.project}.json`);

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));

    switch (decision.decision_type) {
      case 'kill_pillar': {
        if (config.writing?.pillars) {
          config.writing.pillars = config.writing.pillars.filter(
            (p: string) => !p.toLowerCase().includes(decision.target.toLowerCase()),
          );
        }
        break;
      }
      case 'boost_pillar':
      case 'add_pillar': {
        if (!config.writing) config.writing = {};
        if (!config.writing.pillars) config.writing.pillars = [];
        if (!config.writing.pillars.some((p: string) => p.toLowerCase().includes(decision.target.toLowerCase()))) {
          config.writing.pillars.unshift(decision.target);
        }
        break;
      }
      case 'avoid_topic': {
        if (!config.writing) config.writing = {};
        if (!config.writing.avoid_topics) config.writing.avoid_topics = [];
        if (!config.writing.avoid_topics.includes(decision.target)) {
          config.writing.avoid_topics.push(decision.target);
        }
        break;
      }
      case 'scale_up':
      case 'scale_down': {
        const newLimit = parseInt(decision.target, 10);
        if (!isNaN(newLimit) && newLimit > 0 && newLimit <= 10) {
          const db = getDb();
          db.prepare('UPDATE project_settings SET daily_limit = ? WHERE project = ?').run(
            newLimit,
            decision.project,
          );
        }
        break;
      }
      case 'content_mix':
      case 'platform_focus':
      case 'custom': {
        // These are informational — update a strategy_notes field
        if (!config.strategy) config.strategy = {};
        if (!config.strategy.notes) config.strategy.notes = [];
        config.strategy.notes.unshift({
          type: decision.decision_type,
          target: decision.target,
          reason: decision.reason,
          date: new Date().toISOString().slice(0, 10),
        });
        // Keep last 20 notes
        config.strategy.notes = config.strategy.notes.slice(0, 20);
        break;
      }
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to apply decision:', err);
    return false;
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = (await request.json()) as { action: 'approve' | 'reject' };

    if (!['approve', 'reject'].includes(body.action)) {
      throw new ValidationError('action must be approve or reject');
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM strategy_decisions WHERE id = ?').get(Number(id)) as any;
    if (!existing) throw new NotFoundError('Strategy decision');

    if (existing.status !== 'pending') {
      throw new ValidationError(`Decision already ${existing.status}`);
    }

    if (body.action === 'reject') {
      db.prepare("UPDATE strategy_decisions SET status = 'rejected' WHERE id = ?").run(Number(id));
      return NextResponse.json({ status: 'rejected' });
    }

    // Approve: mark approved, then apply
    db.prepare("UPDATE strategy_decisions SET status = 'approved', approved_at = datetime('now') WHERE id = ?").run(Number(id));

    const applied = applyDecision(existing);
    if (applied) {
      db.prepare("UPDATE strategy_decisions SET status = 'applied', applied_at = datetime('now') WHERE id = ?").run(Number(id));
    }

    return NextResponse.json({ status: applied ? 'applied' : 'approved', applied });
  } catch (error) {
    return errorResponse(error);
  }
}
