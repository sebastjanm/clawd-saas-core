import { ProjectSettingsPanel } from '@/features/pipeline/components/client/ProjectSettingsPanel';
import { getProjectSettings, type ProjectSettings } from '@/features/pipeline/actions/settings';

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const projectSlug = slug.toLowerCase();
  const allSettings = await getProjectSettings();
  
  let settings = allSettings.filter((s) => s.project.toLowerCase() === projectSlug);

  if (!settings.length) {
    const defaultSettings: ProjectSettings = {
      project: projectSlug,
      daily_limit: 2,
      vacation_limit: 5,
      vacation_mode: 0,
      auto_approve: 0,
      paused: 1,
      done_for_today: 0,
      done_at: null,
      updated_at: new Date().toISOString(),
    };
    settings = [defaultSettings];
  }

  return (
    <div className="space-y-6">
      <h2 className="text-[var(--hig-title2)] font-semibold text-[var(--text-primary)]">Settings</h2>
      <ProjectSettingsPanel settings={settings} />
    </div>
  );
}
