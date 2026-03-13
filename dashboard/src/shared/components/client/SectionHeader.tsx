export function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="h-px w-4 bg-[var(--surface-strong)]" />
      <h3 className="text-[var(--hig-subhead)] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
        {label}
      </h3>
      <div className="h-px flex-1 bg-[var(--surface-hover)]" />
    </div>
  );
}
