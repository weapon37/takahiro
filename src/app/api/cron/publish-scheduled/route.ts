import { NextResponse } from "next/server";
import { getDueScheduledPosts, markScheduledPostResult } from "@/lib/store";
import { publishToThreads } from "@/lib/threads-client";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 未設定時はローカル検証用に許可する
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function publishDuePosts() {
  const duePosts = await getDueScheduledPosts(new Date());
  const posted: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const scheduled of duePosts) {
    if (!scheduled.post) {
      await markScheduledPostResult(scheduled.id, "failed");
      failed.push({ id: scheduled.id, reason: "投稿データが見つかりません。" });
      continue;
    }

    try {
      if (scheduled.platform === "threads") {
        const text = `${scheduled.post.hook}\n\n${scheduled.post.body}`;
        await publishToThreads(text);
        await markScheduledPostResult(scheduled.id, "posted");
        posted.push(scheduled.id);
      } else {
        throw new Error(
          `${scheduled.platform} への自動投稿は未対応です。`,
        );
      }
    } catch (error) {
      await markScheduledPostResult(scheduled.id, "failed");
      failed.push({
        id: scheduled.id,
        reason: error instanceof Error ? error.message : "不明なエラー",
      });
    }
  }

  return { processed: duePosts.length, posted, failed };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "認証に失敗しました。" }, { status: 401 });
  }
  const result = await publishDuePosts();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "認証に失敗しました。" }, { status: 401 });
  }
  const result = await publishDuePosts();
  return NextResponse.json(result);
}
