'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type Message = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  created_at: string;
};

type ProviderInfo = {
  name: string;
  models: string[];
  defaultModel: string;
  available: boolean;
};

type Conversation = {
  conversation_id: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  preview: string;
};

// Flat model entry for the single dropdown
type ModelOption = {
  value: string;         // "anthropic:claude-opus-4-6"
  provider: string;      // "anthropic"
  providerName: string;  // "Claude"
  model: string;         // "claude-opus-4-6"
  label: string;         // "Claude Opus 4.6"
  icon: string;          // "🟠"
};

const PROVIDER_META: Record<string, { icon: string; color: string }> = {
  openai: { icon: '🟢', color: 'var(--accent)' },
  anthropic: { icon: '🟠', color: '#d97706' },
  gemini: { icon: '💎', color: '#3b82f6' },
  deepseek: { icon: '🔵', color: '#06b6d4' },
  moonshot: { icon: '🌙', color: '#f59e0b' },
  dashscope: { icon: '🟣', color: '#8b5cf6' },
};

// Make model IDs human-readable
function humanizeModel(provider: string, model: string): string {
  const providerName = {
    anthropic: 'Claude',
    gemini: 'Gemini',
    openai: 'GPT',
    deepseek: 'DeepSeek',
    dashscope: 'Qwen',
    moonshot: 'Kimi',
  }[provider] || provider;

  // Clean up model ID into a readable name
  const cleaned = model
    .replace('claude-', '')
    .replace('gemini-', '')
    .replace('gpt-', 'GPT-')
    .replace('deepseek-', '')
    .replace('qwen-', '')
    .replace('kimi-', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return `${providerName} ${cleaned}`;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso.includes('Z') || iso.includes('+') ? iso : iso + 'Z');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso.includes('Z') || iso.includes('+') ? iso : iso + 'Z');
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return formatTime(iso);
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function MessageBubble({ msg, modelOptions }: { msg: Message; modelOptions: ModelOption[] }) {
  const isUser = msg.role === 'user';
  const meta = msg.provider ? PROVIDER_META[msg.provider] : null;
  const opt = modelOptions.find((o) => o.provider === msg.provider && o.model === msg.model);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-[var(--accent)] text-white rounded-br-md'
            : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-bl-md'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          {!isUser && meta && (
            <span className="text-[10px] text-[var(--text-quaternary)]">
              {meta.icon} {opt?.label || msg.model}
            </span>
          )}
          <span className={`text-[10px] ${isUser ? 'text-white/50' : 'text-[var(--text-tertiary)]'}`}>
            {formatTime(msg.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

function StreamingBubble({ content, option }: { content: string; option?: ModelOption }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]">
        <p className="whitespace-pre-wrap break-words">{content}<span className="inline-block w-1.5 h-4 bg-[var(--accent)] animate-pulse ml-0.5 align-text-bottom rounded-sm" /></p>
        {option && (
          <span className="block mt-1 text-[10px] text-[var(--text-quaternary)]">{option.icon} streaming...</span>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-bounce"
              style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.8s' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Sidebar ── */
function ChatSidebar({
  conversations,
  activeConversation,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: Conversation[];
  activeConversation: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <div className="w-64 shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--surface)]/50">
      <div className="p-3 border-b border-[var(--border)]">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 hover:bg-[var(--surface-hover)] transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="text-[11px] text-[var(--text-tertiary)] text-center py-8 px-4">No conversations yet</p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.conversation_id}
            onClick={() => onSelect(conv.conversation_id)}
            className={`w-full flex items-start gap-2 px-3 py-2.5 text-left transition-all hover:bg-[var(--surface-hover)] group ${
              activeConversation === conv.conversation_id
                ? 'bg-[var(--surface-hover)] border-r-2 border-r-[var(--accent)]'
                : ''
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--text)] truncate leading-snug">
                {conv.preview || 'New chat'}
              </p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                {formatDate(conv.last_message_at)} · {conv.message_count} msgs
              </p>
            </div>
            <button
              onClick={(e) => onDelete(conv.conversation_id, e)}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-[var(--text-quaternary)] hover:text-red-400 transition-all p-0.5 mt-0.5"
              title="Delete"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Build flat model list from providers ── */
function buildModelOptions(providers: Record<string, ProviderInfo>): ModelOption[] {
  const options: ModelOption[] = [];
  for (const [pid, p] of Object.entries(providers)) {
    if (!p.available) continue;
    const meta = PROVIDER_META[pid];
    for (const model of p.models) {
      options.push({
        value: `${pid}:${model}`,
        provider: pid,
        providerName: p.name,
        model,
        label: humanizeModel(pid, model),
        icon: meta?.icon || '🤖',
      });
    }
  }
  return options;
}

/* ── Main Component ── */
export function AiChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState('default');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});

  // Single selected model: "provider:model"
  const [selectedValue, setSelectedValue] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('ai-model') || '';
    return '';
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadConversation = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/ai/chat?conversation=${encodeURIComponent(convId)}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setConversations(data.conversations || []);
        setProviders(data.providers || {});
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    async function load() {
      await loadConversation(activeConversation);
      setInitialLoad(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, streaming, streamContent, scrollToBottom]);

  // Set default model on first load if none selected
  const modelOptions = buildModelOptions(providers);
  const currentOption = modelOptions.find((o) => o.value === selectedValue);

  useEffect(() => {
    if (!selectedValue && modelOptions.length > 0) {
      const defaultOpt = modelOptions.find((o) => o.provider === 'anthropic') || modelOptions[0];
      setSelectedValue(defaultOpt.value);
    }
  }, [modelOptions, selectedValue]);

  useEffect(() => {
    if (selectedValue && typeof window !== 'undefined') {
      localStorage.setItem('ai-model', selectedValue);
    }
  }, [selectedValue]);

  function parseSelection(value: string): { provider: string; model: string } {
    const [provider, ...rest] = value.split(':');
    return { provider, model: rest.join(':') };
  }

  function newChat() {
    const id = `chat-${Date.now()}`;
    setActiveConversation(id);
    setMessages([]);
    inputRef.current?.focus();
  }

  async function switchConversation(convId: string) {
    setActiveConversation(convId);
    await loadConversation(convId);
  }

  async function deleteConversation(convId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/ai/chat?conversation=${encodeURIComponent(convId)}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.conversation_id !== convId));
      if (activeConversation === convId) newChat();
    } catch { /* silent */ }
  }

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading || streaming) return;

    const { provider, model } = parseSelection(selectedValue);

    const userMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: msg,
      provider,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setStreamContent('');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          provider,
          model,
          conversationId: activeConversation,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      setLoading(false);
      setStreaming(true);

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
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.done) continue;
            if (parsed.content) {
              fullReply += parsed.content;
              setStreamContent(fullReply);
            }
          } catch { /* skip */ }
        }
      }

      if (fullReply) {
        const aiMsg: Message = {
          id: Date.now() + 1,
          role: 'assistant',
          content: fullReply,
          provider,
          model,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }

      loadConversation(activeConversation);
    } catch (err: any) {
      const errorMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Error: ${err.message}`,
        provider,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setLoading(false);
    setStreaming(false);
    setStreamContent('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (initialLoad) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">🧠</span>
          <span className="text-sm text-[var(--text-tertiary)]">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
      {/* Sidebar */}
      <ChatSidebar
        conversations={conversations}
        activeConversation={activeConversation}
        onSelect={switchConversation}
        onNew={newChat}
        onDelete={deleteConversation}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar: model selector */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-[var(--border)]">
          <select
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            className="text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] font-medium"
          >
            {modelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.icon} {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-5xl mb-4">🧠</span>
              <h3 className="text-lg font-semibold text-[var(--text)]">AI Chat</h3>
              <p className="text-sm text-[var(--text-tertiary)] mt-1 max-w-md">
                {modelOptions.length > 0
                  ? 'Select a model and start chatting.'
                  : 'No AI providers configured.'}
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} modelOptions={modelOptions} />
          ))}
          {loading && <TypingIndicator />}
          {streaming && streamContent && <StreamingBubble content={streamContent} option={currentOption} />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-[var(--border)] px-5 py-4">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${currentOption?.label || 'AI'}...`}
              rows={1}
              disabled={modelOptions.length === 0}
              className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all max-h-[6rem] scrollbar-hide disabled:opacity-50"
              style={{ fontFamily: 'inherit' }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading || streaming || modelOptions.length === 0}
              className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          {currentOption && (
            <p className="text-[10px] text-[var(--text-tertiary)] mt-2 text-center">
              {currentOption.icon} {currentOption.label} · Enter to send
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
