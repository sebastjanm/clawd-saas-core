import { SttTool } from '@/features/tools/components/SttTool';
export default function SttPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎙️</span>
        <div>
          <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Speech to Text</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Transcribe audio files</p>
        </div>
      </div>
      <SttTool />
    </div>
  );
}
