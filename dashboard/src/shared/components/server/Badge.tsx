import { PROJECT_COLORS } from '@/lib/types';

interface BadgeProps {
  label: string;
  color?: string;
}

export function Badge({ label, color }: BadgeProps) {
  const bg = color ?? PROJECT_COLORS[label] ?? 'var(--muted)';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[var(--hig-caption1)] font-semibold uppercase"
      style={{ backgroundColor: `${bg}20`, color: bg }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: bg }}
      />
      {label}
    </span>
  );
}
