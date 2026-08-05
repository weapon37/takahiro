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

## 2チャンネル運用(ブランドの切り替え)

テンプレ(🏆⚡💬)は**全チャンネル共通**。見た目の違いは `src/brand.ts` のブランド定義だけで切り替わる。

| ブランドキー | チャンネル | 配色 | マスコット |
|------|------|------|------|
| `ai`(既定) | 仕事が消えるAI帳 | 青×黄×オレンジ(明るい文具系) | 消しゴムキャラ |
| `home` | 住まいの言い方帳(引っ越し・住宅) | 深緑×テラコッタ×生成り | 家を背負ったヤドカリ |

マスコットは**シルエットから別物にする**こと。色だけ変えても、サムネサイズだと
同じキャラの色違いにしか見えない(消しゴムキャラ=縦長の角丸+点目2つ+にっこり口)。
ヤドカリは「家そのものを背負って引っ越す」= このチャンネルの主題をそのまま形にしている。

テンプレは4種。`template` フィールドでコンポジションが決まる。

| 型 | コンポジション | 役割 |
|---|---|---|
| 📝 セリフ型 | `PhraseVideo` | **住まいチャンネルの主役。**その場で言う一言を渡す |
| 🏆 ランキング型 | `RankingVideo` | 網羅・保存用のチェックリスト |
| ⚡ 逆張り型 | `ContrarianVideo` | 常識の否定で議論を起こす |
| 💬 体験談型 | `StoryVideo` | 信頼の担保。実費を全部公開する |

台本JSONに1行足すだけで切り替わる:

```json
{ "template": "PhraseVideo", "brand": "home", "account": "住まいの言い方帳", ... }
```

台本の置き場所でファイルの名前空間が分かれる(音声・props・出力が衝突しない):

| 台本 | slug | 音声 | props | 出力 |
|------|------|------|------|------|
| `scripts/xxx.json` | `xxx` | `public/audio_xxx` | `src/props_xxx.json` | `out/xxx.mp4` |
| `scripts/home/xxx.json` | `home_xxx` | `public/audio_home_xxx` | `src/props_home_xxx.json` | `out/home_xxx.mp4` |

一括レンダリングはチャンネル単位で絞れる:

```bash
GOOGLE_TTS_API_KEY=xxxx node tools/render_all.mjs           # 全チャンネル
GOOGLE_TTS_API_KEY=xxxx node tools/render_all.mjs home      # 住まいの言い方帳だけ
GOOGLE_TTS_API_KEY=xxxx node tools/render_all.mjs home_day1_am_naiken5  # 1本だけ
```

**チャンネルを増やすとき**は `src/brand.ts` の `BRANDS` に6色+マスコットを足し、
`scripts/<新キー>/` に台本を置くだけ。テンプレ側の改修は不要。
新しいマスコットが要るときだけ `src/common.tsx` にCSS描画の部品を足して
`Mascot` の分岐に追加する。

## Week 1 台本一覧① 仕事が消えるAI帳(scripts/)

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
  (PhraseVideo / RankingVideo / ContrarianVideo / StoryVideo)
- `_note` と `◯◯` がある台本は、**必ず実データに差し替えてから**音声生成すること
- 公開前チェック: 実測値は本物か / PR表記 / AI開示フラグ / 「個人の結果です」注記

## 引っ越し・住まいチャンネル「住まいの言い方帳」(scripts/home/)

**制作前に必ず `scripts/home/CONCEPT.md` を読むこと。** チャンネルの設計はそこが正典で、
コンセプト・ペルソナ・フェーズ設計・CTA設計・法令ガードレール・季節カレンダーが載っている。

コンセプトは一言で**「不動産屋に聞きにくいことを、代わりに全部言語化する」**。
視聴者が損をするのは情報不足ではなく「聞けない・断れない・言い返せない」から。
だから渡すのは知識ではなく**そのまま言えるセリフ**。

- 主戦場は**契約直前**と**退去立ち会い**(金額が動く × 締切が今日明日 × 取り返しがつかない)
- 全台本に**宛名**(「契約前日の人へ」)と**発火条件**(「見積もりが届いたら」)を入れる
- CTAは「コメントで」一律をやめ、フェーズごとにLINE(チェックリスト配布)へ接続する
- **1本につき必ず「免罪符」か「セリフ」を1つ入れる。**知識の列挙だけの台本は書き直し

### 📝セリフ型(PhraseVideo) — このチャンネルの主役

相手のセリフとこちらのセリフをチャット風に対比し、その場で言う一言を渡す型。

| role | 演出 |
|------|------|
| `hook` | 宛名+場面(大テロップ) |
| `said` | 相手のセリフ(左の白い吹き出し・「言われがちなこと」) |
| `phrase` | **こう言う。**大きな引用カード+「このまま言ってOK」バッジ |
| `why` | なぜ効くか(根拠。法令に触れるなら出典をcaptionへ) |
| `back` | 押し返されたときの返し(相手→自分の2段吹き出し) |
| `save` | 保存誘導 |
| `cta` | LINE誘導 |

`said` と `phrase` の文字サイズは**行の文字数から自動調整**される(1文字だけ次行に
落ちるのを防ぐため)。とはいえ**セリフは短く**書くこと——長いセリフは実際に言えない。
目安は1行**12字以内**、全体で2行まで。

```bash
.venv/bin/python tools/make_voice_google.py scripts/home/p01_koushinryo.json public/audio_home_p01_koushinryo
node tools/build_props_generic.mjs scripts/home/p01_koushinryo.json audio_home_p01_koushinryo src/props_home_p01_koushinryo.json
npx remotion render src/index.ts PhraseVideo out/home_p01_koushinryo.mp4 --props=src/props_home_p01_koushinryo.json --codec=h264
```

### セリフ型の台本(p01〜)

| 台本 | フェーズ | 渡すセリフ |
|------|------|------|
| p01_koushinryo.json | ①更新 | 「更新後の賃料、相談できますか」 |
| p02_option.json | ④契約 | 「これは任意ですか」 |
| p03_kansanki.json | ⑤実務 | 「日にちをおまかせにしたら変わりますか」(閑散期限定) |

### Week 1 台本(day1〜day7)

| 台本 | 型 | 内容 | 備考 |
|------|----|------|------|
| scripts/home/day1_am_naiken5.json | 🏆 | 内見でここだけは見ろBEST5 | |
| scripts/home/day1_pm_ekichika.json | ⚡ | 駅徒歩5分だけで選ぶと後悔する | |
| scripts/home/day2_am_kousho3.json | 🏆 | 初期費用を下げる聞き方BEST3 | |
| scripts/home/day2_pm_day0.json | 💬 | 部屋探しDay0宣言 | ⚠実体験に差し替え |
| scripts/home/day3_am_setsubi5.json | 🏆 | 内見で見落とす設備BEST5 | |
| scripts/home/day3_pm_ikkatsu.json | ⚡ | 一括見積もり、送る前にやること | |
| scripts/home/day4_am_taikyo3.json | 🏆 | 退去費用でモメないBEST3 | |
| scripts/home/day4_pm_naiken_ken.json | 💬 | 1日でまとめて内見した日 | ⚠実体験に差し替え |
| scripts/home/day5_am_hiyou5.json | 🏆 | 初期費用の内訳BEST5 | |
| scripts/home/day5_pm_zerozero.json | ⚡ | 敷金礼金ゼロが得か損か | |
| scripts/home/day6_am_souon3.json | 🏆 | 騒音を内見で見抜くBEST3 | |
| scripts/home/day6_pm_kimeta.json | 💬 | 決めた部屋と妥協したところ | ⚠実体験に差し替え |
| scripts/home/day7_am_news.json | 🏆 | 週刊・部屋探しニュースTOP3 | ⚠毎週差し替え |
| scripts/home/day7_pm_toriaezu.json | ⚡ | とりあえず不動産屋は損 | |

制作は既存チャンネルと全く同じ3コマンド:

```bash
.venv/bin/python tools/make_voice_google.py scripts/home/day1_am_naiken5.json public/audio_home_day1_am_naiken5
node tools/build_props_generic.mjs scripts/home/day1_am_naiken5.json audio_home_day1_am_naiken5 src/props_home_day1_am_naiken5.json
npx remotion render src/index.ts RankingVideo out/home_day1_am_naiken5.mp4 --props=src/props_home_day1_am_naiken5.json --codec=h264
```

### このジャンル特有の注意(必ず守る)

住宅・引っ越しは**お金と契約が絡む**ため、AI系より表現規制が厳しい:

- **特定物件の斡旋に踏み込まない**(宅建業法の領域)。一般的な確認ポイントの情報提供に留める
- **断定を避ける**(景表法)。「絶対に安くなる」「業界最安」はNG。「〜のことがあります」で書く
- **交渉系は結果を保証しない**。「必ず下がる」ではなく「聞いてみる価値がある」
- **制度・法令に触れるときは一次情報**(国交省・自治体・公正競争規約)を確認し、captionに出典を書く
- **アフィリエイト(引っ越し見積もり比較など)を入れるならPR表記必須**
- 💬体験談は**実体験ベースのみ**。金額・件数は本物だけを出す

公開前チェック: 実測値は本物か / PR表記 / AI開示フラグ / 「個人の結果です」注記 / 断定表現が残っていないか

## 背景クリップの標準プール② 住まいの言い方帳(12ワード)

住宅チャンネルの背景は**この12本から選ぶ**:

| ファイル | 検索ワード | 合う場面 |
|------|------|------|
| bg/home_empty_room.mp4 | empty apartment room | 内見・空室 |
| bg/home_apartment_tour.mp4 | apartment interior | 部屋の中・間取り |
| bg/home_living_room.mp4 | living room sunlight | 日当たり・暮らし |
| bg/home_kitchen.mp4 | kitchen apartment | 設備・水回り |
| bg/home_balcony_view.mp4 | balcony view | 眺望・階数 |
| bg/home_building.mp4 | apartment building | 物件の外観・構造 |
| bg/home_neighborhood.mp4 | residential street | 周辺環境・治安 |
| bg/home_station_walk.mp4 | walking to station | 駅距離・通勤 |
| bg/home_moving_boxes.mp4 | moving boxes | 引っ越し・荷造り |
| bg/home_house_key.mp4 | house keys | 契約成立・鍵の受け渡し |
| bg/home_contract.mp4 | signing contract | 契約書・特約・書類 |
| bg/home_money.mp4 | calculator money | 初期費用・家賃・計算 |

差し替えは既存チャンネルと同じ:
`PEXELS_API_KEY=xxxx python3 tools/fetch_bg_pexels.py "ワード" home_ファイル名.mp4`

## 背景クリップの標準プール① 仕事が消えるAI帳(12ワード)

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

**読み間違い対策辞書(tools/reading_dict.json)が音声生成時に自動適用される**
(進捗→しんちょく、相殺→そうさい、一人→ひとり等の80語超)。
住宅系の語(内見→ないけん、前家賃→まえやちん、貼り紙→はりがみ、瑕疵→かし等)も収録済み。
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
