import { upsertPostSnapshot } from "@/lib/db";
import { fetchOwnRecentPosts } from "@/lib/x-client";

export async function syncPostAnalytics(
  maxResults = 20,
): Promise<{ fetched: number }> {
  const posts = await fetchOwnRecentPosts(maxResults);
  for (const post of posts) {
    await upsertPostSnapshot({
      xPostId: post.id,
      content: post.content,
      postedAt: post.postedAt,
      impressions: post.impressions,
      likes: post.likes,
      reposts: post.reposts,
      replies: post.replies,
      quotes: post.quotes,
    });
  }
  return { fetched: posts.length };
}
