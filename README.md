# バズったX投稿 量産ツール

バズったX(旧Twitter)投稿の本文を貼り付けるか、スクリーンショットをアップロードすると、Claude (Anthropic API) がその投稿を分析し、同じ「型」を使った新しい投稿を自動で量産するツールです。

処理の流れは次のとおりです。

1. あらかじめ定義した12種類の「型」(共感・感情訴求型、ノウハウ・Tips型、ストーリー型など、`src/lib/post-types.ts` 参照)に分類する
2. バズった要因と、その型に分類した理由を表示する
3. 元の投稿と同じ型・構成・フック・文体を踏襲した新しい投稿を、指定した個数(5〜20個)だけ生成する

生成される投稿の内容は、元の投稿のテーマにかかわらず、以下のターゲット・ジャンルに固定されています。

- **ターゲット**: 30〜40代で、営業職や現場仕事など外に出て働くスタイルのため、まとまった副業の時間を取りづらい人
- **ジャンル**: AIを活用した副業

生成された投稿はそのままXに貼り付けられる完成形で、1件ずつ、または全件まとめてコピーできます。

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に ANTHROPIC_API_KEY を設定
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開き、投稿の本文を貼り付けるか、スクリーンショットをアップロードしてください。

### 環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic APIのキー。サーバー側でのみ使用します。 |
| `ANTHROPIC_MODEL` | — | 使用するモデルの上書き。未設定の場合は `claude-sonnet-4-6`。 |

## 入力の制限

- テキスト: 5000文字まで
- 画像: PNG / JPEG / WebP / GIF、10MBまで

## 構成

- `src/lib/post-types.ts` — 投稿の型の定義一覧
- `src/app/api/generate/route.ts` — テキストまたは画像を受け取り、Claude APIで型を分析して投稿を生成するAPIルート
- `src/components/PostGeneratorForm.tsx` — 入力UIと結果表示
- `src/app/page.tsx` — トップページ

## その他のコマンド

```bash
npm run build   # 本番ビルド
npm run start   # ビルド結果を起動
npm run lint    # ESLint
```
