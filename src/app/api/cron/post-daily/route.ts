import { NextResponse } from "next/server";
import { query, isDatabaseConfigured, type QueueItem } from "@/lib/db";
import { isXConfigured, postTweet } from "@/lib/x-client";
import { todayJST } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 万一クーロンが数日止まっていた場合に備え、直近の未投稿分もまとめて拾うが、
// 大量投稿を避けるため一度に処理する件数には上限を設ける(1日最大3投稿 × 3日分)。
const MAX_CATCH_UP = 9;

interface QueueRow {
  id: number;
  scheduled_date: string;
  slot: number;
  content: string;
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET が設定されていません。設定画面の手順に従って設定してください。" },
      { status: 500 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "認証に失敗しました。" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL が設定されていません。" },
      { status: 400 },
    );
  }
  if (!isXConfigured()) {
    return NextResponse.json(
      {
        error:
          "X APIの認証情報が設定されていません。承認済みの投稿はそのまま残っています。",
      },
      { status: 400 },
    );
  }

  const today = todayJST();
  const rows = await query<QueueRow>(
    `SELECT id, scheduled_date::text, slot, content
     FROM post_queue
     WHERE status = 'approved' AND scheduled_date <= $1
     ORDER BY scheduled_date ASC, slot ASC
     LIMIT $2`,
    [today, MAX_CATCH_UP],
  );

  const results: { id: number; status: QueueItem["status"]; error?: string }[] = [];

  for (const row of rows) {
    try {
      const posted = await postTweet(row.content);
      await query(
        `UPDATE post_queue SET status = 'posted', x_post_id = $1, error_message = NULL, updated_at = now() WHERE id = $2`,
        [posted.id, row.id],
      );
      results.push({ id: row.id, status: "posted" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "投稿に失敗しました。";
      await query(
        `UPDATE post_queue SET status = 'failed', error_message = $1, updated_at = now() WHERE id = $2`,
        [message, row.id],
      );
      results.push({ id: row.id, status: "failed", error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
