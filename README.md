# X投稿スクショ型分析ツール / 文体プロファイル分析ツール

2つのツールを収録しています。

- **投稿型分析**(`/`): バズったX(旧Twitter)投稿のスクリーンショットをアップロードすると、Claude (Anthropic API) が投稿内容を読み取り、あらかじめ定義した12種類の「型」(共感・感情訴求型、ノウハウ・Tips型、ストーリー型など、`src/lib/post-types.ts` 参照)に分類してくれるツールです。分類理由・バズった要因・読み取った本文も併せて表示します。
- **文体プロファイル分析**(`/style-analysis`): 過去のSNSポストをテキストで複数貼り付けると、Claudeがトーン・文体の特徴・構成のクセ・よく使う表現を分析し、別のAIに渡せばその文体を再現できる「文体プロファイル」を作成します。

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に ANTHROPIC_API_KEY を設定
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてスクリーンショットをアップロードしてください。
文体プロファイル分析は [http://localhost:3000/style-analysis](http://localhost:3000/style-analysis) から利用できます。

## 構成

- `src/lib/post-types.ts` — 投稿の型の定義一覧
- `src/app/api/analyze/route.ts` — 画像を受け取りClaude APIで分析するAPIルート
- `src/components/AnalyzerForm.tsx` — アップロードUIと結果表示
- `src/lib/style-profile.ts` — 文体プロファイルの型定義とポスト分割ロジック
- `src/app/api/style-profile/route.ts` — 過去ポスト群を受け取りClaude APIで文体プロファイルを作成するAPIルート
- `src/app/style-analysis/page.tsx` / `src/components/StyleProfileForm.tsx` — 文体プロファイル分析のUI
