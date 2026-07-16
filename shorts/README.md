# YouTubeショート自動生成キット(顔出し・声出しなし)

編集ソフトを使わずに、縦型ショート動画(1080x1920)のmp4を自動生成するプロジェクトです。

## できあがるもの

- `out/short.mp4` … 完成動画(約50秒、13シーン)
- ナレーション:無料の音声合成(Open JTalk・女性の声「メイ」)
- テロップ:Zen Maru Gothic 極太・黒フチ・フェードイン
- 背景:動くミステリアス背景5種(霧/星空/波紋/鏡/ろうそく)
- BGM:自動生成のダークアンビエント(差し替え可能)

## 初回セットアップ(コピペでOK)

```bash
cd shorts
npm install                      # 動画エンジン(Remotion)を入れる
python3 -m venv .venv            # 音声合成用のPython環境を作る
.venv/bin/pip install pyopenjtalk-plus numpy soundfile

# フォントをパソコンにインストールする(初回のみ)
# Mac/Windowsなら public/fonts/ の2つのttfをダブルクリックして「インストール」。
# Linuxなら:
mkdir -p ~/.fonts && cp public/fonts/*.ttf ~/.fonts/ && fc-cache -f
```

## 動画を作る手順(4コマンド)

```bash
.venv/bin/python tools/make_voice.py   # 1. ナレーション音声を一括生成
.venv/bin/python tools/make_bgm.py     # 2. BGMと効果音を生成(初回のみでOK)
node tools/build_props.mjs             # 3. シーン割り(props.json)を自動計算
npx remotion render src/index.ts ShortVideo out/short.mp4 --props=src/props.json --codec=h264
```

プレビューしたいときは `npm run studio` でブラウザ画面が開きます。

## 🏆ランキング型テンプレ(「仕事が消えるAI帳」ブランド仕様)

明るい文具系デザインの縦型ランキング動画(カウントダウン構成)を生成します。
ブランド4色(`src/brand.ts`)・順位札・実測タイム演出・消しゴムキャラのワイプ遷移入り。

```bash
.venv/bin/python tools/make_voice.py script_ranking.json public/audio_ranking  # 1. 音声生成
node tools/build_props_ranking.mjs                                             # 2. シーン割り
npx remotion render src/index.ts RankingVideo out/ranking.mp4 --props=src/props_ranking.json --codec=h264
```

台本は `script_ranking.json`。各シーンの `role` で演出が切り替わります:

| role | 演出 |
|------|------|
| `hook` | 冒頭フック(大テロップ+黄ブロブ) |
| `rank` | 順位札(`rank`)+ツール名(`headline`)+消しゴムワイプ+SE |
| `body` | 本文。`time: {before, after, label}` を付けると実測タイム演出(グレー打ち消し→オレンジ特大) |
| `save` | 保存誘導(消しゴムキャラ登場・黄背景) |
| `cta` | 締め(コメント誘導) |

テロップ内の `**単語**` は黄色マーカー強調になります。
1位の順位札だけ自動でオレンジ(`rank: 1`)。

## ⚡逆張り型・💬体験談型テンプレ

同ブランドの派生テンプレ。汎用ビルダー(`tools/build_props_generic.mjs`)を使います。

```bash
# ⚡逆張り型(ネイビー基調・議論誘発): hook / body / point(①②③) / flip / vs(対決画面)
.venv/bin/python tools/make_voice_google.py script_contra.json public/audio_contra
node tools/build_props_generic.mjs script_contra.json audio_contra src/props_contra.json
npx remotion render src/index.ts ContrarianVideo out/contra.mp4 --props=src/props_contra.json --codec=h264

# 💬体験談型(検証ノート風): day(Dayスタンプ) / story / big(数字ドン) / rule(3か条) / line(LINE誘導)
.venv/bin/python tools/make_voice_google.py script_story.json public/audio_story
node tools/build_props_generic.mjs script_story.json audio_story src/props_story.json
npx remotion render src/index.ts StoryVideo out/story.mp4 --props=src/props_story.json --codec=h264
```

- ⚡のvsシーンは `"vs": {"left": "課金派", "right": "無料派"}` で対決ラベル指定
- 💬のlineシーンは `"keyword": "メモ"` で合言葉指定
- 💬体験談は実体験ベースで書くこと(盛らない)。ナレーションは肉声推奨

## ナレーションの読み方の注意(Google TTS)

英略語は読み間違えることがあるためカタカナで書く:
AI→エーアイ、OCR→オーシーアール、freee→フリー。
数字(60分・19秒など)はそのままでOK。
声の変更は `tools/make_voice_google.py` の `VOICE` を編集
(現在: ja-JP-Chirp3-HD-Aoede=温かみのある女性声)。

## 台本を変えたいとき

`script.json` を書き換えて、上の4コマンドをもう一度実行するだけです。
- `narration` = 読み上げる文(読み間違えそうな漢字はひらがなに)
- `telop` = 画面に出す文字(10字前後)
- `telop_style` = `"paren"` にすると小さめの補足トーン

## 音声を高音質にしたいとき(Google Cloud TTS)

1. Google Cloud コンソールで「Text-to-Speech API」を有効化し、APIキーを発行
2. 次を実行(声は ja-JP-Chirp3-HD-Orus):

```bash
GOOGLE_TTS_API_KEY=あなたのキー .venv/bin/python tools/make_voice_google.py
node tools/build_props.mjs
npx remotion render src/index.ts ShortVideo out/short.mp4 --props=src/props.json --codec=h264
```

## 背景を実写動画にしたいとき(Pexels)

1. https://www.pexels.com/api/ で無料APIキーを発行
2. `PEXELS_API_KEY=あなたのキー .venv/bin/python tools/fetch_bg_pexels.py`
3. `public/bg/` に保存された動画を使うよう調整(担当AIに依頼してください)

## BGMを差し替えたいとき

YouTube Audio Library や DOVA-SYNDROME で選んだ曲を
`public/bgm/` に置き、`src/props.json` の `"bgm"` をそのファイル名
(例 `"bgm/mysong.mp3"`)に書き換えて、renderコマンドを再実行。
音量は `"bgmVolume": 0.12` で調整できます(0.1〜0.15推奨)。

## クレジット表記

- 音声合成:Open JTalk + MMDAgent「メイ」(名古屋工業大学・CC BY 3.0)
  → 概要欄に「音声合成:Open JTalk/MMDAgent(名工大)」と記載してください
- フォント:Zen Maru Gothic(SIL Open Font License)
