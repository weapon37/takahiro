# X投稿 量産・分析ツール

バズったX(旧Twitter)投稿のテキストやスクリーンショットから「型」(共感・感情訴求型、ノウハウ・Tips型、ストーリー型など、`src/lib/post-types.ts` 参照)を分析し、同じ型で新しい投稿を量産するツールです。投稿自体は手動でXに貼り付ける運用とし、実際に投稿したもののインプレッション・いいね等は毎日自動でX APIから取得・記録します。

## 機能

- **投稿を量産**(`/`) — バズった投稿を読み込ませて、同じ型・構成の新規投稿を何パターンも生成
- **投稿計画**(`/plan`) — 長期テーマ・週テーマ・日次下書きをAIが自動生成(任意機能。使わなくても他機能に影響なし)
- **実績記録**(`/metrics`) — インプレッションやフォロワー数などを手動で記録し、傾向を振り返る
- **投稿分析**(`/analytics`) — 実際にXへ投稿したものの数字(インプレッション・いいね・リポスト等)を毎日自動取得。手動で今すぐ更新も可能
- **設定**(`/settings`) — 環境変数やDB接続の状態確認、DBテーブルの初期化(ブラウザから操作、ターミナル不要)

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。

### 本番運用に必要なもの

1. **Anthropic API** — `ANTHROPIC_API_KEY`
2. **データベース**(投稿履歴・分析結果の保存) — Vercel PostgresかSupabaseを作成し `DATABASE_URL` を設定
3. **X API**(投稿分析の自動取得) — [developer.x.com](https://developer.x.com) でアプリを作成し、OAuth 1.0aの `X_API_KEY` / `X_API_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_SECRET` を取得。2026年2月以降は従量課金(投稿の読み取り1件$0.005、投稿ごと$0.015)
4. **CRON_SECRET** — `/api/cron/sync-analytics` を保護する任意の文字列。Vercelの環境変数に設定すると、Vercel Cronからのリクエストに自動で付与される

環境変数はすべてVercelのプロジェクト設定(Settings → Environment Variables)からブラウザだけで追加できます。追加後は再デプロイで反映されます。

### 分析自動取得のスケジュール

`vercel.json` の `crons` で毎日1回(デフォルトはUTC 21時=JST 6時)`/api/cron/sync-analytics` を呼び出し、直近の投稿の最新の数字をDBに保存します。時刻を変えたい場合はGitHub上で `vercel.json` の `schedule` を編集してください(ターミナル不要)。

## 構成

- `src/lib/post-types.ts` — 投稿の型の定義一覧
- `src/lib/audience.ts` — ターゲット層・ジャンルの定義
- `src/lib/db.ts` — DB接続・スキーマ初期化
- `src/lib/x-client.ts` — X APIへの投稿・読み取りクライアント
- `src/lib/analytics-sync.ts` — X投稿の実績を取得してDBに保存する共通ロジック
- `src/lib/plan-generator.ts` — 長期/週/日次の投稿計画生成ロジック(任意機能)
- `src/app/api/generate/route.ts` — 投稿量産API
- `src/app/api/plan/generate/route.ts`, `src/app/api/queue/**` — 投稿計画機能(任意)
- `src/app/api/metrics/route.ts` — 実績手動記録API
- `src/app/api/analytics/route.ts` — 投稿分析の一覧取得API
- `src/app/api/analytics/sync/route.ts` — 投稿分析の手動取得API
- `src/app/api/cron/sync-analytics/route.ts` — 投稿分析の自動取得バッチ(Vercel Cronから呼び出し)
- `src/app/api/db/init/route.ts`, `src/app/api/status/route.ts` — DB初期化・状態確認API
