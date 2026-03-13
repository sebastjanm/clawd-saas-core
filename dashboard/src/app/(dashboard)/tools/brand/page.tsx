import { BrandTool } from '@/features/tools/components/BrandTool';
export default function BrandPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🏭</span>
        <div>
          <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Brand</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Brand assets and guidelines</p>
        </div>
      </div>
      <BrandTool />
    </div>
  );
}
