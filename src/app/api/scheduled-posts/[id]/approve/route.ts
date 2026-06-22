import { NextResponse } from "next/server";
import { approveScheduledPost } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/scheduled-posts/[id]/approve">,
) {
  const { id } = await ctx.params;

  let body: { approvedBy?: string } = {};
  try {
    body = await request.json();
  } catch {
    // 承認者名は省略可能なので、空ボディでも続行する。
  }

  const scheduledPost = await approveScheduledPost(id, body.approvedBy);
  if (!scheduledPost) {
    return NextResponse.json(
      { error: "承認待ちの予約投稿が見つかりません。" },
      { status: 404 },
    );
  }

  return NextResponse.json({ scheduledPost });
}
