# X投稿 量産・自動化ツール

バズったX(旧Twitter)投稿のテキストやスクリーンショットから「型」(共感・感情訴求型、ノウハウ・Tips型、ストーリー型など、`src/lib/post-types.ts` 参照)を分析し、同じ型で新しい投稿を量産するツールです。加えて、長期・中期・日次の投稿計画をAIが自動生成し、承認した投稿だけを毎日自動でXに投稿する仕組みも備えています。

## 機能

- **投稿を量産**(`/`) — バズった投稿を読み込ませて、同じ型・構成の新規投稿を何パターンも生成
- **投稿計画**(`/plan`) — 長期テーマ・週テーマ・日次下書きをAIが自動生成。内容を確認・編集して「承認」した投稿だけが自動投稿される
- **実績記録**(`/metrics`) — インプレッションやフォロワー数などを手動で記録し、傾向を振り返る
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
2. **データベース**(投稿計画・履歴の保存) — Vercel PostgresかSupabaseを作成し `DATABASE_URL` を設定
3. **X API**(自動投稿) — [developer.x.com](https://developer.x.com) でアプリを作成し、OAuth 1.0aの `X_API_KEY` / `X_API_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_SECRET` を取得。2026年2月以降は投稿ごとの従量課金(1投稿$0.015、URL付きは$0.20)
4. **CRON_SECRET** — `/api/cron/post-daily` を保護する任意の文字列。Vercelの環境変数に設定すると、Vercel Cronからのリクエストに自動で付与される

環境変数はすべてVercelのプロジェクト設定(Settings → Environment Variables)からブラウザだけで追加できます。追加後は再デプロイで反映されます。

### 自動投稿のスケジュール

`vercel.json` の `crons` で毎日1回(デフォルトはUTC 0時=JST 9時)`/api/cron/post-daily` を呼び出し、その日までに承認済み(ステータス「承認済み」)の投稿を自動でXに送信します。時刻を変えたい場合はGitHub上で `vercel.json` の `schedule` を編集してください(ターミナル不要)。

## 構成

- `src/lib/post-types.ts` — 投稿の型の定義一覧
- `src/lib/audience.ts` — ターゲット層・ジャンルの定義
- `src/lib/db.ts` — DB接続・スキーマ初期化
- `src/lib/x-client.ts` — X APIへの投稿クライアント
- `src/lib/plan-generator.ts` — 長期/週/日次の投稿計画生成ロジック
- `src/app/api/generate/route.ts` — 投稿量産API
- `src/app/api/plan/generate/route.ts` — 投稿計画生成API
- `src/app/api/queue/**` — 日次投稿の一覧・編集・承認API
- `src/app/api/metrics/route.ts` — 実績記録API
- `src/app/api/cron/post-daily/route.ts` — 自動投稿バッチ(Vercel Cronから呼び出し)
- `src/app/api/db/init/route.ts`, `src/app/api/status/route.ts` — DB初期化・状態確認API
