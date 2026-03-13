import { AiChat } from '@/features/ai/components/client/AiChat';

export default function AiPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">🧠</span>
        <div>
          <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">AI Assistant</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Your AI team at your service</p>
        </div>
      </div>
      <AiChat />
    </div>
  );
}
