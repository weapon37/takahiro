# 背景シンクロ 標準ルール & 素材語彙

## 自作素材(own_*)の取り込み設定 ※重要

iPhoneの縦動画はHDR(HLG/bt2020)。SDRへ変換する際、**npl(想定ピーク輝度)を誤ると退色する**。
`npl=100` だと彩度がほぼ半分に落ち、ひまわりが白っぽくなる等の失敗が起きた。**`npl=1000` を使う。**
色は加工せずナチュラルな発色のまま取り込むこと（意図的な色調整はしない）。

```bash
VF="zscale=t=linear:npl=1000,format=gbrpf32le,zscale=p=bt709,tonemap=hable,\
zscale=t=bt709:m=bt709:r=tv,format=yuv420p,\
scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280"

npx remotion ffmpeg -nostdin -y -t 6 -i <元動画> -vf "$VF" \
  -r 60 -an -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart public/bg/own_xxx.mp4
```

- 元がSDR(bt709)の場合はtonemap不要。`scale`＋`crop`だけでよい。
- HDR判定: `ffprobe` の出力に `bt2020` / `arib-std-b67` / `smpte2084` が含まれるか。
- 既存プールは 720x1280 / 60fps / SDR に統一。


**原則(標準):** 全ての新規動画は、背景を「プール順送り」ではなく **文ごとに内容と一致させる**。
台本の各 sentence に `"bg"` を付ける。話している言葉を1つずつ映像にリンクさせること。

## 書き方

```json
{ "role": "point", "num": 1, "narration": "...", "telop": "...",
  "bg": ["nb_clock", "nb_morning"] }   // 短縮名でOK → bg/<name>.mp4 に自動補完
```

- `"bg"` は **文字列1つ** でも **配列** でもよい。
- **飽き防止で1文=2カット**を基本(配列で2本)。短い1文なら1本でも可。
- エンジンはシーン尺をカット数で均等割りして順に表示（`bgSync=true`）。指定なしの文は従来のプール巡回にフォールバック。
- 同じ映像を別の文で再利用してよい（意味が合うなら意図的に繰り返すのはむしろ良い）。

## 素材語彙（テーマ → 使えるクリップ）

**使い分けの原則:** `own_*`(自作) と `jp_*`(日本のストック) を両輪で使う。`nb_*` は補助。

- **`own_*` が得意**: 手元の作業、机まわり、暮らし、カメラ機材、時計、ビフォーアフター。
  「自分で撮れるもの」＝チャンネルの署名になる絵。
- **`jp_*` が得意**: **渋谷スクランブル・都会の街並み・ネオン・電車・スカイライン**など、
  自作では撮れないスケールの大きい日本の風景。**引きの絵・都市の説得力が要る場面では積極的に使う。**
  「日本の視聴者に馴染む画」という点で外国素材(`nb_*`)より優先。
- **理想の組み合わせ**: 引き(`jp_*`の街)→ 寄り(`own_*`の手元)。スケールと当事者感が両立する。

| テーマ | クリップ |
|---|---|
| お金・収益・稼ぐ | nb_cash, coins_stack, nb_savings, keiri2, keiri3 |
| 伸び悩み・数字・グラフ | nb_chart, graph_screen |
| 時間・時計・朝 | own_clock（自作・全体＝引き）, own_clock_zoom（自作・寄り。引き→寄りのペアで使える）, nb_clock, calendar, nb_morning, sunrise_city |
| 仕事・PC・デスク | own_typing（自作・タイピングの手元）, typing_laptop, nb_desk, coffee_desk, office_window, jp_desk_m1, nb_code, nb_gadgets, nb_keys |
| ノートに書く・メモ | own_pen_write（自作・ペンで書く手／「人が考える」象徴）, nb_notes, note2, note3 |
| 手を動かす・作業する（自作の手元カット） | own_typing, own_phone_tap, own_pen_write, own_lens_hands, own_tripod |
| ビフォーアフター・片付く・スッキリ | own_desk_timelapse（3.5秒で散らかった机→空の机。1カットで完結）, own_desk_messy（前）, own_desk_clean（後） |
| 散らかる・タスク過多・混乱 | own_desk_messy, own_docs_stack（書類が積み上がる＝仕事が溜まる）, nb_think |
| 書類・事務作業・経理 | own_docs_stack, keiri2, keiri3, nb_notes |
| ノートPCで作業（人物） | jp_laptop_m1, jp_laptop_f1, jp_laptop_f2, jp_cafe_f |
| スマホ・SNS・比較 | own_phone_tap（自作・スマホを操作する指）, sumaho2, sumaho3, nb_phone, nb_social |
| 街・都市（夜・ネオン） | own_neon_street（自作）, own_crossing_night（自作・交差点）, own_city_night（自作・高層ビル）, jp_shinjuku_neon, jp_kabukicho, jp_neon_rain, jp_takeshita, jp_shibuya, city_night, nb_night |
| 街・都市（昼・スケール） | jp_scramble_day, jp_crosswalk_top, jp_shibuya_air, jp_skyline_day, jp_skyline, jp_office_tower, jp_city_dusk, jp_dusk_road, nb_building |
| 人の流れ・世の中・大勢 | own_crossing_night（自作）, jp_commuters, jp_crosswalk_top, jp_scramble_day, jp_station_escalator, jp_mall_escalator |
| 郊外・生活圏の街 | own_street, own_suburb_sky |
| 田舎・移動中の車窓・のどか | own_countryside, own_car_window（車内から／移動中の実感）, own_train_field, jp_train_window |
| 移動・現場へ向かう・出張 | own_fuji_road（富士山＋高速）, own_car_window, own_countryside |
| 静けさ・余白・整う（時間の使い方の回） | own_lotus（蓮の花・寄り）, own_lotus_field（蓮池と山・引き）, own_golf, nb_sky, own_sunflower |
| 歩く・通勤・移動 | jp_commuters, jp_train, jp_train_window, jp_station_escalator, business_walking, nb_walk, subway_commute, nb_train, own_train_field |
| カフェ・コーヒー | own_coffee_pour（注ぐ＝動きあり）, own_coffee_cup, jp_cafe_f, nb_cafe, nb_coffee, coffee_desk |
| 一息つく・ゆとり・朝のはじまり | own_coffee_pour, own_coffee_cup, own_meal, nb_morning |
| 暮らし・ゆとり・食事 | own_unaju（自作・うな重＝ご褒美/贅沢）, own_meal, jp_sushi, jp_home_read, own_sparrow, nb_plant |
| 悩み・思考・停滞 | nb_think, nb_rain, own_rain_road |
| 一歩ずつ積み上げる・道のり・継続 | **own_stone_steps**（足元→階段へパン。単独で使うならこれ）, own_stone_steps_wide（引き・階段全体）, own_stone_steps_close（寄り・踏面の質感）, own_steps_climbing（登りながら＝一段ずつ進む動き）, own_forest_trail（自作・山道の岩混じりの地面。足元アングル。荒れた道のり感）, own_street, jp_dusk_road |
  ↑ 1文2カットなら **wide（引き）→ climbing（登る）** が最も動きが出る。
  「先が見えない道のり」→「それでも一段ずつ」。closeは静かに質感を見せたいときに。
| 育てる・手をかける・収穫（継続の比喩） | own_field_pumpkin, own_eggplant, own_flowers_garden |
| チーム・発信・信頼 | nb_team, handshake, nb_social |
| 富士山（元カメラマンの署名と揃う） | own_fuji_road, own_camera |
| カメラ（元カメラマンの署名） | own_lens_hands（レンズを構える手・最も寄り）, own_lens_adjust（レンズを操作する手）, own_camera_rig（マイク付き機材の全体）, own_tripod（三脚を操作する手）, own_camera（富士山＋三脚・遠景）, nb_camera |
| 昔は手作業だった／段取り・準備 | own_tripod, own_camera_rig, own_camera |
| 手先の技・人にしかできない仕事 | own_lens_hands, own_lens_adjust |
| 自然・情景（間・締め） | own_golf, own_heron, own_deer_shrine（自作・神社境内の鹿・苔むした石垣。癒し/静寂の一枚に強い）, nb_sky, nb_bokeh, nb_art, nb_particles, own_sunflower, own_sunflower2, own_canal |
| 郊外・日常の現実（空の余白＝テロップ向き） | own_suburb_sky, own_street |

## 割り当ての考え方

1. **名詞を拾う**：文中のキーワード（お金/時間/スマホ/街…）を映像に直訳。
2. **2カットは「前半→後半」で意味を繋ぐ**：例「続けてないだけ」→ own_street(歩き続ける) → jp_dusk_road(道が続く)。
3. **抽象語**（発信・段階・判断）は象徴で：発信=nb_social、段階=jp_skyline(俯瞰)。
4. **日本の絵を優先**：視聴者に馴染む jp_/own_ を軸に、tech寄りは nb_ で補う。

## 実例：w2d7_pm_kasegenai（このルールの基準サンプル）

hook 稼げない→[nb_cash, nb_chart] / body 続けてない→[own_street, jp_dusk_road] /
point1 収益狙い→[nb_savings, nb_think] / point2 比較→[nb_phone, nb_social] /
point3 時間→[nb_clock, nb_morning] / body 時間が返る→[own_meal, jp_home_read] /
flip 時短→発信→[jp_desk_m1, nb_social] / vs 段階→[jp_skyline, jp_shibuya_air]
