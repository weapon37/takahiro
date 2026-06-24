# Takahiro Tools

## X投稿スクショ型分析ツール

バズったX(旧Twitter)投稿のスクリーンショットをアップロードすると、Claude (Anthropic API) が投稿内容を読み取り、あらかじめ定義した12種類の「型」(共感・感情訴求型、ノウハウ・Tips型、ストーリー型など、`src/lib/post-types.ts` 参照)に分類してくれるツールです。分類理由・バズった要因・読み取った本文も併せて表示します。

### 構成

- `src/lib/post-types.ts` — 投稿の型の定義一覧
- `src/app/api/analyze/route.ts` — 画像を受け取りClaude APIで分析するAPIルート
- `src/components/AnalyzerForm.tsx` — アップロードUIと結果表示

## LINEスタンプ量産ツール (`/sticker`)

キャラクターの参照画像とセリフ・キャプション一覧をアップロードすると、Gemini (Google AI) が画風を保ったままスタンプ画像を一括生成し、LINEクリエイターズスタンプの規格に沿って加工した上でZIPにまとめてダウンロードできます。

- 画像種別: メイン画像 (240×240) / トークルームタブ画像 (96×74) / スタンプ画像 (370×320、端から10px余白)
- ファイル名: `main.png` / `tab.png` / `01.png`〜`NN.png`
- 枚数: 8 / 16 / 24 / 32 / 40 枚から選択(デフォルト16枚)

### 構成

- `src/lib/line-sticker-spec.ts` — LINEスタンプの規格(サイズ・枚数・ファイル名)定義
- `src/lib/gemini-image.ts` — Gemini APIで参照画像をもとにスタンプイラストを生成
- `src/lib/sticker-image-processing.ts` — 生成画像をLINE規格サイズ・透過・余白に加工(sharp)
- `src/lib/sticker-zip.ts` — 加工済み画像をZIPにパッケージング(jszip)
- `src/app/api/stickers/generate/route.ts` — 生成〜加工〜ZIP化を行うAPIルート
- `src/components/StickerGeneratorForm.tsx` — アップロードUIとダウンロード

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に ANTHROPIC_API_KEY (X分析ツール用) / GEMINI_API_KEY (LINEスタンプツール用) を設定
npm run dev
```

[http://localhost:3000](http://localhost:3000) でX分析ツール、[http://localhost:3000/sticker](http://localhost:3000/sticker) でLINEスタンプ量産ツールを利用できます。
