const THREADS_API_BASE = "https://graph.threads.net/v1.0";

function getThreadsCredentials(): { accessToken: string; userId: string } {
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  const userId = process.env.THREADS_USER_ID;
  if (!accessToken || !userId) {
    throw new Error(
      "THREADS_ACCESS_TOKEN / THREADS_USER_ID が設定されていません。",
    );
  }
  return { accessToken, userId };
}

export async function publishToThreads(
  text: string,
): Promise<{ threadsPostId: string }> {
  const { accessToken, userId } = getThreadsCredentials();

  const createUrl = new URL(`${THREADS_API_BASE}/${userId}/threads`);
  createUrl.searchParams.set("media_type", "TEXT");
  createUrl.searchParams.set("text", text);
  createUrl.searchParams.set("access_token", accessToken);

  const createResponse = await fetch(createUrl, { method: "POST" });
  const createData = await createResponse.json();
  if (!createResponse.ok || !createData.id) {
    throw new Error(
      `Threadsへの投稿コンテナ作成に失敗しました: ${JSON.stringify(createData)}`,
    );
  }

  const publishUrl = new URL(`${THREADS_API_BASE}/${userId}/threads_publish`);
  publishUrl.searchParams.set("creation_id", createData.id);
  publishUrl.searchParams.set("access_token", accessToken);

  const publishResponse = await fetch(publishUrl, { method: "POST" });
  const publishData = await publishResponse.json();
  if (!publishResponse.ok || !publishData.id) {
    throw new Error(
      `Threadsへの投稿公開に失敗しました: ${JSON.stringify(publishData)}`,
    );
  }

  return { threadsPostId: publishData.id };
}

export async function getThreadsInsights(threadsPostId: string): Promise<{
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
}> {
  const { accessToken } = getThreadsCredentials();

  const insightsUrl = new URL(`${THREADS_API_BASE}/${threadsPostId}/insights`);
  insightsUrl.searchParams.set("metric", "views,likes,replies,reposts,quotes");
  insightsUrl.searchParams.set("access_token", accessToken);

  const response = await fetch(insightsUrl);
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.data)) {
    throw new Error(`Threadsの分析データ取得に失敗しました: ${JSON.stringify(data)}`);
  }

  function metricValue(name: string): number {
    const metric = data.data.find((m: { name: string }) => m.name === name);
    return metric?.values?.[0]?.value ?? metric?.total_value?.value ?? 0;
  }

  return {
    impressions: metricValue("views"),
    likes: metricValue("likes"),
    comments: metricValue("replies"),
    shares: metricValue("reposts") + metricValue("quotes"),
  };
}
