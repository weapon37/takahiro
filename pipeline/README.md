# ショート動画 自動生成・予約投稿パイプライン

「常に3日分の予約投稿をストックしておく」ための自動化スクリプトです。

`pipeline.py` を実行するたびに、次のことが自動で行われます。

1. いま未来の予約がいくつ埋まっているかを数える
2. 目標(3日分 × 1日2本 = 6本)に足りない分だけ作る
3. 「ネタ決め → 台本 → 動画生成 → 予約投稿」を順番に実行する
4. 公開日時は、空いている次の投稿枠(朝7時 / 夜21時)に自動で割り当てる
5. 使ったタイトルを履歴に記録し、次回以降のネタ被りを避ける
6. 1本失敗しても残りは続行し、経過をログファイルに残す

動画づくりとYouTube投稿そのものは、**あなたが既に作った既存のスクリプト**を呼び出します。
このパイプラインは「いつ・何本・どのネタで動かすか」を管理する司令塔です。

---

## 準備

以下のコマンドを、**上から順に1つずつ**ターミナルに貼り付けて Enter を押してください。

### 手順1: このフォルダに移動する

`pipeline` フォルダを、動画スクリプトが入っているフォルダの中に置いておくと分かりやすいです。
移動するコマンドは、実際に置いた場所に合わせて書き換えてください。

```bash
cd ~/shorts/pipeline
```

うまく移動できたか確認します。

```bash
pwd && ls
```

`pipeline.py` という文字が表示されればOKです。

### 手順2: 必要なライブラリを入れる

```bash
pip3 install anthropic
```

### 手順3: 設定ファイルを作る

見本ファイルをコピーします。

```bash
cp pipeline.config.example.json pipeline.config.json
```

コピーしたファイルをテキストエディットで開きます。

```bash
open -e pipeline.config.json
```

開いたら、**`"steps"` の中身**を、あなたの既存スクリプトを呼び出すコマンドに書き換えてください。
ここが唯一、必ず書き換えが必要な場所です。

書き換えるポイントは3つだけです。

- `"cwd"` … あなたの動画スクリプトが入っているフォルダのフルパス
- 1つ目の `"command"` … 動画を1本作って書き出すコマンド
- 2つ目の `"command"` … YouTubeへ予約投稿するコマンド

`{script_file}` `{title}` `{publish_at}` のような `{ }` の部分は、実行時に自動で中身が入ります。
どんな `{ }` が使えるかは、設定ファイル内の `_placeholders` に一覧があります。

> **`{publish_at}` が予約投稿の肝です。** これは `2026-08-10T12:00:00Z` のような形式(UTC)で、
> YouTube API の `publishAt` にそのまま渡せる形になっています。
> あなたの投稿スクリプトが「公開日時」を受け取れるようになっていない場合は、
> 先にそちらへ引数を1つ足してください。

投稿枠や本数を変えたいときは、同じファイルの上のほうを書き換えます。

| 設定項目 | 意味 | 初期値 |
|---|---|---|
| `slots` | 1日の投稿枠(時刻) | `["07:00", "21:00"]` = 1日2本 |
| `buffer_days` | 何日分ストックしておくか | `3` |
| `max_per_run` | 1回の実行で作る本数の上限 | `3` |
| `lead_minutes` | 今から何分後以降の枠を使うか | `90` |
| `theme` / `audience` | AIにネタを考えさせるときのテーマと想定視聴者 | AI副業 |

### 手順4: APIキーを登録する

ネタと台本をAIに考えさせるため、Anthropic の APIキーを登録します。

```bash
echo 'ANTHROPIC_API_KEY=ここにあなたのAPIキー' > .env
```

`ここにあなたのAPIキー` の部分を、実際のキー(`sk-ant-` で始まる文字列)に置き換えてから実行してください。

> **なぜ .env に書くのか**: 後で自動実行(launchd)に登録すると、普段ターミナルで使っている
> 環境変数が読み込まれません。このファイルに書いておけば、自動実行のときも読み込まれます。

登録できたか確認します(キーの一部が表示されればOK)。

```bash
cat .env
```

---

## 手動で1回テストする

### テスト1: 何も実行せず、動きだけ確認する

```bash
python3 pipeline.py --dry-run
```

AI生成も動画作成も投稿も**一切行わず**、「何本作る予定か」「どのコマンドを実行する予定か」
「どの日時に予約する予定か」だけが表示されます。まずはこれで確認してください。

表示されたコマンドが、あなたのスクリプトを正しく呼べる形になっているかを見てください。
違っていたら `pipeline.config.json` の `steps` を直して、もう一度このコマンドを実行します。

### テスト2: 本番で1本だけ作ってみる

コマンドが正しそうだと確認できたら、本番で1本だけ作ります。

```bash
python3 pipeline.py --count 1
```

実際にAIがネタを考え、動画が作られ、YouTubeに予約投稿されます。
YouTube Studio を開いて、予約投稿が1本増えているか確認してください。

### テスト3: いつでも状況を確認する

```bash
python3 pipeline.py --status
```

いま何本予約が入っていて、何日先まで埋まっているかが表示されます。
何も作らずに確認するだけのコマンドなので、いつ実行しても安全です。

### テスト4: 通常運転で実行する

```bash
python3 pipeline.py
```

足りない本数だけ(最大3本)自動で作られます。これが自動実行と同じ動きです。

---

## 6時間おきの自動実行(launchd の設定)

手動テストがうまくいったら、Mac に「6時間おきに勝手に実行して」と覚えさせます。

### 手順1: python3 の場所を調べる

```bash
which python3
```

`/usr/bin/python3` や `/opt/homebrew/bin/python3` のようなパスが表示されます。
**これをメモしてください。**

### 手順2: pipeline フォルダの場所を調べる

```bash
pwd
```

`/Users/あなたの名前/shorts/pipeline` のようなパスが表示されます。
**これもメモしてください。**

### 手順3: 設定ファイルを所定の場所にコピーする

```bash
mkdir -p ~/Library/LaunchAgents
```

```bash
cp launchd/com.shorts.pipeline.plist ~/Library/LaunchAgents/com.shorts.pipeline.plist
```

### 手順4: コピーした設定ファイルを書き換える

```bash
open -e ~/Library/LaunchAgents/com.shorts.pipeline.plist
```

テキストエディットが開くので、`/Users/YOURNAME/shorts/pipeline` と書かれている部分を
**すべて**、手順2でメモしたパスに置き換えてください(全部で4箇所あります)。

そして `/usr/bin/python3` の行を、手順1でメモしたパスに置き換えてください。

書き換えたら、`command + S` で保存してテキストエディットを閉じます。

### 手順5: 書き換えたファイルが壊れていないか確認する

```bash
plutil -lint ~/Library/LaunchAgents/com.shorts.pipeline.plist
```

`OK` と表示されればOKです。エラーが出たら、手順4で `<string>` や `</string>` を
消してしまっていないか確認してください。

### 手順6: 自動実行に登録する

まず、もし前に登録したものがあれば解除します(初回はエラーが出ますが無視してOK)。

```bash
launchctl bootout gui/$(id -u)/com.shorts.pipeline 2>/dev/null
```

登録します。

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.shorts.pipeline.plist
```

> `bootstrap` で `command not found` などのエラーが出る古い macOS の場合は、
> 代わりに `launchctl load -w ~/Library/LaunchAgents/com.shorts.pipeline.plist` を使ってください。

### 手順7: 登録できたか確認する

```bash
launchctl list | grep com.shorts.pipeline
```

`com.shorts.pipeline` を含む行が表示されれば登録成功です。

登録直後に1回自動実行されているはずなので、ログを確認します。

```bash
tail -30 logs/pipeline-$(date +%Y-%m-%d).log
```

これで完了です。以降、Mac の電源が入っていれば6時間おきに自動で動きます。

---

## 自動実行の操作コマンド

### 今すぐ1回動かす(6時間待たずに試す)

```bash
launchctl kickstart -k gui/$(id -u)/com.shorts.pipeline
```

### 自動実行を止める

```bash
launchctl bootout gui/$(id -u)/com.shorts.pipeline
```

### 止めたものを再開する

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.shorts.pipeline.plist
```

### 完全に削除する

```bash
launchctl bootout gui/$(id -u)/com.shorts.pipeline 2>/dev/null
rm ~/Library/LaunchAgents/com.shorts.pipeline.plist
```

---

## ログと履歴の見かた

### 今日のログを見る

```bash
tail -50 logs/pipeline-$(date +%Y-%m-%d).log
```

### 自動実行そのもののエラーを見る

pipeline.py が起動すらできなかった場合(パスの書き間違いなど)は、こちらに出ます。

```bash
cat logs/launchd.err.log
```

### フォルダの中身

| 場所 | 中身 |
|---|---|
| `logs/pipeline-日付.log` | 実行の記録。1日1ファイル |
| `logs/launchd.err.log` | 自動実行の起動エラー |
| `state/history.json` | 作った動画の履歴とタイトル(ネタ被り防止に使用) |
| `state/pipeline.lock` | 実行中の目印。実行が終わると自動で消える |
| `work/日時-ID/` | 各動画の台本(`script.txt`)とメタ情報(`meta.json`)と動画 |

---

## 困ったときは

### 「別の pipeline.py がまだ動いているようです」と出る

前回の実行が途中で強制終了したときに出ます。目印のファイルを消してください。

```bash
rm state/pipeline.lock
```

### ネタが毎回似てしまう

`pipeline.config.json` の `theme` と `audience` を、もっと具体的に書き換えてください。
また、`state/history.json` に記録された過去のタイトルは自動でAIに渡されて避けられます。

### AIを使わず、自分で決めたネタを使いたい

ネタを1行ずつ書いたファイルを用意します。

```bash
open -e topics.txt
```

そして `pipeline.config.json` の `"idea_source": "claude"` を `"idea_source": "file"` に
書き換えてください。上の行から未使用のものが順に使われます(APIキーは不要になります)。

### 予約を全部やり直したい

履歴ファイルを削除すると、予約枠の管理がリセットされます。
**ただし YouTube 側に入っている予約は消えません。** YouTube Studio から手動で削除してください。

```bash
mv state/history.json state/history.backup.json
```

### 作りすぎ・作らなすぎを調整したい

- 1回に作る本数を変える → `max_per_run`
- ストックする日数を変える → `buffer_days`
- 1日の投稿本数を変える → `slots` に時刻を足す/減らす(例: `["07:00", "12:00", "21:00"]` で1日3本)

### Mac がスリープしていたら?

launchd は、スリープ中に来るはずだった実行を、Mac が起きたときにまとめて1回実行します。
毎日確実に動かしたい場合は、Mac をスリープさせない設定(システム設定 → ロック画面 →
ディスプレイオフ後にスリープしない)にしておくと安心です。
