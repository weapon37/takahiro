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
