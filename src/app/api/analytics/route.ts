import { NextResponse } from "next/server";
import {
  getPerformanceSummary,
  listPostedScheduledPostsWithLatestSnapshot,
} from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const [summary, postedScheduledPosts] = await Promise.all([
    getPerformanceSummary(),
    listPostedScheduledPostsWithLatestSnapshot(),
  ]);
  return NextResponse.json({ summary, postedScheduledPosts });
}
