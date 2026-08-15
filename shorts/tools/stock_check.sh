#!/usr/bin/env bash
# 予約ストックを確認し、発注点(2本)以下なら macOS の通知を出す。
#
# launchd から1日1回呼ばれることを想定しているが、手動でも実行できる:
#     bash tools/stock_check.sh
#
# 足りている場合は通知しない(毎日通知が来ると無視するようになるため)。
# 実行結果は必ず .stock_check.log に追記されるので、後から確認できる。

# launchd から起動されると PATH がほぼ空になるため、明示的に設定する。
# /opt/homebrew は Apple Silicon、/usr/local は Intel の Homebrew。
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE" || exit 1

LOG="$HERE/.stock_check.log"
STAMP="$(date '+%Y-%m-%d %H:%M:%S')"

OUT="$(python3 tools/youtube_stock.py 2>&1)"
CODE=$?

{
  echo "[$STAMP] exit=$CODE"
  echo "$OUT"
  echo "--------"
} >> "$LOG"

notify() {
  # $1 = 本文。osascript は macOS の通知センターに出す。
  /usr/bin/osascript -e "display notification \"$1\" with title \"仕事が消えるAI帳\" sound name \"Ping\"" 2>/dev/null
}

case "$CODE" in
  9)
    # 発注点に到達。残数を本文に入れて通知する。
    COUNT="$(printf '%s' "$OUT" | grep -o '予約済み: [0-9]*本' | head -1)"
    notify "${COUNT:-ストックが少なくなっています}。次の6本の制作に入ってください。"
    ;;
  0)
    # 足りているので通知しない(ログにだけ残る)
    ;;
  *)
    # トークン失効・API障害など。黙って止まると気づけないので必ず通知する。
    notify "ストック確認に失敗しました(exit=$CODE)。ターミナルで確認してください。"
    ;;
esac

exit "$CODE"
