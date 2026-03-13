import { ProjectLaunchpad } from '@/features/pipeline/components/client/ProjectLaunchpad';
import { getProjectSettings } from '@/features/pipeline/actions/settings';
import { EnqueueForm } from '@/features/pipeline/components/client/EnqueueForm';

export default async function ProjectsPage() {
  const settings = await getProjectSettings();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h1 className="text-[var(--hig-title1)] font-semibold text-[var(--text-primary)] animate-fade-up">Projects</h1>
           <p className="text-sm text-[var(--text-quaternary)]">Select a project to manage its pipeline and agents.</p>
        </div>
        <EnqueueForm />
      </div>
      <ProjectLaunchpad settings={settings} />
    </div>
  );
}
