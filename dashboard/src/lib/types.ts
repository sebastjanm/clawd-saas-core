import { z } from 'zod';
import {
  ArticleSchema,
  AgentRunSchema,
  CronJobSchema,
  SystemHealthSchema,
  ARTICLE_STATUSES,
} from './schemas';

export type Article = z.infer<typeof ArticleSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
export type CronJob = z.infer<typeof CronJobSchema>;
export type SystemHealth = z.infer<typeof SystemHealthSchema>;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export interface PipelineColumn {
  status: ArticleStatus;
  label: string;
  articles: Article[];
}

export interface AgentStatus {
  name: string;
  emoji: string;
  role: string;
  desc: string;
  type: 'pipeline' | 'freelancer' | 'system';
  lastRun: AgentRun | null;
  cronJob: CronJob | null;
  runCount24h: number;
  errorCount24h: number;
}

export const COLUMN_LABELS: Record<ArticleStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  writing: 'Writing',
  review: 'Review',
  ready: 'Ready',
  ready_for_design: 'Design',
  awaiting_approval: 'Approval',
  published: 'Published',
  promoted: 'Promoted',
  failed: 'Failed',
};

export const PROJECT_COLORS: Record<string, string> = {
  nakupsrebra: '#C0C0C0',
  'baseman-blog': '#3b8bbc',
  'avant2go-subscribe': '#22c55e',
  'lightingdesign-studio': '#c9a227', // Muted gold
};

export const AGENT_META: Record<string, { emoji: string; role: string; desc: string; type: 'pipeline' | 'freelancer' | 'system'; group?: string }> = {
  // Pipeline Team
  oti:    { emoji: '🦦', role: 'Daily Pulse',     desc: '"What happened today?" — dives into news, prices, and events per project', type: 'pipeline', group: 'research' },
  maci:   { emoji: '🐱', role: 'The Hunter',     desc: '"What should we write about?" — hunts SERPs, competitors, and audience gaps', type: 'pipeline', group: 'research' },
  liso:   { emoji: '🦊', role: 'The Cunning Pick', desc: '"Which topic wins today?" — connects dots, verifies angles, creates the brief', type: 'pipeline', group: 'research' },
  pino:   { emoji: '🕷️', role: 'Writer',        desc: '"How do we write this?" — writes full articles from topic briefs', type: 'pipeline', group: 'content' },
  rada:   { emoji: '🦉', role: 'Editor',        desc: '"Is this good enough?" — reviews for accuracy, tone, and readability', type: 'pipeline', group: 'content' },
  zala:   { emoji: '🦋', role: 'Design Ops',    desc: '"Is this on-brand?" — HTML layout, brand components, style guide compliance, visual briefs for Hobi', type: 'pipeline', group: 'content' },
  lana:   { emoji: '🕊️', role: 'Publisher',     desc: '"Can we publish?" — sends previews + approval buttons', type: 'pipeline', group: 'distribution' },
  bea:    { emoji: '🐝', role: 'Social',        desc: '"How do we spread this?" — generates social posts from published articles', type: 'pipeline', group: 'distribution' },
  bordi:  { emoji: '🐕', role: 'Social Publisher', desc: '"Time to herd!" — publishes approved social posts to X, LinkedIn, FB, IG, TikTok', type: 'pipeline', group: 'distribution' },
  medo:   { emoji: '🐻', role: 'Watchdog',       desc: '"Is everything OK?" — monitors router health, detects stuck articles, fixes problems', type: 'pipeline', group: 'ops' },
  kroki:  { emoji: '🐦‍⬛', role: 'Analytics',     desc: '"What are the numbers?" — weekly pipeline report and trends', type: 'pipeline', group: 'ops' },
  vuk:    { emoji: '🐺', role: 'Strategist',    desc: '"What works, what doesn\'t?" — weekly strategy, kills weak topics', type: 'pipeline', group: 'strategy' },

  // Freelancers (on-demand)
  hobi:   { emoji: '🐙', role: 'Visual Design',  desc: 'On-demand visual creation — images, graphics, visual assets from Zala briefs', type: 'freelancer' },
  risko:  { emoji: '🐈‍⬛', role: 'SEO',           desc: 'On-demand SEO audits, keyword research, and technical optimization', type: 'freelancer' },
  orao:   { emoji: '🦅', role: 'Research',      desc: 'Deep-dive research on specific topics beyond standard intel', type: 'freelancer' },
  delfi:  { emoji: '🐬', role: 'Social',        desc: 'On-demand social campaigns beyond automated post generation', type: 'freelancer' },
  kodi:   { emoji: '💻', role: 'Dev',           desc: 'Coding tasks — scripts, tools, integrations, infrastructure', type: 'freelancer' },
  tigo:   { emoji: '🐯', role: 'Finance',       desc: 'Financial analysis — portfolio tracking, cost estimates, ROI', type: 'freelancer' },

  // System
  oly:    { emoji: '🫒', role: 'Main Assistant', desc: 'Primary AI assistant — orchestrates everything, manages all agents', type: 'system' },
};
