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

日本素材=`jp_*` / 自作=`own_*` を優先的に。合うものが無ければ `nb_*` や説明名クリップ。

| テーマ | クリップ |
|---|---|
| お金・収益・稼ぐ | nb_cash, coins_stack, nb_savings, keiri2, keiri3 |
| 伸び悩み・数字・グラフ | nb_chart, graph_screen |
| 時間・時計・朝 | nb_clock, calendar, nb_morning, sunrise_city |
| 仕事・PC・デスク | typing_laptop, nb_desk, coffee_desk, office_window, jp_desk_m1, nb_code, nb_gadgets, nb_keys |
| ノートに書く・メモ | nb_notes, note2, note3 |
| ノートPCで作業（人物） | jp_laptop_m1, jp_laptop_f1, jp_laptop_f2, jp_cafe_f |
| スマホ・SNS・比較 | sumaho2, sumaho3, nb_phone, nb_social |
| 街・都市・現実 | jp_shibuya, jp_shibuya_air, jp_skyline, jp_dusk_road, jp_neon_rain, city_night, nb_building, nb_night, own_street |
| 歩く・通勤・移動 | business_walking, nb_walk, jp_train, subway_commute, nb_train, own_train_field |
| カフェ・コーヒー | jp_cafe_f, nb_cafe, nb_coffee, coffee_desk |
| 暮らし・ゆとり・食事 | own_meal, jp_sushi, jp_home_read, own_sparrow, nb_plant |
| 悩み・思考・停滞 | nb_think, nb_rain, own_rain_road |
| 育てる・手をかける・収穫（継続の比喩） | own_field_pumpkin, own_eggplant, own_flowers_garden |
| チーム・発信・信頼 | nb_team, handshake, nb_social |
| カメラ（元カメラマンの署名） | own_camera, nb_camera |
| 自然・情景（間・締め） | own_golf, own_heron, nb_sky, nb_bokeh, nb_art, nb_particles, own_sunflower, own_sunflower2, own_canal |
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
