import { FlowGraph } from '@/features/pipeline/components/client/FlowGraph';
import { SectionHeader } from '@/shared/components/client/SectionHeader';

export default function FlowPage() {
  return (
    <div className="space-y-8 animate-fade-up">
      <SectionHeader label="Factory Flow 🏭" />
      <div className="glass-static rounded-2xl p-6 min-h-[600px] overflow-x-auto flex items-center justify-center">
        <FlowGraph stats={{}} />
      </div>
    </div>
  );
}
