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

### 書き出しは `--crf=25` を付ける

デフォルトのままだと縦動画1本で11.6Mbps・63MBになり、受け渡しで詰まる。
**`--crf=25` を付けると1/3以下になり、見た目の差はほぼない**
(YouTubeはアップロード後にどのみち再エンコードする)。

```bash
npx remotion render src/index.ts RankingVideo out/xxx.mp4 --props=src/props_xxx.json --codec=h264 --crf=25
```

45.8秒・1080x1920での実測(w2d7_am_news2):

| 設定 | サイズ | ビットレート |
|---|---|---|
| 指定なし(デフォルト) | 63.3 MiB | 11.6 Mbps |
| `--crf=23` | 31.1 MiB | 5.7 Mbps |
| **`--crf=25`** | **23.4 MiB** | 4.3 Mbps |

チャットでファイルを受け渡す場合は30 MiBが上限のため、**45秒前後なら `--crf=25`** が目安。
尺が長い回ではさらに上げる。

大きく書き出してから別途圧縮すると2回エンコードすることになり、そのほうが劣化する。
**サイズを落としたいときは、あとで圧縮せず最初から `--crf` で調整すること。**

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

## Week 1 台本一覧(scripts/)

14本すべて台本JSON化済み。制作は3コマンド(音声→props→render)。

| 台本 | 型 | 内容 | 備考 |
|------|----|------|------|
| scripts/day1_am_best5.json | 🏆 | 副業AIツールBEST5 | |
| script_contra.json | ⚡ | ChatGPT課金要らないかも | Day1夜 |
| script_ranking.json | 🏆 | 経理を消すAI BEST3 | Day2朝 |
| script_story.json | 💬 | Day0宣言・収支¥0 | Day2夜 |
| scripts/day3_am_free5.json | 🏆 | 無料AI最強ランキング | |
| scripts/day3_pm_kouza.json | ⚡ | 30万のAI講座買う前に | |
| scripts/day4_am_jitan.json | 🏆 | 時短ワースト→ベスト | |
| scripts/day4_pm_19byo.json | 💬 | 19秒検証の夜 | ⚠実測値に差し替え |
| scripts/day5_am_sales.json | 🏆 | 職業別BEST3 営業編 | |
| scripts/day5_pm_prompt.json | ⚡ | プロンプト集は無意味 | |
| scripts/day6_am_jimu.json | 🏆 | 職業別BEST3 事務編 | |
| scripts/day6_pm_henka.json | 💬 | 4日目・最初の変化 | ⚠実体験に差し替え |
| scripts/day7_am_news.json | 🏆 | 週刊AIニュースTOP3 | ⚠毎週ニュース差し替え |
| scripts/day7_pm_uso.json | ⚡ | 楽して稼ぐは嘘 | |

制作例(どの台本も同じ3コマンド):

```bash
.venv/bin/python tools/make_voice_google.py scripts/day1_am_best5.json public/audio_d1am
node tools/build_props_generic.mjs scripts/day1_am_best5.json audio_d1am src/props_d1am.json
npx remotion render src/index.ts RankingVideo out/day1_am_best5.mp4 --props=src/props_d1am.json --codec=h264
```

- render の コンポジション名は台本の `"template"` フィールドに合わせる
  (RankingVideo / ContrarianVideo / StoryVideo)
- `_note` と `◯◯` がある台本は、**必ず実データに差し替えてから**音声生成すること
- 公開前チェック: 実測値は本物か / PR表記 / AI開示の扱い / 「個人の結果です」注記
  (AI開示は `week3_publish.md` のメモを参照。一律「はい」にする必要はない)

## Week 2 台本一覧(8/1〜8/7 投稿済み・14本)

概要欄は `week2_publish.md`。1日2本(朝7:00 🏆 / 夜21:00 ⚡)の構成。

| 台本 | 型 | 内容 | 尺 |
|------|----|------|----|
| scripts/w2d1_am_gazou.json | 🏆 | 画像生成AI BEST3【サムネ・素材が10分】 | 44.7s |
| scripts/w2d1_pm_ubawareru.json | ⚡ | 「AIに仕事を奪われる」は半分ウソ | 36.4s |
| scripts/w2d2_am_gijiroku.json | 🏆 | 議事録・文字起こしAI BEST3【会議が消える】 | 43.0s |
| scripts/w2d2_pm_douga.json | 🏆 | 動画編集AI BEST3【元カメラマンが選ぶ】 | 42.5s |
| scripts/w2d3_am_writer.json | 🏆 | 職業別BEST3【ライター編】 | 44.2s |
| scripts/w2d3_pm_salon.json | ⚡ | 有料AIサロン、入る前に見てください | 38.9s |
| scripts/w2d4_am_shiryo.json | 🏆 | 資料・スライド作成AI BEST3【1時間→10分】 | 37.7s |
| scripts/w2d4_pm_marunage.json | ⚡ | AIに丸投げしてはいけない仕事3つ | 39.7s |
| scripts/w2d5_am_designer.json | 🏆 | 職業別BEST3【デザイナー編】 | 40.4s |
| scripts/w2d5_pm_shinjisugi.json | ⚡ | AIの回答、信じすぎると事故ります | 33.7s |
| scripts/w2d6_am_muryo2.json | 🏆 | 全部0円！無料AIランキング【画像・動画編】 | 36.6s |
| scripts/w2d6_pm_100man.json | ⚡ | 「AIで即月収100万」広告の裏側 | 37.3s |
| scripts/w2d7_am_news2.json | 🗞️ | 今週のAIニュースTOP3 2026/8/2週 | 45.8s |
| scripts/w2d7_pm_kasegenai.json | ⚡ | 「AI副業は稼げない」と言う人へ | 37.8s |

> ⚠ `w2d7_am_news2` は8/7放送に合わせて中身を差し替え済み(旧版は7月下旬のニュース・65.6秒)。
> **週刊ニュース枠は毎回、投稿週のニュースに書き直すこと。**

## Week 3 台本一覧(8/8〜8/12 予約投稿済み・9本)

概要欄は `week3_publish.md`、分析シートは `analytics/week3.md`。
全9本が確定フォーマット(否定断定フック / フック直後に1位予告 / 全員対象 / 35〜40秒 /
内容シンクロ1文2カット)で統一されている。

| 台本 | 型 | 内容 | 尺 | 検証している軸 |
|------|----|------|----|--------------|
| scripts/w3a_heranai.json | 🏆 | AIを使っても仕事が減らない理由BEST3 | 37.2s | チャンネルの核(時間の使い方) |
| scripts/w3b_muryo_de_juubun.json | 🏆 | AI、無料版で十分な人の特徴BEST3 | 39.0s | 有料をすすめない誠実路線 |
| scripts/w3c_makasenai.json | 🏆 | 元カメラマンが、AIに任せない仕事BEST3 | 36.9s | 元カメラマンの署名回 |
| scripts/w3d_benkyou.json | 🏆 | AIを勉強してから使う人が損してる理由BEST3 | 38.8s | 遠回りの否定 |
| scripts/w3e_shiji.json | 🏆 | AIの指示、これを足すだけで変わるBEST3 | 36.9s | ツール非依存(腐らない) |
| scripts/w3f_juppun.json | 🏆 | 1日10分でAIを使いこなす人の習慣BEST3 | 34.4s | 時間の使い方 |
| scripts/w3g_isogashii.json | ⚡ | 「忙しくてAIを試す時間がない」人へ | 36.8s | **持論型の再検証①** |
| scripts/w3h_okikae.json | ⚡ | AIに置き換わるのは「仕事」じゃありません | 37.2s | **持論型の再検証②** |
| scripts/w3i_keiri_shokugyou.json | 🏆 | 経理職BEST3【実測あり】 | 36.6s | 職業別シリーズの再現性 |

## Week 4(8/13〜)

ラインナップは `week4_plan.md`。台本は未作成。

> ⚠ `scripts/w4a`〜`w4g` の7本は**このチャンネルの発信軸とは無関係なテスト**。
> Week4の本編には使わない。混同しないこと。

## 背景クリップの標準プール(12ワード)

今後の背景は**この12ワードから各シーンの内容に合うものを選ぶ**(勝手に別ワードを増やさない):

| ファイル | 検索ワード | 合う場面 |
|------|------|------|
| bg/city_night.mp4 | city night | 夜・都会・⚡の緊張感 |
| bg/typing_laptop.mp4 | typing laptop | 作業・ツール操作全般 |
| bg/business_walking.mp4 | business people walking | 仕事・通勤・ニュース |
| bg/office_window.mp4 | office window | オフィス・落ち着いた説明 |
| bg/coins_stack.mp4 | coins stack | お金・課金・収支 |
| bg/sunrise_city.mp4 | sunrise city | 始まり・💬の宣言 |
| bg/subway_commute.mp4 | subway commute | 通勤・忙しさ |
| bg/handshake.mp4 | handshake | 営業・商談・信頼 |
| bg/calendar.mp4 | calendar | 予定・時間・時短 |
| bg/coffee_desk.mp4 | coffee desk | デスク・日常・💬 |
| bg/graph_screen.mp4 | graph screen | データ・実測・分析 |
| bg/portrait.mp4 | portrait | 人物・当事者感 |

- 台本には `"bgClips": ["bg/typing_laptop.mp4", ...]` で5〜6本選んで指定
- 差し替え(取り直し)は `.venv/bin/python tools/fetch_bg_pexels.py "ワード" ファイル名.mp4`
  (6秒未満のクリップは自動で除外される)
- 旧クリップ(keiri*/sumaho*/note*)は後方互換のため残置。新規台本では使わない

## ナレーションの読み方の注意(Google TTS)

英略語は読み間違えることがあるためカタカナで書く:
AI→エーアイ、OCR→オーシーアール、freee→フリー。
数字(60分・19秒など)はそのままでOK。

**製品名・サービス名は、ナレーションだけカタカナ。テロップと見出し札(`headline`)は
英語表記のまま書く。** 画面に「アストラ」と出すより `OpenAI Astra` のほうが情報として
正確で、既存回(`ChatGPT` / `Notta` / `freee請求書`)とも揃う。
例: narration「アストラを公表」/ headline「OpenAI Astra」

**読み間違い対策辞書(tools/reading_dict.json)が音声生成時に自動適用される**
(進捗→しんちょく、相殺→そうさい、一人→ひとり等の40語超)。
台本のnarrationは漢字のまま書いてよい。テロップには影響しない。
辞書に語を足すときはreading_dict.jsonに1行追加するだけ。
「一日」はついたち/いちにちが文脈依存のため自動置換されない——台本側でひらがな指定を。
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
