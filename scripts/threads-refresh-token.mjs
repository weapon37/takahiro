#!/usr/bin/env node
// 長期アクセストークン(60日)の有効期限が切れる前に更新するヘルパー。
// 発行から24時間以上経過していれば実行可能で、新しい60日トークンが発行される。
// 使い方:
//   node scripts/threads-refresh-token.mjs <CURRENT_LONG_LIVED_TOKEN>

const [currentToken] = process.argv.slice(2);

if (!currentToken) {
  console.error("使い方: node scripts/threads-refresh-token.mjs <CURRENT_LONG_LIVED_TOKEN>");
  process.exit(1);
}

async function main() {
  const url = new URL("https://graph.threads.net/refresh_access_token");
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", currentToken);

  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error("トークンの更新に失敗しました:", data);
    process.exit(1);
  }

  console.log("新しい THREADS_ACCESS_TOKEN:");
  console.log(data.access_token);
  console.log(
    `\n(有効期限: 約${Math.round(data.expires_in / 86400)}日。Vercelの環境変数を更新してください。)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
