import { NextResponse } from "next/server";
import { listThemes, isDatabaseConfigured } from "@/lib/db";
import { todayJST, addDays, isValidDateString } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL が設定されていません。" },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const from = isValidDateString(fromParam) ? fromParam : addDays(todayJST(), -90);
  const to = isValidDateString(toParam) ? toParam : addDays(todayJST(), 90);

  try {
    const items = await listThemes(from, to);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取得に失敗しました。" },
      { status: 500 },
    );
  }
}
