# X投稿スクショ型分析ツール

バズったX(旧Twitter)投稿のスクリーンショットをアップロードすると、Claude (Anthropic API) が投稿内容を読み取り、あらかじめ定義した12種類の「型」(共感・感情訴求型、ノウハウ・Tips型、ストーリー型など、`src/lib/post-types.ts` 参照)に分類してくれるツールです。分類理由・バズった要因・読み取った本文も併せて表示します。

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に ANTHROPIC_API_KEY を設定
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてスクリーンショットをアップロードしてください。

## Threads連携のセットアップ(⑥自動投稿・⑧分析)

`/api/cron/publish-scheduled` と `/api/cron/collect-analytics` がThreadsへの投稿・分析データ取得を行うには、`THREADS_ACCESS_TOKEN` / `THREADS_USER_ID` が必要です。

1. [Meta for Developers](https://developers.facebook.com/) でアプリを作成し、「Threads API」プロダクトを追加する
2. アプリの「役割」→「Threadsテスター」に投稿したいThreadsアカウントを追加し、Threads側で招待を承認する
3. 以下のURLをブラウザで開き、Threadsアカウントで認可する(`<APP_ID>` `<REDIRECT_URI>` はアプリ設定の値に置き換える)
   ```
   https://threads.net/oauth/authorize?client_id=<APP_ID>&redirect_uri=<REDIRECT_URI>&scope=threads_basic,threads_content_publish,threads_manage_insights,threads_read_replies&response_type=code
   ```
4. 認可後にリダイレクトされたURLの `?code=...` を使って、長期アクセストークンとUser IDを取得する
   ```bash
   npm run threads:token -- <APP_ID> <APP_SECRET> <REDIRECT_URI> <CODE>
   ```
5. 出力された `THREADS_ACCESS_TOKEN` / `THREADS_USER_ID` を `.env.local`(本番はVercelの環境変数)に設定する

長期トークンの有効期限は約60日です。期限切れ前に以下で更新できます(24時間以上経過していれば実行可能)。

```bash
npm run threads:refresh -- <現在のTHREADS_ACCESS_TOKEN>
```

## 構成

- `src/lib/post-types.ts` — 投稿の型の定義一覧
- `src/app/api/analyze/route.ts` — 画像を受け取りClaude APIで分析するAPIルート
- `src/components/AnalyzerForm.tsx` — アップロードUIと結果表示
