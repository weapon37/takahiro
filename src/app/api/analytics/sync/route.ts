import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { isXConfigured } from "@/lib/x-client";
import { syncPostAnalytics } from "@/lib/analytics-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL が設定されていません。" },
      { status: 400 },
    );
  }
  if (!isXConfigured()) {
    return NextResponse.json(
      { error: "X APIの認証情報が設定されていません。" },
      { status: 400 },
    );
  }

  try {
    const result = await syncPostAnalytics();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取得に失敗しました。" },
      { status: 500 },
    );
  }
}
