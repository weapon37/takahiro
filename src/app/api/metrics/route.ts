import { NextResponse } from "next/server";
import { query, listMetrics, isDatabaseConfigured } from "@/lib/db";
import { isValidDateString } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL が設定されていません。" },
      { status: 400 },
    );
  }

  try {
    const items = await listMetrics();
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取得に失敗しました。" },
      { status: 500 },
    );
  }
}

function toNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL が設定されていません。" },
      { status: 400 },
    );
  }

  let body: {
    recordedDate?: unknown;
    impressions?: unknown;
    likes?: unknown;
    reposts?: unknown;
    replies?: unknown;
    followerCount?: unknown;
    notes?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  if (!isValidDateString(body.recordedDate)) {
    return NextResponse.json(
      { error: "recordedDate は YYYY-MM-DD 形式で指定してください。" },
      { status: 400 },
    );
  }

  try {
    await query(
      `INSERT INTO post_metrics (recorded_date, impressions, likes, reposts, replies, follower_count, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        body.recordedDate,
        toNullableInt(body.impressions),
        toNullableInt(body.likes),
        toNullableInt(body.reposts),
        toNullableInt(body.replies),
        toNullableInt(body.followerCount),
        typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      ],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存に失敗しました。" },
      { status: 500 },
    );
  }
}
