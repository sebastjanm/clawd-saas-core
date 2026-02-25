import { z } from 'zod';

export const ARTICLE_STATUSES = [
  'backlog',
  'todo',
  'writing',
  'review',
  'ready',
  'ready_for_design',
  'awaiting_approval',
  'published',
  'promoted',
  'failed',
] as const;

export const ArticleStatusSchema = z.enum(ARTICLE_STATUSES);

export const SEARCH_INTENTS = [
  'informational',
  'commercial',
  'comparison',
  'transactional',
] as const;

export const ArticleSchema = z.object({
  id: z.number(),
  project: z.string(),
  title: z.string(),
  slug: z.string().nullable(),
  primary_keyword: z.string().nullable(),
  search_intent: z.enum(SEARCH_INTENTS).nullable(),
  outline: z.string().nullable(),
  draft_md: z.string().nullable(),
  final_md: z.string().nullable(),
  feedback: z.string().nullable(),
  status: ArticleStatusSchema,
  claimed_by: z.string().nullable(),
  claimed_at: z.string().nullable(),
  published_url: z.string().nullable(),
  published_at: z.string().nullable(),
  promoted_at: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  strategy: z.string().nullable(),
  notes: z.string().nullable(),
  scheduled_date: z.string().nullable(),
  day_number: z.number().nullable(),
  cover_image: z.string().nullable(),
  priority: z.enum(['normal', 'high', 'now']).nullable().optional(),
  abstract: z.string().nullable().optional(),
  revision_count: z.number().nullable().optional(),
});

export const AgentRunSchema = z.object({
  id: z.number(),
  agent_name: z.string(),
  agent_type: z.enum(['pipeline', 'freelancer', 'system']),
  job_id: z.string().nullable(),
  session_key: z.string().nullable(),
  status: z.enum(['running', 'ok', 'error', 'timeout', 'killed']),
  task_summary: z.string().nullable(),
  article_id: z.number().nullable(),
  project: z.string().nullable(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  duration_ms: z.number().nullable(),
  tokens_in: z.number().nullable(),
  tokens_out: z.number().nullable(),
  model: z.string().nullable().optional(),
  error: z.string().nullable(),
  created_at: z.string(),
});

export const UpdateArticleStatusSchema = z.object({
  status: ArticleStatusSchema,
});

export const CronJobSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  label: z.string().optional(),
  schedule: z.unknown(),
  enabled: z.boolean(),
  state: z.object({
    nextRunAtMs: z.number().optional(),
    lastRunAtMs: z.number().optional(),
    lastStatus: z.string().optional(),
    lastDurationMs: z.number().optional(),
    consecutiveErrors: z.number().optional(),
    lastError: z.string().optional(),
  }).optional(),
});

export const SystemHealthSchema = z.object({
  cpuPercent: z.number(),
  memUsedMb: z.number(),
  memTotalMb: z.number(),
  diskUsedGb: z.number(),
  diskTotalGb: z.number(),
  uptimeHours: z.number(),
});
