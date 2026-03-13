import { LiveSttTool } from '@/features/tools/components/LiveSttTool';
export default function LiveSttPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎙️</span>
        <div>
          <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Živi Prepis</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Real-time speech transcription</p>
        </div>
      </div>
      <LiveSttTool />
    </div>
  );
}
