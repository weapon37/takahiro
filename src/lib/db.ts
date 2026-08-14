import { Pool, type QueryResultRow } from "pg";
import type { PlanTheme, QueueItem, MetricEntry, PostSnapshot } from "@/lib/types";

export type {
  QueueStatus,
  PlanScope,
  PostPurpose,
  PlanTheme,
  QueueItem,
  MetricEntry,
  PostSnapshot,
} from "@/lib/types";

let pool: Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL が設定されていません。Vercel Postgres か Supabase を作成し、環境変数に設定してください。",
    );
  }
  if (!pool) {
    const disableSsl = process.env.DATABASE_URL.includes("sslmode=disable");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: disableSsl ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function ensureSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS plan_themes (
      id SERIAL PRIMARY KEY,
      scope TEXT NOT NULL CHECK (scope IN ('long','mid')),
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      theme TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS post_queue (
      id SERIAL PRIMARY KEY,
      scheduled_date DATE NOT NULL UNIQUE,
      type_id TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'value',
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','posted','failed','skipped')),
      x_post_id TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_post_queue_date ON post_queue(scheduled_date)`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS post_metrics (
      id SERIAL PRIMARY KEY,
      recorded_date DATE NOT NULL,
      impressions INTEGER,
      likes INTEGER,
      reposts INTEGER,
      replies INTEGER,
      follower_count INTEGER,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS post_snapshots (
      id SERIAL PRIMARY KEY,
      x_post_id TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      posted_at TIMESTAMPTZ NOT NULL,
      impressions INTEGER,
      likes INTEGER,
      reposts INTEGER,
      replies INTEGER,
      quotes INTEGER,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_post_snapshots_posted_at ON post_snapshots(posted_at)`,
  );
}

export async function checkDatabaseConnection(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await query("SELECT 1");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "接続に失敗しました。",
    };
  }
}

interface ThemeRow {
  id: number;
  scope: string;
  period_start: string;
  period_end: string;
  theme: string;
  notes: string | null;
  created_at: string;
}

export async function listThemes(from: string, to: string): Promise<PlanTheme[]> {
  const rows = await query<ThemeRow>(
    `SELECT id, scope, period_start::text, period_end::text, theme, notes, created_at
     FROM plan_themes
     WHERE period_end >= $1 AND period_start <= $2
     ORDER BY period_start ASC, scope DESC`,
    [from, to],
  );
  return rows.map((r) => ({
    id: r.id,
    scope: r.scope as PlanTheme["scope"],
    periodStart: r.period_start,
    periodEnd: r.period_end,
    theme: r.theme,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

interface QueueRow {
  id: number;
  scheduled_date: string;
  type_id: string;
  purpose: string;
  content: string;
  status: string;
  x_post_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export async function listQueueItems(from: string, to: string): Promise<QueueItem[]> {
  const rows = await query<QueueRow>(
    `SELECT id, scheduled_date::text, type_id, purpose, content, status, x_post_id, error_message, created_at, updated_at
     FROM post_queue
     WHERE scheduled_date BETWEEN $1 AND $2
     ORDER BY scheduled_date ASC`,
    [from, to],
  );
  return rows.map((r) => ({
    id: r.id,
    scheduledDate: r.scheduled_date,
    typeId: r.type_id,
    purpose: r.purpose as QueueItem["purpose"],
    content: r.content,
    status: r.status as QueueItem["status"],
    xPostId: r.x_post_id,
    errorMessage: r.error_message,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

interface MetricRow {
  id: number;
  recorded_date: string;
  impressions: number | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  follower_count: number | null;
  notes: string | null;
  created_at: string;
}

interface SnapshotRow {
  id: number;
  x_post_id: string;
  content: string;
  posted_at: string;
  impressions: number | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  quotes: number | null;
  fetched_at: string;
}

function toPostSnapshot(r: SnapshotRow): PostSnapshot {
  return {
    id: r.id,
    xPostId: r.x_post_id,
    content: r.content,
    postedAt: r.posted_at,
    impressions: r.impressions,
    likes: r.likes,
    reposts: r.reposts,
    replies: r.replies,
    quotes: r.quotes,
    fetchedAt: r.fetched_at,
  };
}

export async function upsertPostSnapshot(input: {
  xPostId: string;
  content: string;
  postedAt: string;
  impressions: number | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  quotes: number | null;
}): Promise<void> {
  await query(
    `INSERT INTO post_snapshots (x_post_id, content, posted_at, impressions, likes, reposts, replies, quotes, fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (x_post_id) DO UPDATE SET
       content = EXCLUDED.content,
       impressions = EXCLUDED.impressions,
       likes = EXCLUDED.likes,
       reposts = EXCLUDED.reposts,
       replies = EXCLUDED.replies,
       quotes = EXCLUDED.quotes,
       fetched_at = now()`,
    [
      input.xPostId,
      input.content,
      input.postedAt,
      input.impressions,
      input.likes,
      input.reposts,
      input.replies,
      input.quotes,
    ],
  );
}

export async function listPostSnapshots(limit = 50): Promise<PostSnapshot[]> {
  const rows = await query<SnapshotRow>(
    `SELECT id, x_post_id, content, posted_at, impressions, likes, reposts, replies, quotes, fetched_at
     FROM post_snapshots
     ORDER BY posted_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map(toPostSnapshot);
}

export async function listMetrics(): Promise<MetricEntry[]> {
  const rows = await query<MetricRow>(
    `SELECT id, recorded_date::text, impressions, likes, reposts, replies, follower_count, notes, created_at
     FROM post_metrics
     ORDER BY recorded_date DESC
     LIMIT 100`,
  );
  return rows.map((r) => ({
    id: r.id,
    recordedDate: r.recorded_date,
    impressions: r.impressions,
    likes: r.likes,
    reposts: r.reposts,
    replies: r.replies,
    followerCount: r.follower_count,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}
