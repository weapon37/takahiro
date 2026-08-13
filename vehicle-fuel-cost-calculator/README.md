# 車両運行費用按分ツール

マイカーの車両運行表とガソリン代領収書から、運転手2名(A・B)の移動距離按分・費用負担額を計算し、Googleスプレッドシートに直接書き込むPythonツールです。

## できること

- `ocr_driving_log.py` — 運行表を撮影した画像をClaude Vision(Anthropic API)で読み取り、`update_driving_log.py`用のJSONに変換(または直接スプレッドシートに反映)
- `update_driving_log.py` — 日別の運行データ(終了距離数・移動距離・運転手・備考)をスプレッドシートに書き込み、運転手ごとの移動距離(A距離/B距離)をIF数式として、月間合計をSUM数式として自動計算
- `calc_fuel_cost.py` — ガソリン代領収書の金額を距離比で按分し、対象月の運行表シートを参照する数式としてスプレッドシートに書き込み

書き込むセルは数式(SUM・IF)になっているため、あとから運行表のセルを手動修正しても、按分結果は自動的に再計算されます。

---

## 1. Google Cloud側の準備

初回のみ、以下の手順でGoogle CloudとGoogleスプレッドシートの設定を行います。

### 1-1. プロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/) を開く
2. 画面上部のプロジェクト選択メニューから「新しいプロジェクト」を選択
3. プロジェクト名(例: `vehicle-fuel-cost`)を入力して「作成」

### 1-2. Sheets API・Drive APIを有効化

1. 作成したプロジェクトを選択した状態で、左メニューの「APIとサービス」→「ライブラリ」を開く
2. 「Google Sheets API」を検索して選択し、「有効にする」をクリック
3. 同様に「Google Drive API」を検索して選択し、「有効にする」をクリック

### 1-3. サービスアカウントを作成

1. 「APIとサービス」→「認証情報」を開く
2. 「認証情報を作成」→「サービスアカウント」を選択
3. 名前(例: `vehicle-fuel-cost-bot`)を入力して「作成して続行」
4. ロールの付与は不要(スキップ可)なので「完了」まで進む
5. 作成されたサービスアカウントの一覧から、今作ったものをクリック
6. 「キー」タブ→「鍵を追加」→「新しい鍵を作成」→形式は「JSON」を選択してダウンロード
7. ダウンロードしたJSONファイルをこのフォルダに `service-account.json` として保存する(このファイルは`.gitignore`で除外済みなのでコミットされません)
8. JSONファイルの中の `client_email` の値(例: `xxxx@yyyy.iam.gserviceaccount.com`)をメモしておく

### 1-4. スプレッドシートをサービスアカウントに共有

1. 対象のGoogleスプレッドシートを開く
2. 右上の「共有」ボタンをクリック
3. 手順1-3でメモした `client_email` のアドレスを入力し、権限を「編集者」にして共有

### 1-5. スプレッドシートIDを確認

スプレッドシートのURLの中の、`/d/` と `/edit` の間の文字列がIDです。

```
https://docs.google.com/spreadsheets/d/【ここがスプレッドシートID】/edit
```

### 1-6. (OCRを使う場合)Anthropic APIキーを取得

運行表の画像を読み取る `ocr_driving_log.py` を使う場合のみ必要です。

1. [console.anthropic.com](https://console.anthropic.com/) にログイン(なければアカウント作成)
2. 「API Keys」から新しいキーを発行
3. 発行されたキーを控えておく(後述の `.env` に設定)

---

## 2. セットアップ

```bash
cd vehicle-fuel-cost-calculator
python3 -m venv .venv
source .venv/bin/activate   # Windowsの場合: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
```

`.env` を開いて以下を設定します。

```
GOOGLE_SERVICE_ACCOUNT_FILE=./service-account.json
SPREADSHEET_ID=<1-5で確認したスプレッドシートID>
ANTHROPIC_API_KEY=<1-6で発行したキー(OCRを使わない場合は空でよい)>
```

(`.env` の代わりに `config.json.example` をコピーした `config.json` でも同様に設定できます。)

---

## 3. 使い方

### 3-0. (任意)運行表の画像をOCRで読み取る

紙の運行表を撮影した画像から、日別データをJSONとして取り出せます。

```bash
python ocr_driving_log.py --images log1.jpg log2.jpg --sheet 2026.8 --output driving_log.json
```

- 画像は複数枚渡せます(月をまたぐ複数ページの写真など)。同じ日が複数画像に写っていた場合は後の画像を優先します
- 判読できなかったセルや値が不正な行は書き込み対象から除外され、標準エラー出力に一覧表示されます。表示された内容は画像を見ながら手動で確認し、必要であれば出力JSONに追記してください
- 出力される `driving_log.json` は3-1の `update_driving_log.py --data` にそのまま渡せます

内容の確認を挟まず直接スプレッドシートに反映したい場合は `--apply` を付けます(要確認扱いになった項目は書き込まれません)。

```bash
python ocr_driving_log.py --images log.jpg --sheet 2026.8 --apply
```

### 3-1. 運行表データを書き込む

`driving_log.json` を用意します(サンプル: `sample_data/driving_log.json`)。

```json
{
  "sheet": "2026.8",
  "entries": [
    {"day": 1, "end_km": 45228, "distance_km": 18, "driver": "A", "note": "通勤"},
    {"day": 3, "end_km": 45278, "distance_km": 50, "driver": "AB", "note": "買い物・実家"},
    {"day": 5, "end_km": 45303, "distance_km": 25, "driver": "B", "note": "通院"}
  ]
}
```

- `driver` は `A` / `B` / `AB` のいずれか。`AB` の場合はその日の移動距離を1/2ずつA・Bに配分する数式が書き込まれます
- `sheet` は書き込み先のシート名(例: `2026.8`)。シートが存在しなければ自動作成されます
- 1〜31日の全行にヘッダーと数式スケルトンを用意し、`entries`に含まれる日だけ実データを上書きします。含まれない日は既存の内容を保持します

実際に記録した月次データは `data/` に置いています(例: `data/driving_log_2026-08.json`)。`sample_data/` は動作確認用のサンプルです。

```bash
python update_driving_log.py --data sample_data/driving_log.json
```

CSVでも渡せます(この場合はシート名を `--sheet` で指定)。

```bash
python update_driving_log.py --data driving_log.csv --sheet 2026.8
```

実行すると、対象シートの33行目にA距離・B距離の月間合計(SUM数式)が書き込まれます。

### 3-2. ガソリン代按分を計算・書き込む

```bash
python calc_fuel_cost.py --receipts 5427,3293,4011 --month 2026.8
```

JSON/CSVファイルからも渡せます(サンプル: `sample_data/receipts.json`)。

```bash
python calc_fuel_cost.py --receipts-file sample_data/receipts.json --month 2026.8
```

- ガソリン代按分は運行表と**同じタブ**(`--month` で指定したシート)の35行目以降に書き込みます。先に `update_driving_log.py` でそのシートを作成しておく必要があります
- A距離・B距離は同じシートの33行目(月間合計)を数式で参照するため、後から運行表を修正しても按分結果が自動で再計算されます
- 領収書は最大10件です

---

## 4. スプレッドシートのレイアウト

運行表とガソリン代按分は**同じタブ(シート)**に配置します。タブは月ごとに1枚(例: `2026.8`)です。

### 運行表セクション (1〜33行)

| 列 | 内容 |
|---|---|
| A | 日(1〜31) |
| B | 終了距離数(km) |
| C | 移動距離(km) |
| D | 運転手(A/B/AB) |
| E | 備考 |
| F | A距離(km) … `=IF(D="AB", C/2, IF(D="A", C, 0))` |
| G | B距離(km) … `=IF(D="AB", C/2, IF(D="B", C, 0))` |

33行目に月間合計(`SUM`数式)を書き込みます。

### ガソリン代按分セクション (35行以降)

B列に項目名、C列に金額・数式を配置します。

| 行 | 内容 |
|---|---|
| 35 | 「■ ガソリン代按分」見出し |
| 36〜45 | 領収書1〜10の金額(最大10件) |
| 46 | 合計金額 … `=SUM(C36:C45)` |
| 47 | A距離(km) … `=F33` |
| 48 | B距離(km) … `=G33` |
| 49 | A負担額 … `=合計金額 * A距離/(A距離+B距離)` |
| 50 | B負担額 … `=合計金額 * B距離/(A距離+B距離)` |

行位置や列を変更したい場合は `layout.py` を編集してください。

---

## 5. エラーが出たら

- **鍵ファイルが見つからない/形式が不正** → `.env` の `GOOGLE_SERVICE_ACCOUNT_FILE` のパスを確認
- **スプレッドシートが見つからない(404)** → `SPREADSHEET_ID` を確認
- **アクセス権がない(403)** → 1-4の共有設定でサービスアカウントを編集者として追加したか確認
- **運行表シートが見つからない** → 先に `update_driving_log.py` で対象月のシートを作成したか確認
- **金額・距離が数値でない** → データファイルの該当項目を確認(エラーメッセージに何件目のどの項目かが表示されます)
- **`ocr_driving_log.py` で「設定 'ANTHROPIC_API_KEY' が見つかりません」** → 1-6の手順でAPIキーを発行し、`.env`(または`config.json`)に設定
- **`ocr_driving_log.py` で「読み取り結果をJSONとして解釈できませんでした」** → 画像が不鮮明・表の形式が想定と大きく異なる可能性があります。応答内容がエラーメッセージに表示されるので内容を確認してください
