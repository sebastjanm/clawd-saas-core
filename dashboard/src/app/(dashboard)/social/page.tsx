import { SocialDashboard } from '@/features/social/components/client/SocialDashboard';

export default function SocialPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)] animate-fade-up">
        Social
      </h1>
      <SocialDashboard />
    </div>
  );
}
