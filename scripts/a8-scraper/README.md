# A8.net 案件調査スクリプト

A8.net で「AI」などのキーワードに該当する案件（アフィリエイトプログラム）を検索し、
以下の項目を CSV にまとめるローカル実行用スクリプトです。

- 案件名／ジャンル
- 報酬額（単価）
- 提携形態（即時 or 審査）
- 承認条件
- 確定率

## なぜローカルで動かす必要があるか

この作業を行ったクラウド実行環境（Claude Code on the web）からは、組織のネットワークポリシーにより
`www.a8.net` への接続がブロックされていました。そのため A8.net への実際のログイン・スクレイピングは
**あなたのPC上で** 実行する必要があります。

## 注意：このスクリプトの精度について

一覧ページの実機スクリーンショットを基に、「プログラムID／プログラム開始日／カテゴリ／成果報酬／EPC／確定率／関連キーワード」
という決まったラベル構造から値を取り出しています（案件名・ジャンル・報酬額・確定率・提携形態は一覧ページから直接取得、
承認条件のみ「プログラム詳細を見る」リンク先の詳細ページから取得）。

ただし詳細ページの構造は未確認のため、「承認条件」が空欄になることがあります。実行すると `output/` に
各検索結果ページのスクリーンショット (`list-page*.png`) と HTML (`list-page*.html`) が保存されるので、
空欄が多い場合はこれを見ながら `scrape.js` 内の `extractLabelValue` を調整してください。

## セットアップ

```bash
cd scripts/a8-scraper
npm install
```

## 実行方法

ログインは既定で **手動** です（captcha・確認コードなどに対応するため）。
ブラウザが開いたら自分でログインし、ターミナルで Enter キーを押すと続行します。

```bash
npm run scrape
```

案件詳細ページ（承認条件の取得元）を開く際、A8.net側のセキュリティ仕様で
**再認証（パスワードの再入力）を求められることがあります**。その場合スクリプトは
自動で止まり、ターミナルに案内が出るので、開いているブラウザでパスワードを入力して
認証を完了し、ターミナルで Enter キーを押して続行してください。

検索キーワードや挙動は環境変数で変更できます（例: `A8_KEYWORD="転職エージェント" npm run scrape`）。

| 環境変数 | 説明 | デフォルト |
|---|---|---|
| `A8_KEYWORD` | 検索キーワード | `AI` |
| `A8_MAX_PAGES` | 取得する検索結果ページ数の上限 | `10` |
| `A8_HEADLESS` | `true` にするとブラウザを表示しない（ヘッドレス） | `false` |
| `A8_AUTO_LOGIN` | `true` にすると `A8_ID`/`A8_PASS` を使って自動ログインを試みる（未検証・失敗しやすい） | `false` |
| `A8_ID` / `A8_PASS` | 自動ログイン用（`A8_AUTO_LOGIN=true` のときのみ使用） | - |
| `A8_EMAIL_TO` | 完成したCSVの送り先メールアドレス（指定すると実行完了時に自動送信） | - |
| `A8_EMAIL_FROM` | 送信に使うGmailアドレス | - |
| `A8_EMAIL_APP_PASSWORD` | 上記Gmailの「アプリパスワード」（後述） | - |
| `A8_SCHEDULED` | `true` にすると予約実行モード（後述）。人手の操作が必要になった時点でアラートメールを送って中断する | `false` |
| `A8_STATE_FILE` | ログイン状態(Cookie)の保存先ファイルパス | `scripts/a8-scraper/.auth-state.json` |

**ログイン情報はコード中に書き込まないでください。** 自動ログインを使う場合も環境変数経由で渡し、
`.env` 等に保存する場合は Git にコミットしないよう `.gitignore` を確認してください。

## 出力

`output/a8-<キーワード>-<timestamp>.csv` に結果が出力されます。Excel や Google スプレッドシートで
直接開けます（UTF-8 BOM 付きなので日本語もそのまま表示されます）。

## 完成したCSVを自動でメール送信する（任意・スマホで結果を見たい場合など）

`A8_EMAIL_TO` / `A8_EMAIL_FROM` / `A8_EMAIL_APP_PASSWORD` の3つを設定すると、
実行完了時に自動でGmail経由でCSVを添付メール送信します。設定しなければ何も送信されず、
従来どおりCSVが `output/` に保存されるだけです。

### 1. Gmailのアプリパスワードを発行する

通常のログインパスワードはこの用途には使えません。以下の手順でアプリ専用パスワードを発行してください。

1. 送信に使うGmailアカウントで [2段階認証を有効化](https://myaccount.google.com/signinoptions/two-step-verification)（未設定の場合）
2. https://myaccount.google.com/apppasswords にアクセス
3. 名前（例: `a8-scraper`）を入力して「作成」
4. 表示された16桁のパスワード（スペース入りでOK）をコピー

### 2. `.env` ファイルを作成する

`scripts/a8-scraper/.env` というファイルを作成し、以下のように記入します
（このファイルは `.gitignore` で除外されるため Git にはコミットされません）。

```
A8_EMAIL_TO=自分のメールアドレス@gmail.com
A8_EMAIL_FROM=送信に使うGmailアドレス@gmail.com
A8_EMAIL_APP_PASSWORD=発行したアプリパスワード
```

`A8_EMAIL_TO` と `A8_EMAIL_FROM` は同じアドレス（自分宛）でも問題ありません。

### 3. 初回のみ依存パッケージを取得し直す

```bash
cd scripts/a8-scraper
npm install
```

### 4. いつものように実行する

```bash
npm run scrape
```

完了時にターミナルに `メールを送信しました: ...` と表示されれば送信成功です。
スマホのGmailアプリで確認できます。

## 定期的に自動実行する（毎週など・人が操作しなくても実行）

このスクリプトはA8.netへのログインが必要なため、完全な自動実行には「ログイン状態の保持」が必要です。
以下の仕組みで対応しています。

- 1回手動でログインすると、その状態（Cookie）が `scripts/a8-scraper/.auth-state.json` に保存される
- 次回以降はそのファイルを読み込んでログイン操作をスキップする
- A8.net側のセッションが切れて再ログインが必要になった場合は、処理を中断してアラートメールを送る
  （`A8_EMAIL_TO` 等を設定している場合。件名: `A8scraper: 再ログインが必要です`）
  → メールが来たら、Macで `npm run scrape` を手動実行してログインし直してください

**前提：Macが起動している（スリープ・シャットアウトしていない）時間帯にしか実行されません。**
ノートPCを閉じている時間に予約しても実行されないので、普段Macを使っている時間帯に合わせてください。

### 1. 最初に1回、手動でログイン状態を保存する

```bash
cd scripts/a8-scraper
npm run scrape
```

普段どおりログイン・Enterキーで進めて完了させてください。これで `.auth-state.json` が作成されます
（このファイルは `.gitignore` で除外されているのでGitにはコミットされません。他人に渡さないよう注意してください）。

### 2. Node.jsの場所を確認する

予約実行はターミナルのPATH設定を経由しないため、`node`コマンドの場所をあらかじめ確認しておきます。

```bash
which node
```

例: `/usr/local/bin/node` や `/opt/homebrew/bin/node` のように表示されます。この結果を次の手順で使います。

### 3. 予約設定ファイル（launchd）を作成する

`~/Library/LaunchAgents/com.a8scraper.weekly.plist` というファイルを作成します。

```bash
mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/com.a8scraper.weekly.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.a8scraper.weekly</string>
  <key>ProgramArguments</key>
  <array>
    <string>NODE_PATH_HERE</string>
    <string>/Users/takahiro/Documents/GitHub/takahiro/scripts/a8-scraper/scrape.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/takahiro/Documents/GitHub/takahiro/scripts/a8-scraper</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>A8_KEYWORD</key>
    <string>AI</string>
    <key>A8_HEADLESS</key>
    <string>true</string>
    <key>A8_SCHEDULED</key>
    <string>true</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key>
    <integer>1</integer>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/takahiro/Documents/GitHub/takahiro/scripts/a8-scraper/output/scheduled.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/takahiro/Documents/GitHub/takahiro/scripts/a8-scraper/output/scheduled.log</string>
</dict>
</plist>
EOF
```

作成後、`NODE_PATH_HERE` の部分を手順2で確認した実際のパスに書き換えてください
（テキストエディタで開いて直接書き換えるか、以下のように `sed` で置き換えてもOKです。
`/usr/local/bin/node` の部分は自分の環境の実際のパスに変えてください）。

```bash
sed -i '' 's#NODE_PATH_HERE#/usr/local/bin/node#' ~/Library/LaunchAgents/com.a8scraper.weekly.plist
```

上記の設定は「毎週月曜9:00」に実行されます（`Weekday`: 0=日, 1=月, ... 6=土）。曜日・時刻を変えたい場合は
`Weekday` / `Hour` / `Minute` の数値を書き換えてください。検索キーワードを変えたい場合は
`A8_KEYWORD` の値を書き換えてください。

### 4. 予約を有効化する

```bash
launchctl load ~/Library/LaunchAgents/com.a8scraper.weekly.plist
```

これで毎週自動的に実行され、完了するとCSVがメールで届くようになります（Macが起動していれば）。

### 5. 確認・停止のしかた

```bash
# 今すぐ1回テスト実行する（予約を待たずに動作確認したい場合）
launchctl start com.a8scraper.weekly

# 実行ログを見る
cat output/scheduled.log

# 予約を停止したい場合
launchctl unload ~/Library/LaunchAgents/com.a8scraper.weekly.plist
```
