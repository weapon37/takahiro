import { Pool, type QueryResultRow } from "pg";
import type { PlanTheme, QueueItem, MetricEntry } from "@/lib/types";

export type {
  QueueStatus,
  PlanScope,
  PostPurpose,
  PlanTheme,
  QueueItem,
  MetricEntry,
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
      scheduled_date DATE NOT NULL,
      slot INTEGER NOT NULL DEFAULT 1,
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
  // 旧スキーマ(1日1投稿)からの移行: scheduled_date単体のUNIQUE制約を
  // (scheduled_date, slot)の複合UNIQUE制約に置き換える
  await query(`ALTER TABLE post_queue ADD COLUMN IF NOT EXISTS slot INTEGER NOT NULL DEFAULT 1`);
  await query(`ALTER TABLE post_queue DROP CONSTRAINT IF EXISTS post_queue_scheduled_date_key`);
  await query(`
    DO $$
    BEGIN
      ALTER TABLE post_queue ADD CONSTRAINT post_queue_date_slot_key UNIQUE (scheduled_date, slot);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
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
  slot: number;
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
    `SELECT id, scheduled_date::text, slot, type_id, purpose, content, status, x_post_id, error_message, created_at, updated_at
     FROM post_queue
     WHERE scheduled_date BETWEEN $1 AND $2
     ORDER BY scheduled_date ASC, slot ASC`,
    [from, to],
  );
  return rows.map((r) => ({
    id: r.id,
    scheduledDate: r.scheduled_date,
    slot: r.slot,
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
