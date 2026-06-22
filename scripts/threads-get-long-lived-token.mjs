#!/usr/bin/env node
// Threads APIのOAuth認可コードを、長期アクセストークン(60日)に交換するヘルパー。
// 使い方:
//   node scripts/threads-get-long-lived-token.mjs <APP_ID> <APP_SECRET> <REDIRECT_URI> <CODE>
//
// CODE は、以下のURLをブラウザで開いてThreadsアカウントで認可した後、
// リダイレクト先URLの ?code=... から取得する:
//   https://threads.net/oauth/authorize?client_id=<APP_ID>&redirect_uri=<REDIRECT_URI>&scope=threads_basic,threads_content_publish,threads_manage_insights,threads_read_replies&response_type=code

const [appId, appSecret, redirectUri, code] = process.argv.slice(2);

if (!appId || !appSecret || !redirectUri || !code) {
  console.error(
    "使い方: node scripts/threads-get-long-lived-token.mjs <APP_ID> <APP_SECRET> <REDIRECT_URI> <CODE>",
  );
  process.exit(1);
}

async function main() {
  const shortLivedForm = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const shortLivedResponse = await fetch("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    body: shortLivedForm,
  });
  const shortLivedData = await shortLivedResponse.json();
  if (!shortLivedResponse.ok || !shortLivedData.access_token) {
    console.error("短期トークンの取得に失敗しました:", shortLivedData);
    process.exit(1);
  }
  console.log("Threads User ID:", shortLivedData.user_id);

  const longLivedUrl = new URL("https://graph.threads.net/access_token");
  longLivedUrl.searchParams.set("grant_type", "th_exchange_token");
  longLivedUrl.searchParams.set("client_secret", appSecret);
  longLivedUrl.searchParams.set("access_token", shortLivedData.access_token);

  const longLivedResponse = await fetch(longLivedUrl);
  const longLivedData = await longLivedResponse.json();
  if (!longLivedResponse.ok || !longLivedData.access_token) {
    console.error("長期トークンへの交換に失敗しました:", longLivedData);
    process.exit(1);
  }

  console.log("\n.env.local に設定する値:");
  console.log(`THREADS_ACCESS_TOKEN=${longLivedData.access_token}`);
  console.log(`THREADS_USER_ID=${shortLivedData.user_id}`);
  console.log(
    `\n(有効期限: 約${Math.round(longLivedData.expires_in / 86400)}日。期限が切れる前に scripts/threads-refresh-token.mjs で更新してください。)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
