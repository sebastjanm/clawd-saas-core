'use client';

import { useState, useMemo } from 'react';
import { useUsage, type UsageFilters } from '../../hooks/useUsage';
import { AGENT_META } from '@/lib/types';
import { Card } from '@/shared/components/server/Card';
import { Spinner } from '@/shared/components/client/Spinner';
import type { AgentRun } from '@/lib/types';

const DAYS_OPTIONS = [
  { label: 'Today', value: 1 },
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
] as const;

const MODEL_COSTS: Record<string, { input: number; output: number; label: string }> = {
  opus: { input: 15, output: 75, label: 'Opus' },
  sonnet: { input: 3, output: 15, label: 'Sonnet' },
  haiku: { input: 0.25, output: 1.25, label: 'Haiku/Kimi' },
};

function getModelBucket(model?: string | null): string {
  const m = (model ?? '').toLowerCase();
  if (m.includes('opus')) return 'opus';
  if (m.includes('haiku') || m.includes('kimi')) return 'haiku';
  return 'sonnet';
}

function estimateRunCost(run: AgentRun): number {
  const input = run.tokens_in ?? 0;
  const output = run.tokens_out ?? 0;
  const bucket = getModelBucket(run.model);
  const costs = MODEL_COSTS[bucket] ?? MODEL_COSTS.sonnet;
  return (input / 1_000_000) * costs.input + (output / 1_000_000) * costs.output;
}

function costColor(cost: number): string {
  if (cost <= 0) return 'text-[var(--text-quaternary)]';
  if (cost < 0.01) return 'text-[var(--success)]';
  if (cost < 0.05) return 'text-[var(--warning)]';
  return 'text-[var(--error)]';
}

type SortKey = 'started_at' | 'duration_ms' | 'tokens_in' | 'tokens_out' | 'cost';
type SortDir = 'asc' | 'desc';

export function UsageDashboard() {
  const [filters, setFilters] = useState<UsageFilters>({
    agent: '',
    project: '',
    days: 7,
  });
  const [sortKey, setSortKey] = useState<SortKey>('started_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data, loading, error } = useUsage(filters);

  const agentNames = Object.keys(AGENT_META);
  const projects = data?.projects ?? [];

  const sortedRuns = useMemo(() => {
    if (!data?.runs) return [];
    return [...data.runs].sort((a, b) => {
      let av: number;
      let bv: number;
      switch (sortKey) {
        case 'started_at':
          return sortDir === 'desc'
            ? b.started_at.localeCompare(a.started_at)
            : a.started_at.localeCompare(b.started_at);
        case 'duration_ms':
          av = a.duration_ms ?? 0;
          bv = b.duration_ms ?? 0;
          break;
        case 'tokens_in':
          av = a.tokens_in ?? 0;
          bv = b.tokens_in ?? 0;
          break;
        case 'tokens_out':
          av = a.tokens_out ?? 0;
          bv = b.tokens_out ?? 0;
          break;
        case 'cost':
          av = estimateRunCost(a);
          bv = estimateRunCost(b);
          break;
        default:
          return 0;
      }
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [data?.runs, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortHeader({ label, field }: { label: string; field: SortKey }) {
    const active = sortKey === field;
    return (
      <th
        className="px-3 py-2.5 cursor-pointer select-none hover:text-[var(--text-tertiary)] transition-colors whitespace-nowrap"
        onClick={() => toggleSort(field)}
      >
        {label}{' '}
        <span className="text-[var(--text-faint)]">{active ? (sortDir === 'desc' ? '↓' : '↑') : ''}</span>
      </th>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="glass-static rounded-xl p-3 flex flex-wrap gap-3 items-center animate-fade-up">
        <select
          value={filters.agent}
          onChange={(e) => setFilters((f) => ({ ...f, agent: e.target.value }))}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)] min-h-[44px] focus:border-[var(--accent)]/40 focus:outline-none transition-colors"
        >
          <option value="">All agents</option>
          {agentNames.map((n) => (
            <option key={n} value={n}>
              {AGENT_META[n].emoji} {n}
            </option>
          ))}
        </select>

        <select
          value={filters.project}
          onChange={(e) => setFilters((f) => ({ ...f, project: e.target.value }))}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)] min-h-[44px] focus:border-[var(--accent)]/40 focus:outline-none transition-colors"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <div className="flex gap-1 ml-auto">
          {DAYS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilters((f) => ({ ...f, days: opt.value }))}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-all min-h-[44px] ${
                filters.days === opt.value
                  ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20'
                  : 'text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-up" style={{ animationDelay: '80ms' }}>
          <SummaryCard icon="📊" label="Total Runs" value={data.summary.totalRuns.toString()} />
          <SummaryCard icon="🔢" label="Total Tokens" value={formatTokens(data.summary.totalTokensIn + data.summary.totalTokensOut)} />
          <SummaryCard icon="💰" label="Est. Cost (period)" value={`$${data.summary.estimatedCost.toFixed(2)}`} />
          {data.periods && (
            <>
              <SummaryCard icon="📅" label="Today" value={`$${data.periods.today.cost.toFixed(2)}`} sub={`${data.periods.today.runs} runs`} />
              <SummaryCard icon="📆" label="This Week" value={`$${data.periods.week.cost.toFixed(2)}`} sub={`${data.periods.week.runs} runs`} />
              <SummaryCard icon="🗓️" label="This Month" value={`$${data.periods.month.cost.toFixed(2)}`} sub={`${data.periods.month.runs} runs`} />
            </>
          )}
          <SummaryCard
            icon="⏱"
            label="Avg Duration"
            value={
              data.summary.totalRuns > 0
                ? `${(data.summary.totalDurationMs / data.summary.totalRuns / 1000).toFixed(1)}s`
                : '—'
            }
          />
        </div>
      )}

      {/* Per-model cost breakdown */}
      {data?.modelCosts && data.modelCosts.length > 0 && (
        <div className="glass-static rounded-xl p-4 animate-fade-up" style={{ animationDelay: '120ms' }}>
          <p className="text-[var(--hig-caption1)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)] mb-3">Cost by Model</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.modelCosts.map((mc: { model: string; runs: number; tokens_in: number; tokens_out: number; duration_ms: number; estimatedCost: number }) => {
              const bucket = getModelBucket(mc.model);
              const meta = MODEL_COSTS[bucket] ?? MODEL_COSTS.sonnet;
              return (
                <div key={mc.model} className="flex items-center justify-between rounded-lg bg-[var(--surface)] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-secondary)]">{meta.label}</p>
                    <p className="text-xs text-[var(--text-quaternary)]">{mc.runs} runs · {formatTokens(mc.tokens_in + mc.tokens_out)} tokens</p>
                  </div>
                  <p className={`text-sm font-bold tabular-nums ${mc.estimatedCost > 1 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
                    ${mc.estimatedCost.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily cost trend */}
      {data?.trend && data.trend.length > 0 && (() => {
        // Fill in missing days so the chart has continuous bars
        const trendMap = new Map(data.trend.map((d: { day: string; cost: number; runs: number; tokens: number }) => [d.day, d]));
        const allDays: { day: string; cost: number; runs: number; tokens: number }[] = [];
        if (data.trend.length > 0) {
          const start = new Date(data.trend[0].day + 'T00:00:00Z');
          const end = new Date(data.trend[data.trend.length - 1].day + 'T00:00:00Z');
          for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
            const key = d.toISOString().slice(0, 10);
            allDays.push(trendMap.get(key) ?? { day: key, cost: 0, runs: 0, tokens: 0 });
          }
        }
        const maxCost = Math.max(...allDays.map(d => d.cost), 0.01);
        const BAR_AREA_H = 120;
        return (
          <div className="glass-static rounded-xl p-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <p className="text-[var(--hig-caption1)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)] mb-3">Daily Spend</p>
            <div className="flex items-end gap-1.5" style={{ height: BAR_AREA_H + 24 }}>
              {allDays.map((d) => {
                const barH = d.cost > 0 ? Math.max((d.cost / maxCost) * BAR_AREA_H, 4) : 2;
                const label = d.day.slice(5); // MM-DD
                return (
                  <div key={d.day} className="flex flex-col items-center justify-end flex-1 min-w-0 group relative" style={{ height: BAR_AREA_H + 24 }}>
                    {/* Tooltip */}
                    {d.cost > 0 && (
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs whitespace-nowrap z-10 pointer-events-none">
                        <span className="font-medium">${d.cost.toFixed(2)}</span> · {d.runs} runs · {formatTokens(d.tokens)} tok
                      </div>
                    )}
                    {/* Cost label above bar */}
                    {d.cost > 0 && (
                      <span className="text-[10px] font-medium text-[var(--text-tertiary)] mb-0.5">${d.cost < 1 ? d.cost.toFixed(2) : d.cost.toFixed(0)}</span>
                    )}
                    {/* Bar */}
                    <div
                      className={`w-full rounded-t transition-all ${d.cost > 0 ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                      style={{ height: barH, opacity: d.cost > 0 ? 0.7 + (d.cost / maxCost) * 0.3 : 0.3 }}
                    />
                    {/* Day label */}
                    <span className="text-[10px] text-[var(--text-quaternary)] mt-1 truncate w-full text-center">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Per-agent cost breakdown */}
      {data?.agentCosts && data.agentCosts.length > 0 && (
        <div className="glass-static rounded-xl p-4 animate-fade-up" style={{ animationDelay: '140ms' }}>
          <p className="text-[var(--hig-caption1)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)] mb-3">Cost by Agent</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.agentCosts.map((ac: { agent: string; runs: number; tokens_in: number; tokens_out: number; duration_ms: number; estimatedCost: number }) => {
              const meta = AGENT_META[ac.agent] ?? { emoji: '🤖', name: ac.agent };
              return (
                <div key={ac.agent} className="flex items-center justify-between rounded-lg bg-[var(--surface)] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-secondary)]">
                      {meta.emoji} {ac.agent.charAt(0).toUpperCase() + ac.agent.slice(1)}
                    </p>
                    <p className="text-xs text-[var(--text-quaternary)]">{ac.runs} runs · {formatTokens(ac.tokens_in + ac.tokens_out)} tokens</p>
                  </div>
                  <p className={`text-sm font-bold tabular-nums ${ac.estimatedCost > 1 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
                    ${ac.estimatedCost.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-project cost breakdown */}
      {data?.projectCosts && data.projectCosts.length > 0 && (
        <div className="glass-static rounded-xl p-4 animate-fade-up" style={{ animationDelay: '160ms' }}>
          <p className="text-[var(--hig-caption1)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)] mb-3">Cost by Project</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.projectCosts.map((pc: { project: string; runs: number; tokens_in: number; tokens_out: number; duration_ms: number; estimatedCost: number }) => {
              const displayProject = pc.project.length > 20 ? pc.project.slice(0, 18) + '...' : pc.project;
              return (
                <div key={pc.project} className="flex items-center justify-between rounded-lg bg-[var(--surface)] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-secondary)]" title={pc.project}>{displayProject}</p>
                    <p className="text-xs text-[var(--text-quaternary)]">{pc.runs} runs · {formatTokens(pc.tokens_in + pc.tokens_out)} tokens</p>
                  </div>
                  <p className={`text-sm font-bold tabular-nums ${pc.estimatedCost > 1 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
                    ${pc.estimatedCost.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data?.coverage?.firstRunAt && (
        <div className="glass-static rounded-xl p-3 text-xs text-[var(--text-quaternary)] animate-fade-up" style={{ animationDelay: '100ms' }}>
          Coverage: {formatDate(data.coverage.firstRunAt)} → {data.coverage.lastRunAt ? formatDate(data.coverage.lastRunAt) : 'now'} · total logged runs: {data.coverage.totalRows}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      )}

      {error && (
        <Card>
          <p className="text-sm text-[var(--error)]">Failed to load usage: {error}</p>
        </Card>
      )}

      {data && sortedRuns.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm text-[var(--text-quaternary)]">No runs recorded yet</p>
            <p className="text-xs text-[var(--text-faint)] mt-1">Agent runs will appear here as they execute</p>
          </div>
        </Card>
      )}

      {data && sortedRuns.length > 0 && (
        <div className="glass-static rounded-xl overflow-hidden p-0 animate-fade-up" style={{ animationDelay: '160ms' }}>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--hig-subhead)] font-semibold uppercase tracking-wider text-[var(--text-quaternary)]">
                    <SortHeader label="Time (CET/CEST)" field="started_at" />
                    <th className="px-3 py-2.5">Agent</th>
                    <th className="px-3 py-2.5">Model</th>
                    <th className="px-3 py-2.5">Status</th>
                    <SortHeader label="Duration" field="duration_ms" />
                    <SortHeader label="Tokens In" field="tokens_in" />
                    <SortHeader label="Tokens Out" field="tokens_out" />
                    <SortHeader label="Est. Cost" field="cost" />
                    <th className="px-3 py-2.5">Task</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRuns.map((run, i) => {
                    const meta = AGENT_META[run.agent_name];
                    const cost = estimateRunCost(run);
                    const statusColor: Record<string, string> = {
                      ok: 'text-[var(--success)]',
                      running: 'text-[var(--accent)]',
                      error: 'text-[var(--error)]',
                      timeout: 'text-[var(--warning)]',
                      killed: 'text-[var(--text-quaternary)]',
                    };
                    return (
                      <tr
                        key={run.id}
                        className={`border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface)] ${
                          i % 2 === 1 ? 'bg-[var(--surface-alt)]' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 tabular-nums text-[var(--text-tertiary)] whitespace-nowrap text-xs">
                          {formatDate(run.started_at)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="text-sm">{meta?.emoji ?? '❓'}</span>
                          <span className="ml-1.5 text-xs font-medium capitalize text-[var(--text-secondary)]">
                            {run.agent_name}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[var(--text-quaternary)] whitespace-nowrap">
                          {run.model ? getModelBucket(run.model).charAt(0).toUpperCase() + getModelBucket(run.model).slice(1) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-medium ${statusColor[run.status] ?? 'text-[var(--text-quaternary)]'}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-[var(--text-quaternary)] text-xs">
                          {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-[var(--text-quaternary)] text-xs">
                          {run.tokens_in ? run.tokens_in.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-[var(--text-quaternary)] text-xs">
                          {run.tokens_out ? run.tokens_out.toLocaleString() : '—'}
                        </td>
                        <td className={`px-3 py-2.5 tabular-nums text-xs ${costColor(cost)}`}>
                          {cost > 0 ? `$${cost.toFixed(4)}` : '—'}
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-[var(--text-quaternary)]">
                          {run.task_summary ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="glass-static rounded-xl p-4 flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-lg font-bold tabular-nums text-[var(--text-primary)] leading-tight">{value}</p>
        <p className="text-[var(--hig-caption1)] font-medium uppercase tracking-wider text-[var(--text-quaternary)] mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-[var(--text-quaternary)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'Z');
  return new Intl.DateTimeFormat('sl-SI', {
    timeZone: 'Europe/Ljubljana',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d).replace(',', '');
}
