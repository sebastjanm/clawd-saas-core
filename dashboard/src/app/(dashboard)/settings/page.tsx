'use client';

import { useEffect, useState, useCallback } from 'react';

type ProviderInfo = {
  provider: string;
  configured: boolean;
  maskedKey?: string;
};

type ApiKeysResponse = {
  providers: ProviderInfo[];
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

const PROVIDER_HINTS: Record<string, string> = {
  anthropic: 'Starts with sk-ant-',
  openai: 'Starts with sk-',
};

const ANTHROPIC_MODELS = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
];

const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
];

function StatusDot({ configured }: { configured: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${
        configured ? 'bg-[var(--success,#22c55e)]' : 'bg-[var(--text-quaternary)]'
      }`}
    />
  );
}

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formProvider, setFormProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [formKey, setFormKey] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formStatus, setFormStatus] = useState<'idle' | 'verifying' | 'saving' | 'success' | 'error'>('idle');
  const [formError, setFormError] = useState('');

  // Remove confirmation
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/api-keys');
      if (res.ok) {
        const data: ApiKeysResponse = await res.json();
        setProviders(data.providers);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const modelOptions = formProvider === 'anthropic' ? ANTHROPIC_MODELS : OPENAI_MODELS;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormStatus('verifying');

    // Step 1: Verify
    try {
      const verifyRes = await fetch('/api/settings/api-keys/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: formProvider, apiKey: formKey }),
      });
      const verifyData = await verifyRes.json() as { valid: boolean; error?: string };

      if (!verifyData.valid) {
        setFormStatus('error');
        setFormError(verifyData.error ?? 'Key verification failed');
        return;
      }
    } catch {
      setFormStatus('error');
      setFormError('Could not reach verification endpoint');
      return;
    }

    // Step 2: Save
    setFormStatus('saving');
    try {
      const saveRes = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: formProvider,
          apiKey: formKey,
          model: formModel || undefined,
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json() as { error?: string };
        setFormStatus('error');
        setFormError(data.error ?? 'Failed to save key');
        return;
      }

      setFormStatus('success');
      setFormKey('');
      setFormModel('');
      setShowForm(false);
      setFormStatus('idle');
      await fetchProviders();
    } catch {
      setFormStatus('error');
      setFormError('Save request failed');
    }
  }

  async function handleRemove(provider: string) {
    setRemoving(true);
    try {
      await fetch('/api/settings/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      setConfirmRemove(null);
      await fetchProviders();
    } finally {
      setRemoving(false);
    }
  }

  const configuredProviders = providers.filter((p) => p.configured);
  const unconfiguredProviders = providers.filter((p) => !p.configured);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚙️</span>
        <div>
          <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Settings</h2>
          <p className="text-xs text-[var(--text-tertiary)]">API keys and system configuration</p>
        </div>
      </div>

      {/* API Keys section */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary,var(--surface))] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">API Keys</h3>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Connect AI providers to power your agents
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => {
                setShowForm(true);
                setFormStatus('idle');
                setFormError('');
                setFormKey('');
                // Default to first unconfigured provider, or anthropic
                const next = unconfiguredProviders[0]?.provider as 'anthropic' | 'openai' | undefined;
                setFormProvider(next ?? 'anthropic');
                setFormModel('');
              }}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              <span>+</span>
              Add Provider
            </button>
          )}
        </div>

        {/* Configured providers */}
        {loading ? (
          <div className="px-5 py-8 text-center text-xs text-[var(--text-quaternary)]">
            Loading…
          </div>
        ) : configuredProviders.length === 0 && !showForm ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">No API keys configured yet.</p>
            <p className="text-xs text-[var(--text-quaternary)] mt-1">Add a provider to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {configuredProviders.map((p) => (
              <li key={p.provider} className="flex items-center gap-4 px-5 py-4">
                <StatusDot configured={p.configured} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {PROVIDER_LABELS[p.provider] ?? p.provider}
                  </p>
                  {p.maskedKey && (
                    <p
                      className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {p.maskedKey}
                    </p>
                  )}
                </div>

                {confirmRemove === p.provider ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[var(--text-tertiary)]">Remove?</span>
                    <button
                      onClick={() => handleRemove(p.provider)}
                      disabled={removing}
                      className="text-xs font-medium text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {removing ? 'Removing…' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setConfirmRemove(null)}
                      className="text-xs text-[var(--text-quaternary)] hover:text-[var(--text-tertiary)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemove(p.provider)}
                    className="shrink-0 text-xs text-[var(--text-quaternary)] hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Add provider form (inline) */}
        {showForm && (
          <form onSubmit={handleSave} className="border-t border-[var(--border)] px-5 py-5 space-y-4">
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              Add Provider
            </p>

            {/* Provider select */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">Provider</label>
              <select
                value={formProvider}
                onChange={(e) => {
                  setFormProvider(e.target.value as 'anthropic' | 'openai');
                  setFormModel('');
                }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-colors"
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            {/* API Key input */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">API Key</label>
              <input
                type="password"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                placeholder={PROVIDER_HINTS[formProvider]}
                required
                autoComplete="off"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-colors"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>

            {/* Default model (optional) */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--text-secondary)]">
                Default Model <span className="text-[var(--text-quaternary)]">(optional)</span>
              </label>
              <select
                value={formModel}
                onChange={(e) => setFormModel(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-colors"
              >
                <option value="">— Keep existing default —</option>
                {modelOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Error message */}
            {formStatus === 'error' && formError && (
              <p className="text-xs text-red-400">{formError}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={!formKey.trim() || formStatus === 'verifying' || formStatus === 'saving'}
                className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formStatus === 'verifying'
                  ? 'Verifying…'
                  : formStatus === 'saving'
                  ? 'Saving…'
                  : 'Verify & Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormStatus('idle');
                  setFormError('');
                  setFormKey('');
                }}
                className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
