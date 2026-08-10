import { NextResponse } from "next/server";
import { query, isDatabaseConfigured } from "@/lib/db";
import { generatePlan, MIN_WEEKS, MAX_WEEKS } from "@/lib/plan-generator";
import { todayJST, addDays, isValidDateString } from "@/lib/date";
import { buildAnthropicClient } from "@/lib/anthropic-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL が設定されていません。先に設定画面でDBを準備してください。",
      },
      { status: 400 },
    );
  }

  try {
    buildAnthropicClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "サーバー設定エラーです。" },
      { status: 500 },
    );
  }

  let body: { startDate?: unknown; weeks?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const startDate = isValidDateString(body.startDate) ? body.startDate : todayJST();
  const weeksRaw = Number(body.weeks);
  const weeks = Number.isFinite(weeksRaw)
    ? Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.round(weeksRaw)))
    : 2;

  let plan;
  try {
    plan = await generatePlan(weeks);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "計画の生成に失敗しました。" },
      { status: 502 },
    );
  }

  const totalDays = weeks * 7;
  const periodEnd = addDays(startDate, totalDays - 1);

  await query(
    `INSERT INTO plan_themes (scope, period_start, period_end, theme, notes)
     VALUES ('long', $1, $2, $3, $4)`,
    [startDate, periodEnd, plan.longTermTheme, plan.longTermRationale],
  );

  for (const weekly of plan.weeklyThemes) {
    const weekStart = addDays(startDate, weekly.weekIndex * 7);
    const weekEnd = addDays(startDate, weekly.weekIndex * 7 + 6);
    await query(
      `INSERT INTO plan_themes (scope, period_start, period_end, theme, notes)
       VALUES ('mid', $1, $2, $3, $4)`,
      [weekStart, weekEnd, weekly.theme, weekly.rationale],
    );
  }

  let inserted = 0;
  let skipped = 0;
  for (const draft of plan.dailyDrafts) {
    const scheduledDate = addDays(startDate, draft.dayOffset);
    const rows = await query<{ id: number }>(
      `INSERT INTO post_queue (scheduled_date, type_id, purpose, content, status)
       VALUES ($1, $2, $3, $4, 'draft')
       ON CONFLICT (scheduled_date) DO NOTHING
       RETURNING id`,
      [scheduledDate, draft.typeId, draft.purpose, draft.content],
    );
    if (rows.length > 0) inserted += 1;
    else skipped += 1;
  }

  return NextResponse.json({
    startDate,
    endDate: periodEnd,
    weeks,
    longTermTheme: plan.longTermTheme,
    longTermRationale: plan.longTermRationale,
    weeklyThemesCount: plan.weeklyThemes.length,
    dailyDrafts: { inserted, skipped, total: plan.dailyDrafts.length },
  });
}
