"""out/ に新しい動画が置かれたら、自動で次の枠に予約投稿する。

キュー(tools/post_queue.txt)の先頭にある台本名の動画(out/<名前>.mp4)が
存在すれば、次の空き枠(tools/last_scheduled.txt の続き、7:00/21:00を交互に)
へ実際に予約投稿し、キューを1つ進める。

動画がまだ届いていなければ何もせず終了する(エラーではない)。
launchd から定期的に呼ばれる想定(tools/install_auto_upload.sh で登録)。

手動実行:
    python3 tools/auto_upload_watch.py           # 通常実行
    python3 tools/auto_upload_watch.py --dry-run # 予約はせず、次に何が起きるかだけ表示

キューを進めるファイル:
    tools/post_queue.txt      — 1行1台本名(拡張子なし)。#で始まる行・空行は無視
    tools/last_scheduled.txt  — 直近に予約した日時(JST)。例: 2026-08-23 21:00
    tools/.auto_upload.log    — 実行ログ(追記)
"""

import datetime
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUEUE = os.path.join(HERE, "tools", "post_queue.txt")
LAST_SCHEDULED = os.path.join(HERE, "tools", "last_scheduled.txt")
LOG = os.path.join(HERE, "tools", ".auto_upload.log")
JST = datetime.timezone(datetime.timedelta(hours=9))


def log(line: str) -> None:
    stamp = datetime.datetime.now(JST).strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(f"[{stamp}] {line}\n")
    print(line)


def read_queue() -> list[str]:
    if not os.path.exists(QUEUE):
        return []
    names = []
    with open(QUEUE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                names.append(line)
    return names


def write_queue(names: list[str]) -> None:
    with open(QUEUE, "w", encoding="utf-8") as f:
        for n in names:
            f.write(n + "\n")


def read_last_scheduled() -> datetime.datetime:
    with open(LAST_SCHEDULED, encoding="utf-8") as f:
        value = f.read().strip()
    dt = datetime.datetime.strptime(value, "%Y-%m-%d %H:%M")
    return dt.replace(tzinfo=JST)


def write_last_scheduled(dt: datetime.datetime) -> None:
    with open(LAST_SCHEDULED, "w", encoding="utf-8") as f:
        f.write(dt.strftime("%Y-%m-%d %H:%M") + "\n")


def next_slot(last: datetime.datetime) -> datetime.datetime:
    """朝7:00/夜21:00を交互に。7:00の次は同日21:00、21:00の次は翌日7:00。"""
    if last.hour == 7:
        return last.replace(hour=21)
    return (last + datetime.timedelta(days=1)).replace(hour=7)


def main() -> int:
    dry_run = "--dry-run" in sys.argv[1:]

    names = read_queue()
    if not names:
        log("キューは空です。何もしません。")
        return 0

    name = names[0]
    video_path = os.path.join(HERE, "out", f"{name}.mp4")
    if not os.path.exists(video_path):
        log(f"待機中: {name} の動画がまだ out/ にありません。")
        return 0

    last = read_last_scheduled()
    slot = next_slot(last)
    at_value = slot.strftime("%Y-%m-%d %H:%M")

    script_path = os.path.join("scripts", f"{name}.json")
    cmd = ["python3", "tools/youtube_upload.py", script_path, "--at", at_value]
    if dry_run:
        cmd.append("--dry-run")

    log(f"実行: {name} を {at_value} へ予約投稿します" + ("(dry-run)" if dry_run else ""))
    result = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True)
    log(result.stdout.strip())
    if result.returncode != 0:
        log(f"失敗: {name}\n{result.stderr.strip()}")
        return 1

    log(f"完了: {name} → {at_value}")
    if not dry_run:
        write_last_scheduled(slot)
        write_queue(names[1:])
    return 0


if __name__ == "__main__":
    sys.exit(main())
