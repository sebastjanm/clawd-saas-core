'use client';

import { SocialDashboard } from '@/features/social/components/client/SocialDashboard';
import { useParams } from 'next/navigation';

export default function ProjectSocialPage() {
  // Client component: useParams is safe
  const params = useParams();
  const slug = params.slug as string;

  return (
    <div className="space-y-6">
      <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Social Dashboard</h2>
      <SocialDashboard initialProject={slug} />
    </div>
  );
}
