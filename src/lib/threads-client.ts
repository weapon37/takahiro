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
