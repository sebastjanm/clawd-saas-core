import { ProjectSettingsPanel } from '@/features/pipeline/components/client/ProjectSettingsPanel';
import { getProjectSettings } from '@/features/pipeline/actions/settings';

export default async function ProjectsPage() {
  const settings = await getProjectSettings();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)] animate-fade-up">Projects</h1>
        <p className="text-xs text-[var(--text-quaternary)] mt-1">Pause controls, daily limits, and vacation mode.</p>
      </div>
      <ProjectSettingsPanel settings={settings} />
    </div>
  );
}
