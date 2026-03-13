import { notFound } from 'next/navigation';
import { getDb } from '@/lib/server/db';
import { ArticlePreview } from '@/features/pipeline/components/server/ArticlePreview';
import { FreelancerActions } from '@/features/agents/components/client/FreelancerActions';
import type { Article } from '@/lib/types';

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const article = db
    .prepare('SELECT * FROM articles WHERE id = ?')
    .get(Number(id)) as Article | undefined;

  if (!article) notFound();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-8">
      {/* Main Content */}
      <div className="min-w-0">
        <ArticlePreview article={article} />
      </div>

      {/* Sidebar (Freelancers) */}
      <div className="space-y-6">
        <div className="sticky top-24 space-y-6">
          <FreelancerActions articleId={article.id} project={article.project} />
          
          {/* Placeholder for future Risko/Orao */}
          {/* <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-5 opacity-50">
            <h3 className="text-sm font-semibold text-[var(--text-tertiary)]">More specialists soon...</h3>
          </div> */}
        </div>
      </div>
    </div>
  );
}
