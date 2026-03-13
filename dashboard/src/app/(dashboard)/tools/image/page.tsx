import { ImageTool } from '@/features/tools/components/ImageTool';
export default function ImagePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎨</span>
        <div>
          <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Image Generation</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Create images with AI</p>
        </div>
      </div>
      <ImageTool />
    </div>
  );
}
