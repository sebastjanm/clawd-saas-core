import { SectionHeader } from '@/shared/components/client/SectionHeader';
import { SportBilly } from '@/features/tools/components/SportBilly';

export default function ToolsPage() {
  return (
    <div className="space-y-4">
      <SectionHeader label="Tools" />
      <SportBilly />
    </div>
  );
}
