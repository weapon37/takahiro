@AGENTS.md

# takahiro — バズったX投稿 量産ツール

用途が1つに絞られた Next.js アプリです。バズったX(旧Twitter)投稿の本文を貼り
付けるか、スクリーンショットをアップロードすると、Claude がその投稿をあらかじめ
定義された12種類の「型」に分類し、バズった要因を説明したうえで、同じ構成・フック
を踏襲した新しい投稿を指定個数だけ生成します。生成される投稿は、元の投稿のテーマ
にかかわらず、固定のターゲット・ジャンル(外に出て働く30〜40代向けの、AIを活用
した副業)に必ず寄せられます。

プロダクトの表面はすべて日本語です(UI文言、APIのエラーメッセージ、モデルへの
プロンプト、コミットメッセージ)。この方針を維持してください。ユーザーに見える
文字列とコミットの件名は日本語で、コード上の識別子とコメントは英語で書きます。

## 技術スタック

| 要素 | バージョン / 補足 |
| --- | --- |
| Next.js | 16.2.9、App Router、TypeScript |
| React | 19.2.4 |
| Tailwind CSS | v4 — CSSファースト(`@import "tailwindcss"`)。設定は `src/app/globals.css` の `@theme inline` で行う。`tailwind.config.js` は存在せず、追加もしないこと。 |
| Anthropic SDK | `@anthropic-ai/sdk` ^0.105.0。呼び出しはサーバー側のみ。 |
| ESLint | v9 のフラット設定(`eslint.config.mjs`)。`eslint-config-next/core-web-vitals` と `/typescript` を合成。 |

**コードを書く前に Next.js のドキュメントを読んでください。** `AGENTS.md` にある
とおり、このバージョンの Next.js は記憶している内容と異なります。正となるガイドは
`node_modules/next/dist/docs/` に同梱されています。`npm install` の後にしか存在
しないため、参照が必要な場合は先にインストールしてください。

## コマンド

```bash
npm install
cp .env.example .env.local   # その後 ANTHROPIC_API_KEY を設定
npm run dev                  # http://localhost:3000
npm run build
npm run lint                 # 素の `eslint`。フラット設定なので引数は不要
```

テストスイート、CIワークフロー、`.github/` ディレクトリはいずれもありません。変更
の確認は `npm run lint`、`npm run build`、および実際にアプリを動かして行ってくだ
さい。

## ディレクトリ構成

```
src/
  app/
    layout.tsx              # ルートレイアウト: Geistフォント、メタデータ、ダークモード用のbodyクラス
    page.tsx                # サーバーコンポーネント。見出し文言と <PostGeneratorForm />
    globals.css             # Tailwind v4 のエントリ + CSS変数によるテーマ
    api/generate/route.ts   # 唯一のAPIルート。Claude関連のロジックはすべてここ
  components/
    PostGeneratorForm.tsx   # "use client" — インタラクティブUIの全体
  lib/
    post-types.ts           # 12種類の型の定義とID検索
```

インポートには `@/*` エイリアス(`@/lib/post-types` など)を使います。`tsconfig.json`
で `src/*` にマッピングされています。TypeScript は `strict` モードです。

## `src/app/api/generate/route.ts` の仕組み

Node ランタイム(`export const runtime = "nodejs"`)で動作し、`multipart/form-data`
の POST を受け取ります。フィールドは以下のとおりです。

- `mode` — `"text"` または `"image"`(必須。それ以外は拒否)
- `text` — `mode=text` のとき必須。trim され、最大5000文字
- `image` — `mode=image` のとき必須。PNG / JPEG / WebP / GIF のみ、最大10MB。
  base64 に変換して Anthropic の画像ブロックに載せる
- `count` — 3〜20 にクランプされ、既定値は10

編集時に維持すべき設計上の判断は次のとおりです。

1. **自由形式のJSONではなく、ツール利用を強制している。** ルートは
   `submit_generation` というツールを1つだけ定義し、
   `tool_choice: { type: "tool", name: ... }` で固定しています。応答は `tool_use`
   ブロックから読み出します。出力項目を追加する場合は `input_schema`(および
   `required` の一覧)とローカルのレスポンス型を拡張してください。文章をパースする
   方式に変えないこと。
2. **`detected_type_id` は `enum: POST_TYPE_IDS` で制約され**、さらにサーバー側で
   `getPostTypeById` により再検証されます。未知のIDは502を返します。型を追加する
   場合は `src/lib/post-types.ts` だけを編集すれば済みます。union型・プロンプトの
   一覧・enum はすべて `POST_TYPES` から導出されます。
3. **`count` は二重に強制されます** — プロンプトの文面と、`generated_posts` の
   `minItems` / `maxItems` の両方です。片方だけ変えないでください。
4. **ターゲットとジャンルはルート内に定数としてハードコードされています**
   (`TARGET_AUDIENCE` と `GENRE`)。生成される投稿は元投稿のテーマに関係なく必ず
   これらに寄せられます。これはバグではなく意図された仕様です。設定可能にするのは
   依頼があったときだけにしてください。
5. **モデルは `ANTHROPIC_MODEL` から取得**し、未設定なら `"claude-sonnet-4-6"` に
   フォールバックします。
6. **エラーは日本語の文字列**で `{ error }` のJSONとして返し、ステータスコードを
   使い分けます(400: バリデーション、500: APIキー未設定や想定外の失敗、502: モデル
   出力の不正)。`Anthropic.APIError` は読みやすいメッセージに変換されます。

クライアントが受け取るレスポンスはキャメルケース(`detectedType`、`viralFactors`、
`sourceText`、`posts`)で、ツールスキーマのスネークケースとは意図的に異なります。
変更するときは両方を同時に更新してください。

## クライアント側の規約(`PostGeneratorForm.tsx`)

- 状態はすべてローカルの `useState` です。状態管理ライブラリも Server Actions も
  使っていません。フォームは `FormData` を `/api/generate` に POST し、返ってきた
  JSON を描画します。
- 画像プレビューのオブジェクトURLは、差し替え前に `selectFile` 内で revoke して
  います。
- クリップボードへのコピーは共有の `copyTimeoutRef` を使い、「コピーしました!」を
  1.5秒だけ表示します。タイマーを1つ使い回しているため、個別コピーと全コピーの
  表示は互いに打ち消し合います(意図した挙動です)。
- **色に関するユーティリティには必ず `dark:` の指定を対にしてください。** 読みづら
  いダークモードを修正するためだけのコミットが履歴に2つあります。ダークモードは
  `prefers-color-scheme` によるもので、トグルも `class` 戦略も使っていません。body
  には既に `bg-white dark:bg-gray-950` が指定されています。
- プレビューの `<img>` は素のタグで、`// eslint-disable-next-line @next/next/no-img-element`
  をインラインで付けています。ここでは blob URL を `next/image` に渡せないためです。

## ドキュメント

`README.md` は利用者向けの説明(機能・セットアップ・環境変数・入力制限)を扱い、
このファイルは実装上の規約と設計判断を扱います。API のフィールドや入力の上限値を
変更したときは、`README.md` の該当箇所も更新してください。

## シークレット

`ANTHROPIC_API_KEY` はルートハンドラの内部でのみ読み込まれ、クライアントには一切
公開されません。`.env*` は `.env.example` を除いて gitignore されています。この値を
`NEXT_PUBLIC_*` の変数に入れたり、クライアントコンポーネントから Anthropic SDK を
呼び出したりしないでください。
