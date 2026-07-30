# BGM一覧（ナレーションとの相性を実測）

台本の `"bgm": "bgm/<ファイル名>"` で指定する。

## 測り方

「声とBGMの差（S/N）」＝ 実際のミックス音量（`bgmVolume: 0.1`）で、
ナレーションの声帯域（300〜3400Hz）に対しBGMがどれだけ小さいか。

- **20dB以上** … 余裕あり。どの回でも安心
- **15〜20dB** … 実用上は問題なし
- **15dB未満** … 声が埋もれやすい。BGM音量を下げるか差し替え

※「声帯域の占有率」だけでは判断を誤る（音量を絞れば多少のメロディは問題にならない）。
必ず **実際のナレーションと混ぜたS/N** で判断すること。

## 一覧（S/Nの良い順）

| ファイル | S/N | 尺 | メモ |
|---|---|---|---|
| `bgm/for_our_friends.mp3` | **29.8** | — | 最も安全。Week1/2で最多使用 |
| `bgm/dova_ensolarado.mp3` | **27.9** | 2:16 | DOVA。候補中で最良。長さがありループが自然 |
| `bgm/pawn.mp3` | 26.7 | 3:05 | 持論(⚡)回で多用 |
| `bgm/dova_beach_cocktail.mp3` | 25.0 | 1:17 | DOVA「ビーチアンドカクテル」 |
| `bgm/dova_asahi_lab.mp3` | 24.7 | 1:04 | DOVA「朝日ラボ」。⚠️ オーナー評: **不穏な感じで明るい回に合わない**。前向きな内容には使わない |
| `bgm/dova_chocomint.mp3` | 22.8 | 0:38 | DOVA「チョコミント」。Shortsの尺に近く1周で収まる |
| `bgm/farm_country.mp3` | — | — | 声帯域12%。未使用だが良好の見込み |
| `bgm/dova_cafe_rain.mp3` | 17.7 | 2:11 | DOVA「カフェの雨音」。使えるが余裕少なめ。`bgmVolume` を 0.08 推奨 |
| `bgm/tomorrows_light.mp3` | **18.5** | — | ⚠️ 主旋律が声帯域(62%)。差し替え推奨 |
| `bgm/calm_instrumental.mp3` | — | — | 音量ムラが大きい(24)。ニュース回で使用中 |
| `bgm/paradise.mp3` | — | — | 声帯域42%。未使用 |

## 選定ルール（台本作成時に適用）

BGMは**内容に合わせて選ぶ**。同じ曲が続かないよう、週内で散らす。
※オーナーの好み: **ビーチアンドカクテル**。合う回では優先的に採用する。

| 動画の役割・トーン | 第一候補 | 予備 |
|---|---|---|
| 🏆 ランキング（朝・前向き・軽快） | `dova_beach_cocktail` | `dova_ensolarado`, `for_our_friends` |
| 朝いちばんの回（7:00・一日の始まり） | `dova_beach_cocktail` | `dova_ensolarado`, `for_our_friends` |
| ⚡ 持論・否定・警告（夜・落ち着いた説得） | `pawn` | `dova_ensolarado` |
| 実測・検証（数字を見せる回） | `for_our_friends` | `dova_ensolarado` |
| ニュース（毎週日曜の定番枠） | `dova_ensolarado` | `for_our_friends` |
| しっとり・振り返り・暮らし寄り | `dova_cafe_rain`（`bgmVolume` 0.08） | `farm_country` |
| 短尺（35秒前後で1周させたいとき） | `dova_chocomint` | — |

- `tomorrows_light` は原則使わない（声帯域と競合）。
- 迷ったら **S/Nが高い曲**を選ぶ（`for_our_friends` / `dova_ensolarado`）。

## 注意

- DOVA-SYNDROMEは商用利用可・クレジット表記は原則不要（作曲者が指定している場合は必要）。
  楽曲ごとの規約は配布ページで確認すること。
