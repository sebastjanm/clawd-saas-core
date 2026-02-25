'use client';

import { useState } from 'react';
import { triggerAgent } from '../../actions';
import type { AgentStatus } from '@/lib/types';

interface FreelancerPanelProps {
  agent: AgentStatus;
}

export function FreelancerPanel({ agent }: FreelancerPanelProps) {
  const [triggering, setTriggering] = useState(false);

  async function handleTrigger() {
    setTriggering(true);
    try {
      await triggerAgent(agent.name);
    } catch {
      // handled
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="glass-static flex items-center justify-between rounded-xl p-4">
      <div className="flex items-center gap-3">
        <span className="text-xl">{agent.emoji}</span>
        <div>
          <span className="text-sm font-semibold capitalize text-[var(--text-primary)]">{agent.name}</span>
          <p className="text-[var(--hig-subhead)] text-[var(--text-tertiary)]">{agent.role}</p>
        </div>
      </div>
      <button
        onClick={handleTrigger}
        disabled={triggering}
        className="rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-strong)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-all min-h-[36px]"
      >
        {triggering ? '⏳ Running…' : '▶ Trigger'}
      </button>
    </div>
  );
}
