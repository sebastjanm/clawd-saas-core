import { TtsTool } from '@/features/tools/components/TtsTool';
export default function TtsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔊</span>
        <div>
          <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Text to Speech</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Convert text to audio</p>
        </div>
      </div>
      <TtsTool />
    </div>
  );
}
