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

## 構成

- `src/lib/post-types.ts` — 投稿の型の定義一覧
- `src/app/api/analyze/route.ts` — 画像を受け取りClaude APIで分析するAPIルート
- `src/components/AnalyzerForm.tsx` — アップロードUIと結果表示
