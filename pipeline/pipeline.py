#!/usr/bin/env python3
"""ショート動画 自動生成・予約投稿パイプライン.

「常に N 日分の予約投稿をストックしておく」ためのオーケストレーター。

実行するたびに以下を行う:
  1. 今、未来の予約枠がいくつ埋まっているかを数える
  2. 目標ストック数(buffer_days × 1日の投稿枠数)に足りない分を計算する
  3. 足りない本数だけ「ネタ決め → 台本 → 動画生成 → 予約投稿」を実行する
     (1回の実行で作りすぎないよう max_per_run で上限をかける)
  4. 各動画の公開日時は「空いている次の投稿枠」に自動で割り当てる
  5. 使ったタイトルは履歴に残し、次回以降のネタ被りを避ける
  6. 途中でエラーが出ても他の動画は続行し、経過はログファイルに残す

動画生成と YouTube 投稿そのものは、あなたが既に持っているスクリプトを
pipeline.config.json の "steps" に登録して呼び出す。
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import time
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterator

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python 3.8 以下
    print("Python 3.9 以上が必要です。", file=sys.stderr)
    raise

import experiment as experiment_mod

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = SCRIPT_DIR / "pipeline.config.json"

DEFAULTS: dict[str, Any] = {
    "timezone": "Asia/Tokyo",
    "buffer_days": 3,
    "slots": ["07:00", "12:00", "21:00"],
    "max_per_run": 3,
    "lead_minutes": 90,
    "step_timeout_seconds": 3600,
    "lock_stale_hours": 6,
    "idea_source": "claude",
    "topics_file": "topics.txt",
    "anthropic_model": "claude-opus-5",
    "anthropic_effort": "medium",
    "theme": "AIを活用した副業",
    "audience": "30〜40代で、営業職や現場仕事など外に出て働くスタイルのため、まとまった副業の時間を取りづらい人",
    "video_filename": "video.mp4",
    "steps": [],
    # 2週間ABテスト。enabled が false のときは通常の台本生成だけが動く。
    "experiment": {
        "enabled": False,
        "slot": "12:00",
        "start_date": None,
        "plan_file": "experiment.plan.json",
    },
}


# --------------------------------------------------------------------------
# ログ
# --------------------------------------------------------------------------
class Logger:
    """標準出力とログファイルの両方に書き出す。"""

    def __init__(self, log_dir: Path, tz: ZoneInfo) -> None:
        self.tz = tz
        log_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(tz).strftime("%Y-%m-%d")
        self.path = log_dir / f"pipeline-{stamp}.log"
        self._fh = self.path.open("a", encoding="utf-8")

    def log(self, level: str, message: str) -> None:
        line = f"[{datetime.now(self.tz).strftime('%Y-%m-%d %H:%M:%S')}] {level:<5} {message}"
        print(line, flush=True)
        self._fh.write(line + "\n")
        self._fh.flush()

    def info(self, message: str) -> None:
        self.log("INFO", message)

    def warn(self, message: str) -> None:
        self.log("WARN", message)

    def error(self, message: str) -> None:
        self.log("ERROR", message)

    def close(self) -> None:
        self._fh.close()


# --------------------------------------------------------------------------
# 設定 / .env
# --------------------------------------------------------------------------
def load_dotenv(path: Path) -> None:
    """pipeline/.env を読んで環境変数に入れる。

    launchd から起動されたときは通常のシェル環境変数が読み込まれないため、
    APIキーなどはこのファイル経由で渡せるようにしておく。
    """
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise SystemExit(
            f"設定ファイルが見つかりません: {path}\n"
            f"pipeline.config.example.json をコピーして pipeline.config.json を作ってください。"
        )
    try:
        user_config = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"設定ファイル {path} の書式が不正です: {exc}") from exc

    config = dict(DEFAULTS)
    config.update(user_config)
    # experiment は入れ子なので、書かれた項目だけを上書きする
    config["experiment"] = {**DEFAULTS["experiment"], **(user_config.get("experiment") or {})}

    if not config["slots"]:
        raise SystemExit("設定エラー: slots(1日の投稿枠)が空です。")
    for slot in config["slots"]:
        try:
            hour, minute = slot.split(":")
            if not (0 <= int(hour) <= 23 and 0 <= int(minute) <= 59):
                raise ValueError
        except (ValueError, AttributeError) as exc:
            raise SystemExit(f'設定エラー: slots の "{slot}" は "HH:MM" 形式で書いてください。') from exc
    config["slots"] = sorted(config["slots"], key=lambda s: (int(s.split(":")[0]), int(s.split(":")[1])))

    if int(config["buffer_days"]) < 1:
        raise SystemExit("設定エラー: buffer_days は 1 以上にしてください。")
    if int(config["max_per_run"]) < 1:
        raise SystemExit("設定エラー: max_per_run は 1 以上にしてください。")

    exp = config["experiment"]
    if exp.get("enabled"):
        if exp.get("slot") not in config["slots"]:
            raise SystemExit(
                f'設定エラー: experiment.slot "{exp.get("slot")}" が slots に含まれていません。'
                f"検証に使う投稿枠は slots にも入れてください (現在の slots: {', '.join(config['slots'])})。"
            )
        if not exp.get("start_date"):
            raise SystemExit(
                "設定エラー: experiment.start_date が空です。"
                'ABテストを始める日を "YYYY-MM-DD" で指定してください。'
            )
        try:
            date.fromisoformat(str(exp["start_date"]))
        except ValueError as exc:
            raise SystemExit(
                f'設定エラー: experiment.start_date "{exp["start_date"]}" は '
                f'"YYYY-MM-DD" の形で書いてください。'
            ) from exc
        if config.get("idea_source") == "file":
            raise SystemExit(
                '設定エラー: ABテスト中は idea_source を "claude" にしてください。'
                "topics.txt のネタでは、案ごとの条件を台本へ反映できません。"
            )
    return config


# --------------------------------------------------------------------------
# 状態ファイル(履歴 + 予約枠)
# --------------------------------------------------------------------------
def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"jobs": []}
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        backup = path.with_suffix(f".broken-{int(time.time())}.json")
        path.rename(backup)
        print(f"履歴ファイルが壊れていたため {backup} に退避し、新規作成します。", file=sys.stderr)
        return {"jobs": []}
    state.setdefault("jobs", [])
    return state


def save_state(path: Path, state: dict[str, Any]) -> None:
    """書き込み途中で落ちても壊れないよう、一時ファイル経由で置き換える。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


# --------------------------------------------------------------------------
# 予約枠の計算
# --------------------------------------------------------------------------
def iter_slots(now: datetime, slots: list[str], tz: ZoneInfo, days: int) -> Iterator[datetime]:
    """今日から days 日分の投稿枠を、古い順に列挙する。"""
    today = now.date()
    for offset in range(days):
        day = today + timedelta(days=offset)
        for slot in slots:
            hour, minute = (int(x) for x in slot.split(":"))
            yield datetime(day.year, day.month, day.day, hour, minute, tzinfo=tz)


def booked_slots(state: dict[str, Any]) -> set[str]:
    return {
        job["publish_at"]
        for job in state["jobs"]
        if job.get("status") == "scheduled" and job.get("publish_at")
    }


def pending_count(state: dict[str, Any], now: datetime) -> int:
    """まだ公開されていない(未来の)予約投稿の本数。"""
    count = 0
    for job in state["jobs"]:
        if job.get("status") != "scheduled" or not job.get("publish_at"):
            continue
        if datetime.fromisoformat(job["publish_at"].replace("Z", "+00:00")) > now:
            count += 1
    return count


def covered_days(state: dict[str, Any], now: datetime, config: dict[str, Any], tz: ZoneInfo) -> int:
    """「今、何日先まで予約が埋まっているか」を数える。

    その日の枠がすべて『予約済み』か『すでに過ぎた時刻』なら、その日は埋まっている扱い。
    埋まっていない日が出てきた時点で打ち切る。
    """
    booked = booked_slots(state)
    days = 0
    for offset in range(0, 60):
        day = (now + timedelta(days=offset)).date()
        day_ok = True
        for slot in config["slots"]:
            hour, minute = (int(x) for x in slot.split(":"))
            at = datetime(day.year, day.month, day.day, hour, minute, tzinfo=tz)
            if at <= now:
                continue
            if to_utc_iso(at) not in booked:
                day_ok = False
                break
        if not day_ok:
            break
        days += 1
    return days


def to_utc_iso(dt: datetime) -> str:
    """YouTube API が求める RFC3339 (UTC) 形式に変換する。"""
    return dt.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")


def next_free_slot(
    now: datetime, state: dict[str, Any], config: dict[str, Any], tz: ZoneInfo, extra: set[str]
) -> datetime | None:
    """まだ誰も使っていない、いちばん近い未来の投稿枠を返す。"""
    booked = booked_slots(state) | extra
    earliest = now + timedelta(minutes=int(config["lead_minutes"]))
    for at in iter_slots(now, config["slots"], tz, days=60):
        if at <= earliest:
            continue
        if to_utc_iso(at) in booked:
            continue
        return at
    return None


# --------------------------------------------------------------------------
# ネタ決め・台本づくり
# --------------------------------------------------------------------------
def build_idea_schema(script_hint: str) -> dict[str, Any]:
    """台本の長さの指示だけを差し替えられるようにしたスキーマ。

    ABテストでは尺そのものが検証対象になるため、既定の「40〜55秒」を
    そのまま渡すと条件と矛盾してしまう。
    """
    return {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "YouTubeショートのタイトル(全角30文字以内)"},
            "description": {"type": "string", "description": "YouTubeの概要欄に入れる説明文"},
            "tags": {"type": "array", "items": {"type": "string"}, "description": "ハッシュタグ用のキーワード5個"},
            "hook": {"type": "string", "description": "冒頭2秒で言い切る掴みの一言"},
            "script": {"type": "string", "description": f"そのまま読み上げられる完成した台本({script_hint})"},
            "background_prompt": {"type": "string", "description": "背景素材を作るための英語の画像生成プロンプト"},
        },
        "required": ["title", "description", "tags", "hook", "script", "background_prompt"],
        "additionalProperties": False,
    }


def build_experiment_prompt(
    config: dict[str, Any], assignment: dict[str, Any], avoid: str, same_pair_titles: list[str]
) -> str:
    """ABテストの1本ぶんのプロンプト。テーマを固定し、条件だけを変える。"""
    conditions = "\n".join(experiment_mod.render_settings(assignment["settings"]))
    if same_pair_titles:
        pair_note = (
            f"同じ組のもう1本はこのタイトルです。テーマは同じままでよいので、"
            f"タイトルの文言だけは重複させないでください。\n"
            + "\n".join(f"- {t}" for t in same_pair_titles)
        )
    else:
        pair_note = "同じ組のもう1本はまだ作られていません。"

    return (
        f"あなたはYouTubeショート動画の構成作家です。\n\n"
        f"ジャンル: {config['theme']}\n"
        f"ターゲット: {config['audience']}\n\n"
        f"これはABテストの検証動画です。テーマは固定で、下の条件だけを変えて2本を比べます。\n"
        f"テーマ(必ずこの内容で作る): {assignment['topic']}\n"
        f"検証している変数: {assignment['variable']}\n"
        f"今回の案: {assignment['arm']}案「{assignment['arm_label']}」\n\n"
        f"必ず守る条件:\n{conditions}\n"
        f"- 具体的な行動やツール名を1つ以上入れる\n"
        f"- 台本は音声読み上げ用なので、記号・見出し・箇条書きは使わず、話し言葉だけで書く\n\n"
        f"重要: 検証している変数以外は、2本のあいだで差が出ないようにしてください。"
        f"上の条件に書かれていない要素は、凝った演出を足さず標準的な作り方にしてください。\n\n"
        f"{pair_note}\n\n"
        f"参考: 以下は過去に使ったタイトルです。今回のテーマは固定なので従う必要はありませんが、"
        f"同じ切り口の使い回しは避けてください。\n{avoid}"
    )


def _request_idea(config: dict[str, Any], prompt: str, script_hint: str, log: Logger) -> dict[str, Any]:
    """組み立て済みのプロンプトを Claude に投げ、ネタと台本を受け取る。"""
    try:
        import anthropic
    except ImportError as exc:
        raise RuntimeError(
            "anthropic ライブラリが入っていません。ターミナルで `pip3 install anthropic` を実行してください。"
        ) from exc

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError(
            "ANTHROPIC_API_KEY が設定されていません。pipeline/.env に書くか、環境変数に設定してください。"
        )

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=config["anthropic_model"],
        max_tokens=8000,
        output_config={
            "effort": config["anthropic_effort"],
            "format": {"type": "json_schema", "schema": build_idea_schema(script_hint)},
        },
        messages=[{"role": "user", "content": prompt}],
    )

    if response.stop_reason == "refusal":
        raise RuntimeError("生成が拒否されました。テーマや設定を見直してください。")

    text = "".join(block.text for block in response.content if block.type == "text")
    if not text.strip():
        raise RuntimeError("生成結果が空でした。")
    idea = json.loads(text)
    log.info(f"ネタ生成完了: {idea['title']}")
    return idea


def generate_idea_with_claude(
    config: dict[str, Any],
    used_titles: list[str],
    log: Logger,
    assignment: dict[str, Any] | None = None,
    same_pair_titles: list[str] | None = None,
) -> dict[str, Any]:
    recent = used_titles[-100:]
    avoid = "\n".join(f"- {t}" for t in recent) if recent else "(まだありません)"

    if assignment is not None:
        prompt = build_experiment_prompt(config, assignment, avoid, same_pair_titles or [])
        seconds = assignment["settings"].get("duration_seconds")
        script_hint = f"{int(seconds)}秒で読み終わる長さ" if seconds else "40〜55秒程度"
        return _request_idea(config, prompt, script_hint, log)

    prompt = (
        f"あなたはYouTubeショート動画の構成作家です。\n\n"
        f"ジャンル: {config['theme']}\n"
        f"ターゲット: {config['audience']}\n\n"
        f"このターゲットに刺さるショート動画のネタを1本ぶん考え、台本まで完成させてください。\n\n"
        f"条件:\n"
        f"- 冒頭2秒で「自分のことだ」と思わせる掴みから入る\n"
        f"- 読み上げて40〜55秒に収まる長さ\n"
        f"- 具体的な行動やツール名を1つ以上入れる\n"
        f"- 最後は視聴者が次に取る行動を一言で示して終わる\n"
        f"- 台本は音声読み上げ用なので、記号・見出し・箇条書きは使わず、話し言葉だけで書く\n\n"
        f"重要: 以下は過去に使用済みのタイトルです。これらと同じ切り口・同じ内容は絶対に避け、"
        f"新しい角度のネタにしてください。\n{avoid}"
    )
    return _request_idea(config, prompt, "40〜55秒程度", log)


def generate_idea_from_file(base_dir: Path, config: dict[str, Any], used_titles: list[str], log: Logger) -> dict[str, Any]:
    """topics.txt から未使用の行を1つ取り出す(APIを使わないモード)。"""
    topics_path = base_dir / config["topics_file"]
    if not topics_path.exists():
        raise RuntimeError(f"ネタ一覧ファイルがありません: {topics_path}")
    used = set(used_titles)
    for raw in topics_path.read_text(encoding="utf-8").splitlines():
        title = raw.strip()
        if not title or title.startswith("#") or title in used:
            continue
        log.info(f"ネタ取得(ファイル): {title}")
        return {
            "title": title,
            "description": title,
            "tags": [],
            "hook": title,
            "script": title,
            "background_prompt": title,
        }
    raise RuntimeError(f"{topics_path} に未使用のネタが残っていません。行を追加してください。")


def make_dry_run_idea(index: int, assignment: dict[str, Any] | None = None) -> dict[str, Any]:
    if assignment is not None:
        return {
            "title": f"【テスト】{assignment['day_number']}日目 {assignment['arm']}案 {assignment['arm_label']}",
            "description": (
                f"--dry-run のダミーです。検証: {assignment['variable']} / "
                f"テーマ: {assignment['topic']}"
            ),
            "tags": ["テスト", "ABテスト"],
            "hook": f"{assignment['arm_label']} のダミー掴みです。",
            "script": "これはテスト用の台本です。実際のAI生成は行われていません。",
            "background_prompt": "abstract blue gradient background, minimal",
        }
    return {
        "title": f"【テスト】ダミーのネタ {index}",
        "description": "これは --dry-run で作られたテスト用のダミーデータです。",
        "tags": ["テスト", "AI副業"],
        "hook": "テスト用の掴みです。",
        "script": "これはテスト用の台本です。実際のAI生成は行われていません。",
        "background_prompt": "abstract blue gradient background, minimal",
    }


# --------------------------------------------------------------------------
# 外部コマンド(あなたの既存スクリプト)の実行
# --------------------------------------------------------------------------
def render_command(command: Any, values: dict[str, str]) -> list[str]:
    if isinstance(command, str):
        parts = shlex.split(command)
    elif isinstance(command, list):
        parts = [str(p) for p in command]
    else:
        raise RuntimeError(f"steps の command は文字列かリストで書いてください: {command!r}")

    rendered: list[str] = []
    for part in parts:
        out = part
        for key, value in values.items():
            out = out.replace("{" + key + "}", value)
        rendered.append(out)
    return rendered


def run_step(step: dict[str, Any], values: dict[str, str], config: dict[str, Any], base_dir: Path, log: Logger) -> None:
    name = step.get("name", "(名前なし)")
    command = render_command(step.get("command"), values)
    if not command:
        raise RuntimeError(f"ステップ「{name}」の command が空です。")

    cwd = step.get("cwd")
    workdir = Path(cwd).expanduser() if cwd else base_dir
    log.info(f"  ステップ実行: {name} -> {' '.join(shlex.quote(c) for c in command)}")

    result = subprocess.run(
        command,
        cwd=str(workdir),
        capture_output=True,
        text=True,
        timeout=int(config["step_timeout_seconds"]),
    )
    if result.stdout.strip():
        for line in result.stdout.strip().splitlines()[-20:]:
            log.info(f"    | {line}")
    if result.returncode != 0:
        for line in (result.stderr or "").strip().splitlines()[-20:]:
            log.error(f"    ! {line}")
        raise RuntimeError(f"ステップ「{name}」が失敗しました (終了コード {result.returncode})")
    log.info(f"  ステップ完了: {name}")


# --------------------------------------------------------------------------
# 多重起動の防止
# --------------------------------------------------------------------------
class Lock:
    def __init__(self, path: Path, stale_hours: int) -> None:
        self.path = path
        self.stale_hours = stale_hours
        self.acquired = False

    def __enter__(self) -> "Lock":
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            age_hours = (time.time() - self.path.stat().st_mtime) / 3600
            if age_hours > self.stale_hours:
                self.path.unlink(missing_ok=True)
            else:
                raise SystemExit(
                    f"別の pipeline.py がまだ動いているようです ({self.path})。\n"
                    f"止まっているのに消えない場合は、このファイルを手で削除してください。"
                )
        self.path.write_text(str(os.getpid()), encoding="utf-8")
        self.acquired = True
        return self

    def __exit__(self, *exc: Any) -> None:
        if self.acquired:
            self.path.unlink(missing_ok=True)


# --------------------------------------------------------------------------
# メイン処理
# --------------------------------------------------------------------------
def print_status(state: dict[str, Any], now: datetime, config: dict[str, Any], tz: ZoneInfo, log: Logger) -> None:
    per_day = len(config["slots"])
    target = int(config["buffer_days"]) * per_day
    pending = pending_count(state, now)
    days = covered_days(state, now, config, tz)

    log.info("---- 現在のストック状況 ----")
    log.info(f"  1日の投稿枠      : {per_day} 本 ({', '.join(config['slots'])})")
    log.info(f"  目標ストック     : {config['buffer_days']} 日分 = {target} 本")
    log.info(f"  予約済み(未来)  : {pending} 本")
    log.info(f"  予約が埋まっている: 今日から {days} 日先まで")

    upcoming = sorted(
        (j for j in state["jobs"] if j.get("status") == "scheduled" and j.get("publish_at")),
        key=lambda j: j["publish_at"],
    )
    upcoming = [
        j for j in upcoming
        if datetime.fromisoformat(j["publish_at"].replace("Z", "+00:00")) > now
    ]
    if upcoming:
        log.info("  予約リスト:")
        for job in upcoming[:20]:
            local = datetime.fromisoformat(job["publish_at"].replace("Z", "+00:00")).astimezone(tz)
            mark = ""
            info = job.get("experiment")
            if info:
                mark = f"[{info['day_number']}日目 {info['arm']}案] "
            log.info(f"    {local.strftime('%m/%d %H:%M')}  {mark}{job.get('title', '')}")
    log.info("---------------------------")


def print_experiment_status(
    state: dict[str, Any], plan: dict[str, Any], config: dict[str, Any], now: datetime, log: Logger
) -> None:
    """ABテストが今どこまで進んでいるかを表示する。"""
    settings = config["experiment"]
    total = experiment_mod.plan_days(plan)
    start = date.fromisoformat(settings["start_date"])
    made = {}
    for job in state["jobs"]:
        info = job.get("experiment")
        if info:
            made[(info["pair_id"], info["arm"])] = job

    recorded = sum(1 for job in made.values() if job.get("metrics"))
    elapsed = (now.date() - start).days + 1

    log.info("---- ABテストの進行 ----")
    log.info(f"  計画          : {plan.get('name', '')}")
    log.info(f"  検証枠        : 毎日 {settings['slot']}")
    log.info(f"  期間          : {start} から {total} 日間")
    today = f"{elapsed} 日目 / {total} 日" if 1 <= elapsed <= total else "期間外"
    log.info(f"  今日          : {today}")
    log.info(f"  作成済み      : {len(made)} / {total} 本")
    log.info(f"  実測値の記録  : {recorded} / {total} 本")
    log.info("------------------------")


def main() -> int:
    parser = argparse.ArgumentParser(description="ショート動画 自動生成・予約投稿パイプライン")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH, help="設定ファイルのパス")
    parser.add_argument("--dry-run", action="store_true", help="AI生成も外部コマンドも実行せず、動きだけ確認する")
    parser.add_argument("--status", action="store_true", help="現在のストック状況を表示するだけで終了する")
    parser.add_argument("--count", type=int, default=None, help="作る本数を手動で指定する(上限チェックより優先)")

    exp_group = parser.add_argument_group("2週間ABテスト")
    exp_group.add_argument("--experiment-plan", action="store_true", help="ABテストの日程表を表示して終了する")
    exp_group.add_argument("--experiment-report", action="store_true", help="A案とB案の比較結果を表示して終了する")
    exp_group.add_argument(
        "--record", metavar="JOB_ID|YYYY-MM-DD", default=None,
        help="公開後の実測値を記録する(対象は job_id か公開日)",
    )
    exp_group.add_argument("--views", type=int, default=None, help="--record と一緒に使う: 再生数")
    exp_group.add_argument("--avg-view-seconds", type=float, default=None, help="--record と一緒に使う: 平均視聴時間(秒)")
    exp_group.add_argument("--avg-view-pct", type=float, default=None, help="--record と一緒に使う: 平均再生率(%%)")
    exp_group.add_argument("--retention-5s", type=float, default=None, help="--record と一緒に使う: 5秒維持率(%%)")
    exp_group.add_argument("--end-retention", type=float, default=None, help="--record と一緒に使う: 終了地点維持率(%%)")
    args = parser.parse_args()

    config_path = args.config.expanduser().resolve()
    load_dotenv(config_path.parent / ".env")
    config = load_config(config_path)

    base_dir = Path(config.get("base_dir", config_path.parent)).expanduser().resolve()
    tz = ZoneInfo(config["timezone"])
    state_path = base_dir / "state" / "history.json"
    log = Logger(base_dir / "logs", tz)

    now = datetime.now(tz)
    state = load_state(state_path)

    log.info("=" * 60)
    log.info(f"パイプライン開始 (dry-run={args.dry_run})")

    # ABテストの計画は、検証が有効なときと明示的に呼ばれたときだけ読む
    exp_settings = config["experiment"]
    plan: dict[str, Any] | None = None
    wants_experiment = args.experiment_plan or args.experiment_report or args.record is not None
    if exp_settings.get("enabled") or wants_experiment:
        try:
            plan = experiment_mod.load_plan(base_dir / exp_settings["plan_file"])
        except experiment_mod.PlanError as exc:
            log.error(str(exc))
            log.close()
            return 1

    if args.experiment_plan:
        if not exp_settings.get("start_date"):
            log.error("experiment.start_date が設定されていないため、日程表を作れません。")
            log.close()
            return 1
        log.info(f"==== {plan.get('name', '')} の日程 (毎日 {exp_settings['slot']}) ====")
        for day, number, pair, arm_key in experiment_mod.iter_schedule(plan, exp_settings):
            arm = pair["arms"][arm_key]
            log.info(
                f"  {day}  {number:>2}日目  {arm_key}案 {arm['label']:<22} "
                f"{pair['variable']} / {experiment_mod.describe_settings(arm['settings'])}"
            )
        log.info("=" * 34)
        log.close()
        return 0

    if args.experiment_report:
        for line in experiment_mod.build_report(plan, state["jobs"], exp_settings):
            log.info(line)
        log.close()
        return 0

    if args.record is not None:
        metrics = {
            "views": args.views,
            "avg_view_seconds": args.avg_view_seconds,
            "avg_view_pct": args.avg_view_pct,
            "retention_5s": args.retention_5s,
            "end_retention": args.end_retention,
        }
        metrics = {key: value for key, value in metrics.items() if value is not None}
        if not metrics:
            log.error(
                "記録する数値が指定されていません。"
                "--views / --avg-view-seconds / --avg-view-pct / --retention-5s / --end-retention "
                "のどれかを付けてください。"
            )
            log.close()
            return 1
        try:
            job = experiment_mod.find_job(state["jobs"], args.record)
        except experiment_mod.PlanError as exc:
            log.error(str(exc))
            log.close()
            return 1
        experiment_mod.record_metrics(job, metrics, now)
        save_state(state_path, state)
        log.info(f"実測値を記録しました: {job.get('publish_at_local')} 「{job.get('title', '')}」")
        for key, value in metrics.items():
            label, unit = experiment_mod.METRIC_FIELDS[key]
            log.info(f"  {label}: {value}{unit}")
        log.close()
        return 0

    if args.status:
        print_status(state, now, config, tz, log)
        if plan is not None and exp_settings.get("start_date"):
            print_experiment_status(state, plan, config, now, log)
        log.close()
        return 0

    with Lock(base_dir / "state" / "pipeline.lock", int(config["lock_stale_hours"])):
        print_status(state, now, config, tz, log)

        per_day = len(config["slots"])
        target = int(config["buffer_days"]) * per_day
        shortage = max(0, target - pending_count(state, now))

        if args.count is not None:
            need = max(0, args.count)
            log.info(f"--count 指定により {need} 本を作成します。")
        else:
            need = min(shortage, int(config["max_per_run"]))
            log.info(f"不足 {shortage} 本 / 1回の上限 {config['max_per_run']} 本 → 今回は {need} 本作成します。")

        if need == 0:
            log.info("ストックは足りています。何もせず終了します。")
            log.close()
            return 0

        steps = config["steps"]
        if not steps and not args.dry_run:
            log.error(
                "設定ファイルの steps が空です。動画生成コマンドと投稿コマンドを登録してください。"
                " (まずは --dry-run で動作確認してください)"
            )
            log.close()
            return 1

        # 1本も工程が動かないまま失敗したネタは、まだ使っていない扱いにして再利用できるようにする
        used_titles = [
            j["title"] for j in state["jobs"] if j.get("title") and not j.get("title_reusable")
        ]
        reserved: set[str] = set()
        made = 0
        failed = 0

        for index in range(1, need + 1):
            log.info("-" * 60)
            log.info(f"[{index}/{need}] 動画の作成を開始します。")

            publish_at = next_free_slot(now, state, config, tz, reserved)
            if publish_at is None:
                log.error("空いている投稿枠が60日先まで見つかりませんでした。中止します。")
                break

            publish_at_utc = to_utc_iso(publish_at)
            log.info(f"  割り当てた公開日時: {publish_at.strftime('%Y-%m-%d %H:%M')} ({config['timezone']})")

            assignment = (
                experiment_mod.assignment_for(publish_at, plan, exp_settings)
                if plan is not None
                else None
            )
            if assignment is not None:
                log.info(
                    f"  ABテスト: {assignment['day_number']}日目 / {assignment['arm']}案"
                    f"「{assignment['arm_label']}」/ 検証: {assignment['variable']}"
                )
                log.info(f"  固定テーマ: {assignment['topic']}")
                log.info(f"  条件: {experiment_mod.describe_settings(assignment['settings'])}")

            job_id = f"{publish_at.strftime('%Y%m%d-%H%M')}-{uuid.uuid4().hex[:6]}"
            work_dir = base_dir / "work" / job_id
            job: dict[str, Any] = {
                "job_id": job_id,
                "created_at": now.isoformat(),
                "publish_at": publish_at_utc,
                "publish_at_local": publish_at.strftime("%Y-%m-%d %H:%M"),
                "status": "failed",
                "title": "",
            }
            if assignment is not None:
                job["experiment"] = {
                    key: assignment[key]
                    for key in ("plan_name", "pair_id", "variable", "topic", "arm", "arm_label", "day_number")
                }
                job["experiment"]["settings"] = assignment["settings"]

            steps_started = False
            try:
                # --- 1. ネタ決め + 台本 ---
                if args.dry_run:
                    idea = make_dry_run_idea(index, assignment)
                elif assignment is not None:
                    if config["idea_source"] == "file":
                        raise RuntimeError(
                            "ABテストの検証枠は topics.txt から作れません"
                            "(案ごとの条件を台本へ反映できないため)。"
                            'idea_source を "claude" にしてください。'
                        )
                    # 同じ組のもう1本とはテーマを共有するので、避けるタイトルからは除く
                    same_pair = [
                        j["title"]
                        for j in state["jobs"]
                        if j.get("title")
                        and (j.get("experiment") or {}).get("pair_id") == assignment["pair_id"]
                    ]
                    idea = generate_idea_with_claude(
                        config,
                        [t for t in used_titles if t not in same_pair],
                        log,
                        assignment=assignment,
                        same_pair_titles=same_pair,
                    )
                elif config["idea_source"] == "file":
                    idea = generate_idea_from_file(base_dir, config, used_titles, log)
                else:
                    idea = generate_idea_with_claude(config, used_titles, log)

                if idea["title"] in used_titles:
                    raise RuntimeError(f"タイトルが履歴と重複しました: {idea['title']}")

                job["title"] = idea["title"]
                # 同じ実行の中で同じネタを二度使わないよう、この時点で使用済みにする
                used_titles.append(idea["title"])

                # --- 2. 台本などをファイルに書き出す ---
                work_dir.mkdir(parents=True, exist_ok=True)
                script_file = work_dir / "script.txt"
                meta_file = work_dir / "meta.json"
                video_file = work_dir / config["video_filename"]
                script_file.write_text(idea["script"], encoding="utf-8")
                meta: dict[str, Any] = {**idea, "publish_at": publish_at_utc}
                if assignment is not None:
                    meta["experiment"] = job["experiment"]
                meta_file.write_text(
                    json.dumps(meta, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                log.info(f"  台本を保存しました: {script_file}")

                values = {
                    "job_id": job_id,
                    "work_dir": str(work_dir),
                    "script_file": str(script_file),
                    "meta_file": str(meta_file),
                    "video_file": str(video_file),
                    "title": idea["title"],
                    "description": idea["description"],
                    "tags": ",".join(idea.get("tags") or []),
                    "hook": idea["hook"],
                    "background_prompt": idea["background_prompt"],
                    "publish_at": publish_at_utc,
                    "publish_at_local": publish_at.strftime("%Y-%m-%d %H:%M"),
                }

                # --- 3〜5. 音声・背景・書き出し・予約投稿(既存スクリプトを順に呼ぶ) ---
                if args.dry_run:
                    for step in steps:
                        preview = render_command(step.get("command"), values)
                        log.info(f"  [dry-run] 実行予定: {' '.join(shlex.quote(c) for c in preview)}")
                else:
                    for step in steps:
                        steps_started = True
                        run_step(step, values, config, base_dir, log)

                job["status"] = "dry-run" if args.dry_run else "scheduled"
                job["video_file"] = str(video_file)
                made += 1
                reserved.add(publish_at_utc)
                log.info(f"  完了: 「{idea['title']}」を {job['publish_at_local']} に予約しました。")

            except Exception as exc:  # 1本失敗しても残りは続行する
                failed += 1
                job["error"] = str(exc)
                if not steps_started:
                    # 工程が1つも動いていないなら、このネタはまだ使っていない扱いに戻す
                    job["title_reusable"] = True
                    if job["title"] and job["title"] in used_titles:
                        used_titles.remove(job["title"])
                log.error(f"  失敗: {exc}")

            finally:
                # dry-run のときは履歴を汚さない
                if not args.dry_run:
                    state["jobs"].append(job)
                    save_state(state_path, state)

        log.info("-" * 60)
        log.info(f"パイプライン終了: 成功 {made} 本 / 失敗 {failed} 本")
        if not args.dry_run:
            print_status(state, datetime.now(tz), config, tz, log)

    log.close()
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
