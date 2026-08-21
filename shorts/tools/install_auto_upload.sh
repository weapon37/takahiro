#!/usr/bin/env bash
# out/に新しい動画を置くだけで自動予約投稿されるようにする(macOS専用)。
#
#     bash tools/install_auto_upload.sh          # 15分おきにチェック
#     bash tools/install_auto_upload.sh 600      # 間隔を変える場合(秒数)
#     bash tools/install_auto_upload.sh --uninstall
#
# 登録すると、out/に「tools/post_queue.txtの先頭にある台本名.mp4」が
# 現れるたびに、次の空き枠(7:00/21:00を交互に)へ自動で予約投稿される。
#
# 前提: docs/youtube_api_setup.md のセットアップ済み(youtube_upload.pyが動く状態)。

set -euo pipefail

LABEL="com.shigotoai.autoupload"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "登録を解除しました: $LABEL"
  exit 0
fi

INTERVAL="${1:-900}"

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${HERE}/tools/auto_upload_watch.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${HERE}</string>
  <key>StartInterval</key>
  <integer>${INTERVAL}</integer>
  <key>StandardOutPath</key>
  <string>${HERE}/.auto_upload.out</string>
  <key>StandardErrorPath</key>
  <string>${HERE}/.auto_upload.err</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

printf '登録しました: %s\n' "$LABEL"
printf '  実行間隔: %s秒おき\n' "$INTERVAL"
printf '  スクリプト: %s/tools/auto_upload_watch.sh\n' "$HERE"
printf '  ログ: %s/.auto_upload.log\n\n' "$HERE"
cat <<'MSG'
使い方:
    1. tools/post_queue.txt に、投稿したい順番で台本名を1行ずつ書く
       (例: w6a_negirai)
    2. tools/last_scheduled.txt を、直近に実際に予約した日時に合わせておく
       (例: 2026-08-23 21:00)
    3. out/ に該当のmp4を置くと、次にこのwatcherが動いたときに
       自動で次の空き枠へ予約投稿される

今すぐ動作確認する(実際には予約しない):
    python3 tools/auto_upload_watch.py --dry-run

今すぐ動作確認する(launchd経由・実際に予約される):
    launchctl start com.shigotoai.autoupload

登録されているか確認する:
    launchctl list | grep shigotoai

解除する:
    bash tools/install_auto_upload.sh --uninstall

⚠ APIクォータは1日6本まで(videos.insertは1本1,600ユニット)。
   短時間に大量のmp4を置くと枠を使い切るので注意。
⚠ Macがスリープ・電源オフの間は実行されない(次に起きたときに実行される)。
MSG
