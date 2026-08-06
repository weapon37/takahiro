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
| scripts/w2d7_am_news2.json | 🗞️ | 今週のAIニュースTOP3 2026/8/2週 | 43.6s |
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

## Week 4 台本一覧(8/13〜8/18・11本 + ニュース1本)

ラインナップと配分の根拠は `week4_plan.md`、概要欄は `week4_publish.md`。
**#3(週刊ニュース・8/14朝)だけ未作成。** 投稿週のニュースで8/13に書く。

| 台本 | # | 投稿 | 型 | 内容 | 尺 |
|------|---|------|----|------|----|
| scripts/w4a_jinji.json | #1 | 8/13(木) 7:00 | 🏆 | 職業別・入れるべきAI BEST3【人事・採用編】 | 39.3s |
| scripts/w4d_kikeba.json | #2 | 8/13(木) 21:00 | ⚡ | 「AIに聞けばいい」で止まる人へ | 30.7s |
| scripts/w4e_koukai.json | #4 | 8/14(金) 21:00 | 🏆 | 課金して後悔したAIツールの共通点BEST3 | 38.1s |
| scripts/w4f_tasukatta.json | #5 | 8/15(土) 7:00 | 🏆 | 元カメラマンが、AIで一番助かった作業BEST3 | 40.4s |
| scripts/w4g_jitanowari.json | #6 | 8/15(土) 21:00 | ⚡ | 「時短できた」で終わる人が損してる理由 | 33.3s |
| scripts/w4h_uita.json | #7 | 8/16(日) 7:00 | 🏆 | AIで浮いた時間、何に使うかBEST3 | 36.3s |
| scripts/w4b_kyouin.json | #8 | 8/16(日) 21:00 | 🏆 | 職業別・入れるべきAI BEST3【教員・講師編】 | 40.3s |
| scripts/w4i_asai.json | #9 | 8/17(月) 7:00 | 🏆 | AIの答えが浅いときに足す一言BEST3 | 37.0s |
| scripts/w4j_kangaeru.json | #10 | 8/17(月) 21:00 | ⚡ | AIを使うほど、考える時間は増えます | 34.0s |
| scripts/w4k_shashin.json | #11 | 8/18(火) 7:00 | 🏆 | 元カメラマンが選ぶ、写真・動画AI BEST3 | 40.6s |
| scripts/w4c_tenpo.json | #12 | 8/18(火) 21:00 | 🏆 | 職業別・入れるべきAI BEST3【店舗・小売編】 | 37.4s |

> ⚠ **紛らわしい別物が同居している。**
> `w4a_yomichigai` / `w4b_hdr_iro` / `w4c_bgm_suuchi` / `w4d_ridatsu_dani` /
> `w4e_narration_kotsu` / `w4f_telop_kotsu` / `w4g_bgsync_kotsu` の7本は
> **このチャンネルの発信軸とは無関係なテスト**で、Week4の本編ではない。
> 接頭辞が同じ(w4a〜w4g)なので、ファイル名は必ず末尾まで確認すること。

## 背景クリップの選び方

**背景は `tools/bg_sync_map.md` の語彙表(テーマ → クリップ名)から選ぶ。**
検索ワードのリストから選ぶ運用ではない。

現在の構成比(実測):

| | own_*(自作) | jp_*(日本のストック) | nb_*(その他ストック) |
|---|---|---|---|
| Week2 | 9 | 11 | 408 |
| Week3 | **79** | 8 | 16 |

**自作素材(own_*)が主役で、Pexelsは補助**という比重に移っている。
自作では撮れない引きの絵(渋谷スクランブル・スカイライン・電車など)は `jp_*` を使い、
tech寄り・抽象的な絵は `nb_*` で補う。撮影が必要な素材は `tools/shot_list.md` を参照。

### 新しくPexelsから取るとき

```bash
.venv/bin/python tools/fetch_bg_pexels.py "検索ワード" ファイル名.mp4
```

- 6秒未満のクリップは自動で除外される
- 日本の映像が欲しいときは `Tokyo` / `Japan` / `asian` を添える(`locale=ja-JP` は付与済み)
- **取得したら `bg_sync_map.md` の語彙表に、クリップ名と一緒に検索ワードを必ず記録する。**
  記録がないと、同じ系統の絵を後から足せなくなる

### 旧プール(後方互換・新規では使わない)

以下は初期に定めた「標準プール12ワード」。**Week3では104カット中1カットしか使われておらず、
実質運用されていない。** 既存台本の互換のために残置。

| ファイル | 検索ワード |
|------|------|
| bg/city_night.mp4 | city night |
| bg/typing_laptop.mp4 | typing laptop |
| bg/business_walking.mp4 | business people walking |
| bg/office_window.mp4 | office window |
| bg/coins_stack.mp4 | coins stack |
| bg/sunrise_city.mp4 | sunrise city |
| bg/subway_commute.mp4 | subway commute |
| bg/handshake.mp4 | handshake |
| bg/calendar.mp4 | calendar |
| bg/coffee_desk.mp4 | coffee desk |
| bg/graph_screen.mp4 | graph screen |
| bg/portrait.mp4 | portrait |

さらに古い keiri* / sumaho* / note* も残置。新規台本では使わない。

`fetch_bg_pexels.py` の既定 `QUERIES`(Tokyo street night ほか5語)は
旧 `ShortVideo` の一括モード専用。現在の制作フローでは呼ばない。

## ナレーションの読み方の注意(Google TTS)

英略語は読み間違えることがあるためカタカナで書く:
AI→エーアイ、OCR→オーシーアール、freee→フリー。
数字(60分・19秒など)はそのままでOK。

**製品名・サービス名は、ナレーションだけカタカナ。テロップと見出し札(`headline`)は
英語表記のまま書く。** 画面に「アストラ」と出すより `OpenAI Astra` のほうが情報として
正確で、既存回(`ChatGPT` / `Notta` / `freee請求書`)とも揃う。
例: narration「アストラを公表」/ headline「OpenAI Astra」

### 誤読が出やすいもの(辞書に登録済み)

- **箇条書きの番号**: ⚡の `point` シーンは narration を「1、」「2、」「3、」で書く。
  「2、」が**「ツー」**と読まれたことがある(w4d_kikeba)。辞書で読みを固定している
- **「1行」**: **「いちこう」**と読まれた。辞書で「いちぎょう」へ置換している
- **「逆」**: **「さか」**と読まれたことがある(w4e_koukai)。逆です/逆だと/逆に/逆の を登録
- **「出させて」**: **「でさせて」**と読まれた(w4f_tasukatta)。出させ/出して/出す/出せ を登録
- 新しい誤読を見つけたら `tools/reading_dict.json` の `readings` に1行足すだけでよい。
  テロップには影響しない

> ⚠ **同じ書き方でも、読まれ方が毎回同じとは限らない。**
> Week3の「1、2、3、」は正しく「いち・に・さん」と読まれていたが、
> Week4の同じ書き方で「ツー」が出た。**誤読の判断はテキストからの推測ではなく、
> 必ず実際の音声を聞いて行うこと。** 辞書登録の価値は「毎回同じ読みに固定できる」点にある。

### 生成時の警告について

`make_voice_google.py` は辞書適用後の文に `_watch` の語が残っていると警告を出す。
**これは「確認すべき箇所」の印であって「壊れている」という意味ではない。**
「書き出し」(かきだし)や「画角」(がかく)のように正しく読まれるものも引っかかる。

### ⚡の締めは疑問形にしない

「あなたはどっちですか。」で終わると、語尾が甲高く間の抜けた音になる。
**「〜か、〜か。コメントで教えてください。」の形にする。**
対比はvsパネルが見せているので、ナレーションで問い返す必要はない。

### 箇条書きの番号は句点で区切る

`point` シーンの「1、2、3、」は辞書で「いち。に。さん。」に置換している。
読点だと番号の直後に間が入らず、特に「さん」が次の語とつながって聞き取れない。
**句点にすると約0.5秒の間が入る**(実測: 2.87秒→3.39秒)。
Chirp3-HDはSSML非対応のため、間の調整は句読点でしか行えない。

### ⚡の対決ラベル(`vs`)は4文字以内にする

`vs` のラベルは5文字以上になると機械的に半分で折り返されるため、
「考えなくなる」→「考えな/くなる」のように語の途中で割れる。
**4文字以内に収めるか、左右で対になる短い語(減る/増える)にすること。**
どうしても長いときは `"left": "聞いて\n終わり"` のように改行位置を自分で指定する。

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
