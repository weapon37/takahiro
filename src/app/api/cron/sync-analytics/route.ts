import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { isXConfigured } from "@/lib/x-client";
import { syncPostAnalytics } from "@/lib/analytics-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
