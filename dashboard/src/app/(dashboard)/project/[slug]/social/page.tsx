'use client';

import { SocialDashboard } from '@/features/social/components/client/SocialDashboard';

export default function ProjectSocialPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Social</h2>
      <SocialDashboard />
    </div>
  );
}
