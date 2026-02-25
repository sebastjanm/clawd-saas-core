'use client';

import { useState } from 'react';
import { triggerAgent } from '../../actions';

interface AgentTriggerButtonProps {
  agentName: string;
}

export function AgentTriggerButton({ agentName }: AgentTriggerButtonProps) {
  const [triggering, setTriggering] = useState(false);
  const [result, setResult] = useState<'ok' | 'error' | null>(null);

  async function handleTrigger() {
    setTriggering(true);
    setResult(null);
    try {
      await triggerAgent(agentName);
      setResult('ok');
    } catch {
      setResult('error');
    } finally {
      setTriggering(false);
      setTimeout(() => setResult(null), 3000);
    }
  }

  return (
    <button
      onClick={handleTrigger}
      disabled={triggering}
      className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 min-h-[44px] border ${
        result === 'ok'
          ? 'bg-[var(--success)]/10 border-[var(--success)]/20 text-[var(--success)]'
          : result === 'error'
            ? 'bg-[var(--error)]/10 border-[var(--error)]/20 text-[var(--error)]'
            : 'bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-strong)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
      } disabled:opacity-40`}
    >
      {triggering ? '⏳ Running…' : result === 'ok' ? '✓ Triggered' : result === 'error' ? '✗ Failed' : '▶ Trigger'}
    </button>
  );
}
