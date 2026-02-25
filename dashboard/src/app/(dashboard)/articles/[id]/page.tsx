import { notFound } from 'next/navigation';
import { getDb } from '@/lib/server/db';
import { ArticlePreview } from '@/features/pipeline/components/server/ArticlePreview';
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
    <div className="max-w-4xl">
      <ArticlePreview article={article} />
    </div>
  );
}
