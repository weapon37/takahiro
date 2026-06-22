import { NextResponse } from "next/server";
import { addAnalyticsSnapshot, listPostedScheduledPosts } from "@/lib/store";
import { getThreadsInsights } from "@/lib/threads-client";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 未設定時はローカル検証用に許可する
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function collectAnalytics() {
  const postedScheduledPosts = await listPostedScheduledPosts();
  const collected: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const scheduled of postedScheduledPosts) {
    if (scheduled.platform !== "threads" || !scheduled.platformPostId) continue;

    try {
      const insights = await getThreadsInsights(scheduled.platformPostId);
      await addAnalyticsSnapshot({
        scheduledPostId: scheduled.id,
        ...insights,
      });
      collected.push(scheduled.id);
    } catch (error) {
      failed.push({
        id: scheduled.id,
        reason: error instanceof Error ? error.message : "不明なエラー",
      });
    }
  }

  return { processed: postedScheduledPosts.length, collected, failed };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "認証に失敗しました。" }, { status: 401 });
  }
  const result = await collectAnalytics();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "認証に失敗しました。" }, { status: 401 });
  }
  const result = await collectAnalytics();
  return NextResponse.json(result);
}
