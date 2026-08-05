# takahiro

X(旧Twitter)投稿を量産するツールと、[Remotion](https://www.remotion.dev/) でショート動画を作る仕組みが入ったリポジトリです。

- **動画制作 (Remotion)** — React のコードで縦動画・横動画・サムネイルを書き出す
- **投稿量産ツール** — バズった投稿のテキストやスクショから「型」を分析し、同じ型の投稿を生成する Next.js アプリ

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に ANTHROPIC_API_KEY を設定(投稿量産ツールを使う場合のみ)
```

---

## 動画制作 (Remotion)

### まずは動かす

```bash
npm run studio            # Remotion Studio が開く。右ペインから文言を編集できる
npm run render            # 縦動画 (1080x1920) を out/short.mp4 に書き出す
npm run render:wide       # 横動画 (1920x1080) を out/wide.mp4 に書き出す
npm run render:thumbnail  # サムネイル画像を out/thumbnail.png に書き出す
npm run render:all        # 上の3つをまとめて
```

ブラウザで確認したいだけなら、Next.js アプリの `/video` でも同じ動画をプレビューできます(`npm run dev` → http://localhost:3000/video)。JSON を書き換えてその場で構成を試せます。

### コンポジション

| ID | サイズ | 用途 |
| --- | --- | --- |
| `ShortVideo` | 1080×1920 | TikTok / YouTube Shorts / Reels |
| `WideVideo` | 1920×1080 | X / YouTube |
| `Thumbnail` | 1080×1920 (静止画) | カバー画像 |

3つとも同じ props で動きます。`src/remotion/schema.ts` の zod スキーマがそのまま Studio の編集フォームになり、`--props` に渡す JSON の形にもなります。

### 中身を差し替える

文言だけ変えたいなら `src/remotion/data/sample.ts` を編集するか、JSON を用意して渡します。

```bash
npx remotion render ShortVideo out/short.mp4 --props=props.json
```

`props.json` の形は次のとおりです。`points` は1〜8個まで増やせて、**増やした分だけ動画の尺が自動で伸びます**(`Root.tsx` の `calculateMetadata` で計算しているので、フレーム数を手で直す必要はありません)。

```jsonc
{
  "theme": "midnight",                 // midnight | sunrise | forest
  "hook": {
    "badge": "AI副業",
    "title": "月5万円を\nAIで作る手順",   // \n で改行
    "subtitle": "特別なスキルは要りません。"
  },
  "points": [
    { "label": "STEP 01", "title": "売るものを\n決めない", "body": "最初に商品を作るから止まる。" }
  ],
  "outro": {
    "message": "今日の1投稿が\n30日後の収入になる",
    "cta": "保存してやってみる",
    "handle": "@your_account"
  },
  "timing": {
    "hookInSeconds": 3.5,
    "pointInSeconds": 4,
    "outroInSeconds": 3.5
  }
}
```

### ディレクトリ構成

```
remotion.config.ts            レンダリング共通設定(コーデック・画質・出力先)
src/remotion/
  index.ts                    エントリポイント (registerRoot)
  Root.tsx                    コンポジションの登録。サイズと fps はここ
  schema.ts                   props の型(zod)と尺の計算
  theme.ts                    配色テーマ
  fonts.ts                    フォント読み込み
  animations.ts               spring のプリセットと共通フック
  data/sample.ts              デフォルトの文言
  components/                 背景・カード・テキスト演出などの部品
  scenes/                     フック / ポイント / 締めの各シーン
  compositions/               シーンをつないだ動画本体
```

### よくある編集

- **色を変える** — `src/remotion/theme.ts` にテーマを足すと、Studio のテーマ選択にもそのまま出てきます
- **シーンを足す** — `src/remotion/scenes/` に作り、`compositions/ShortVideo.tsx` の並びに差し込みます。切り替え効果は `@remotion/transitions` を使っています
- **フォントを変える** — `src/remotion/fonts.ts` の import を `@remotion/google-fonts/<フォント名>` に変えるだけです
- **解像度を変える** — `Root.tsx` の `width` / `height` を変えれば、レイアウトは短辺基準で自動的にスケールします

### 注意点

- 初回レンダリング時に Google Fonts (Noto Sans JP) を取得するため、**ネットワーク接続が必要**です。オフラインで回したい場合はフォントファイルを `public/` に置き、[`@remotion/fonts`](https://www.remotion.dev/docs/fonts) の `loadFont` で読み込む形に `fonts.ts` を書き換えてください
- 日本語フォントは Google 側で100以上のチャンクに分割配信されるため、レンダリング時のフォント取得リクエスト数が多くなります(仕様どおりの動作です)
- 書き出し先の `out/` は Git 管理外です
- `@remotion/*` のバージョンは互いに一致している必要があるため、`package.json` では固定バージョンで指定しています

---

## 投稿量産ツール (Next.js)

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いて、バズった投稿のテキストかスクリーンショットを入力すると、型を分析して同じ型の投稿を生成します。

- `src/lib/post-types.ts` — 投稿の型の定義一覧
- `src/app/api/generate/route.ts` — Claude API で分析・生成する API ルート
- `src/components/PostGeneratorForm.tsx` — 入力UIと結果表示

## その他のコマンド

```bash
npm run build      # Next.js のビルド
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```
