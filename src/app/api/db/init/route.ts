import { NextResponse } from "next/server";
import { ensureSchema, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL が設定されていません。Vercel Postgres か Supabase を作成し、環境変数を設定してから再度お試しください。",
      },
      { status: 400 },
    );
  }

  try {
    await ensureSchema();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "DB初期化に失敗しました。",
      },
      { status: 500 },
    );
  }
}
