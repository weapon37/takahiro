import { NextResponse } from "next/server";
import { savePost, createScheduledPost, listScheduledPosts } from "@/lib/store";
import type { Post, Platform, ScheduledPost } from "@/lib/pipeline-types";

export const runtime = "nodejs";

const VALID_PLATFORMS: Platform[] = ["x", "threads", "instagram", "youtube"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as ScheduledPost["status"] | null;
  const scheduledPosts = await listScheduledPosts(status ?? undefined);
  return NextResponse.json({ scheduledPosts });
}

export async function POST(request: Request) {
  let body: { post?: Post; platform?: string; scheduledAt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const { post, platform, scheduledAt } = body;

  if (!post || !post.id || !post.body) {
    return NextResponse.json(
      { error: "投稿データが不足しています。" },
      { status: 400 },
    );
  }

  if (!platform || !VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json(
      { error: "対応していないプラットフォームです。" },
      { status: 400 },
    );
  }

  if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
    return NextResponse.json(
      { error: "予約日時が不正です。" },
      { status: 400 },
    );
  }

  await savePost(post);
  const scheduledPost = await createScheduledPost({
    postId: post.id,
    platform: platform as Platform,
    scheduledAt,
  });

  return NextResponse.json({ scheduledPost });
}
