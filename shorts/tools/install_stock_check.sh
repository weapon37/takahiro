#!/usr/bin/env bash
# 毎日の残数チェックを launchd に登録する(macOS専用)。
#
#     bash tools/install_stock_check.sh          # 毎朝9:00に登録
#     bash tools/install_stock_check.sh 21 30    # 時刻を変える場合(21:30)
#     bash tools/install_stock_check.sh --uninstall
#
# 登録すると、Macが起動している毎朝9時に予約残数を確認し、
# 2本以下になっていたら通知が出る。足りているときは何も出ない。

set -euo pipefail

LABEL="com.shigotoai.stockcheck"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "登録を解除しました: $LABEL"
  exit 0
fi

HOUR="${1:-9}"
MINUTE="${2:-0}"

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
    <string>${HERE}/tools/stock_check.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${HERE}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>${HOUR}</integer>
    <key>Minute</key><integer>${MINUTE}</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${HERE}/.stock_check.out</string>
  <key>StandardErrorPath</key>
  <string>${HERE}/.stock_check.err</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
EOF

# すでに登録済みなら入れ替える
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

printf '登録しました: %s\n' "$LABEL"
printf '  実行時刻: 毎日 %02d:%02d\n' "$HOUR" "$MINUTE"
printf '  スクリプト: %s/tools/stock_check.sh\n' "$HERE"
printf '  ログ: %s/.stock_check.log\n\n' "$HERE"
cat <<'MSG'
今すぐ動作確認する:
    bash tools/stock_check.sh          # 直接実行(通知が出るか確認できる)
    launchctl start com.shigotoai.stockcheck   # launchd経由で実行

登録されているか確認する:
    launchctl list | grep shigotoai

解除する:
    bash tools/install_stock_check.sh --uninstall

⚠ 初回は通知の許可を求められることがあります。
   出ない場合は システム設定 → 通知 → スクリプトエディタ を確認してください。
⚠ Macがスリープ・電源オフの時刻は実行されません(次に起きたときに実行されます)。
MSG
