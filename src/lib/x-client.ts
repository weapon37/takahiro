import { TwitterApi } from "twitter-api-v2";

export function isXConfigured(): boolean {
  return Boolean(
    process.env.X_API_KEY &&
      process.env.X_API_SECRET &&
      process.env.X_ACCESS_TOKEN &&
      process.env.X_ACCESS_SECRET,
  );
}

function buildClient(): TwitterApi {
  if (!isXConfigured()) {
    throw new Error(
      "X APIの認証情報(X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET)が設定されていません。",
    );
  }
  return new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_SECRET!,
  });
}

export async function postTweet(text: string): Promise<{ id: string }> {
  const client = buildClient();
  const result = await client.v2.tweet(text);
  return { id: result.data.id };
}

export interface FetchedPost {
  id: string;
  content: string;
  postedAt: string;
  impressions: number | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  quotes: number | null;
}

export async function fetchOwnRecentPosts(maxResults = 20): Promise<FetchedPost[]> {
  const client = buildClient();
  const me = await client.v2.me();
  const timeline = await client.v2.userTimeline(me.data.id, {
    max_results: Math.min(100, Math.max(5, maxResults)),
    exclude: ["retweets", "replies"],
    "tweet.fields": ["public_metrics", "created_at"],
  });

  return timeline.tweets.map((tweet) => ({
    id: tweet.id,
    content: tweet.text,
    postedAt: tweet.created_at ?? new Date().toISOString(),
    impressions: tweet.public_metrics?.impression_count ?? null,
    likes: tweet.public_metrics?.like_count ?? null,
    reposts: tweet.public_metrics?.retweet_count ?? null,
    replies: tweet.public_metrics?.reply_count ?? null,
    quotes: tweet.public_metrics?.quote_count ?? null,
  }));
}
