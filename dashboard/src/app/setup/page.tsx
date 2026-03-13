'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'welcome' | 'provider' | 'key' | 'success';
type Provider = 'anthropic' | 'openai';

const PROVIDER_INFO = {
  anthropic: {
    name: 'Anthropic',
    icon: '🟠',
    description: 'Claude — Best for complex reasoning, writing, and analysis',
    keyHint: 'Starts with sk-ant-',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-sonnet-4-6',
  },
  openai: {
    name: 'OpenAI',
    icon: '🟢',
    description: 'GPT-4o — Great all-rounder with broad ecosystem support',
    keyHint: 'Starts with sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o',
  },
} as const;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'saving' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(true);

  // If keys already exist, redirect to login
  useEffect(() => {
    fetch('/api/settings/setup-status')
      .then((r) => r.json())
      .then((data: { needsSetup: boolean }) => {
        if (!data.needsSetup) {
          router.replace('/login');
        }
      })
      .catch(() => {
        // Can't check — show wizard anyway
      })
      .finally(() => setCheckingStatus(false));
  }, [router]);

  async function handleVerifyAndSave() {
    setErrorMsg('');
    setStatus('verifying');

    // Verify
    try {
      const res = await fetch('/api/settings/api-keys/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await res.json() as { valid: boolean; error?: string };
      if (!data.valid) {
        setStatus('error');
        setErrorMsg(data.error ?? 'Key verification failed — check and try again');
        return;
      }
    } catch {
      setStatus('error');
      setErrorMsg('Could not reach verification endpoint');
      return;
    }

    // Save
    setStatus('saving');
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          model: PROVIDER_INFO[provider].defaultModel,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setStatus('error');
        setErrorMsg(data.error ?? 'Failed to save key');
        return;
      }
      setStatus('idle');
      setStep('success');
    } catch {
      setStatus('error');
      setErrorMsg('Failed to save. Please try again.');
    }
  }

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <span className="text-sm text-[var(--text-quaternary)]">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {(['welcome', 'provider', 'key', 'success'] as Step[]).map((s, i) => (
            <span
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-6 bg-[var(--accent)]'
                  : i < (['welcome', 'provider', 'key', 'success'] as Step[]).indexOf(step)
                  ? 'w-1.5 bg-[var(--accent)] opacity-50'
                  : 'w-1.5 bg-[var(--border)]'
              }`}
            />
          ))}
        </div>

        {/* === STEP: WELCOME === */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div>
              <span className="text-5xl">🏭</span>
              <h1 className="mt-5 text-3xl font-bold text-[var(--text-primary)]">
                Set up your Content Factory
              </h1>
              <p className="mt-3 text-sm text-[var(--text-tertiary)] max-w-sm mx-auto leading-relaxed">
                Connect an AI provider to power your agents, pipeline, and creative tools.
                Takes about 2 minutes.
              </p>
            </div>

            <button
              onClick={() => setStep('provider')}
              className="w-full max-w-xs mx-auto flex rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 justify-center"
            >
              Get started →
            </button>
          </div>
        )}

        {/* === STEP: CHOOSE PROVIDER === */}
        {step === 'provider' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Choose a provider</h2>
              <p className="mt-1.5 text-sm text-[var(--text-tertiary)]">
                You can add more providers later in Settings
              </p>
            </div>

            <div className="grid gap-3">
              {(Object.keys(PROVIDER_INFO) as Provider[]).map((p) => {
                const info = PROVIDER_INFO[p];
                const selected = provider === p;
                return (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={`flex items-start gap-4 rounded-xl border p-4 text-left transition-all duration-200 ${
                      selected
                        ? 'border-[var(--accent)] bg-[var(--surface)] ring-1 ring-[var(--accent)]'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <span className="text-2xl mt-0.5 shrink-0">{info.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{info.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
                        {info.description}
                      </p>
                    </div>
                    <span
                      className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 transition-colors ${
                        selected
                          ? 'border-[var(--accent)] bg-[var(--accent)]'
                          : 'border-[var(--border)]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('welcome')}
                className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface)] transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep('key')}
                className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* === STEP: PASTE KEY === */}
        {step === 'key' && (
          <div className="space-y-6">
            <div className="text-center">
              <span className="text-3xl">{PROVIDER_INFO[provider].icon}</span>
              <h2 className="mt-3 text-xl font-bold text-[var(--text-primary)]">
                Connect {PROVIDER_INFO[provider].name}
              </h2>
              <p className="mt-1.5 text-sm text-[var(--text-tertiary)]">
                Get your key from{' '}
                <a
                  href={PROVIDER_INFO[provider].docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline"
                >
                  {provider === 'anthropic' ? 'console.anthropic.com' : 'platform.openai.com'}
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-secondary)]">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  if (status === 'error') {
                    setStatus('idle');
                    setErrorMsg('');
                  }
                }}
                placeholder={PROVIDER_INFO[provider].keyHint}
                autoComplete="off"
                autoFocus
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-colors"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              {status === 'error' && errorMsg && (
                <p className="text-xs text-red-400">{errorMsg}</p>
              )}
              {status === 'verifying' && (
                <p className="text-xs text-[var(--text-tertiary)]">Verifying key…</p>
              )}
              {status === 'saving' && (
                <p className="text-xs text-[var(--text-tertiary)]">Saving and restarting…</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('provider');
                  setStatus('idle');
                  setErrorMsg('');
                }}
                className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface)] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleVerifyAndSave}
                disabled={!apiKey.trim() || status === 'verifying' || status === 'saving'}
                className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'verifying'
                  ? 'Verifying…'
                  : status === 'saving'
                  ? 'Saving…'
                  : 'Verify & Save'}
              </button>
            </div>
          </div>
        )}

        {/* === STEP: SUCCESS === */}
        {step === 'success' && (
          <div className="text-center space-y-6">
            <div>
              <span className="text-5xl">✅</span>
              <h2 className="mt-5 text-2xl font-bold text-[var(--text-primary)]">
                You&apos;re all set!
              </h2>
              <p className="mt-2 text-sm text-[var(--text-tertiary)] max-w-sm mx-auto">
                {PROVIDER_INFO[provider].name} is connected. Your Content Factory is ready to go.
              </p>
            </div>

            <button
              onClick={() => router.push('/login')}
              className="w-full max-w-xs mx-auto flex rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 justify-center"
            >
              Go to dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
