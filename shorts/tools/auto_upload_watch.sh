#!/usr/bin/env bash
# out/ に新しい動画が置かれたら、自動で次の枠に予約投稿する(watcherの起動ラッパー)。
#
# launchd から定期的に呼ばれることを想定しているが、手動でも実行できる:
#     bash tools/auto_upload_watch.sh
#
# 実際に予約できたときだけ通知する(待機中は毎回鳴ると邪魔になるため)。
# 実行結果は必ず .auto_upload.log に追記される。

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE" || exit 1

BEFORE_QUEUE="$(cat tools/post_queue.txt 2>/dev/null)"

OUT="$(python3 tools/auto_upload_watch.py 2>&1)"
CODE=$?

AFTER_QUEUE="$(cat tools/post_queue.txt 2>/dev/null)"

notify() {
  /usr/bin/osascript -e "display notification \"$1\" with title \"仕事が消えるAI帳\" sound name \"Ping\"" 2>/dev/null
}

case "$CODE" in
  0)
    if [[ "$BEFORE_QUEUE" != "$AFTER_QUEUE" ]]; then
      # キューが進んだ = 実際に予約投稿できた
      DONE_LINE="$(printf '%s' "$OUT" | grep '^完了:' | tail -1)"
      notify "${DONE_LINE:-1本、予約投稿しました}"
    fi
    # 待機中(動画がまだ届いていない)は通知しない
    ;;
  *)
    notify "自動予約投稿に失敗しました(exit=$CODE)。ターミナルで確認してください。"
    ;;
esac

exit "$CODE"
