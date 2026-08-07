#!/usr/bin/env python3
"""2週間ABテストの割り当て・記録・集計.

pipeline.py から呼ばれる。役割は4つ。

  1. experiment.plan.json を読んで、書き方が正しいか検証する
  2. 「この投稿枠は何組の、どちらの案か」を日付から決める
  3. 案ごとの条件を、台本生成プロンプトに入れる文章へ変換する
  4. 公開後に実測値を記録し、A案とB案を並べて比較する

テストの前提は「1組(2本)のあいだで、変数を1つだけ変える」こと。
それを人間の注意力に任せず、plan を読み込んだ時点で機械的に検証する。
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

# 記録できる実測値。キー -> (表示名, 単位)
METRIC_FIELDS: dict[str, tuple[str, str]] = {
    "views": ("再生数", "回"),
    "avg_view_seconds": ("平均視聴時間", "秒"),
    "avg_view_pct": ("平均再生率", "%"),
    "retention_5s": ("5秒維持率", "%"),
    "end_retention": ("終了地点維持率", "%"),
}


# --------------------------------------------------------------------------
# 条件 -> プロンプトの文章
# --------------------------------------------------------------------------
def _first_answer_line(value: Any) -> str:
    seconds = int(value)
    if seconds <= 3:
        return f"- 冒頭{seconds}秒以内に、最初の答え(具体例か判断基準)を出す"
    return (
        f"- 冒頭から{seconds}秒までは結論を引っ張る前振りに使い、"
        f"最初の答えは{seconds}秒あたりで出す"
    )


# 設定キー -> その値をプロンプト用の一文に変換する関数
SETTING_LINES: dict[str, Any] = {
    "duration_seconds": lambda v: (
        f"- 読み上げてちょうど{int(v)}秒に収まる長さにする(尺は検証条件なので必ず守る)"
    ),
    "item_count": lambda v: f"- 紹介する項目はちょうど{int(v)}個にする",
    "first_answer_by_seconds": _first_answer_line,
    "cta": lambda v: {
        "none": "- 結論を言い終わった直後に終わる。チャンネル登録やコメントの誘導は入れない",
        "comment_2s": "- 最後に2秒だけコメント誘導を入れて終わる",
    }[v],
    "framing": lambda v: {
        "loss": "- 視聴者が「失うもの」を軸に組み立てる。「10分を失う」のような損失の言い方で通す",
        "gain": "- 視聴者が「得るもの」を軸に組み立てる。「10分が減る」のような利益の言い方で通す",
    }[v],
    "amount_style": lambda v: {
        "none": "- 具体的な金額は出さない。「有料版はまだ必要ない」のように金額なしで表現する",
        "explicit_yen": "- 「月3,000円」のように、具体的な金額を1回以上必ず出す",
    }[v],
    "audience_style": lambda v: {
        "job_title": "- 対象者は職種名(「営業職の人」など)で指定する",
        "task_based": "- 対象者は職種名ではなく、その人がやっている具体的な作業場面(「毎日1時間かけている作業」など)で指定する",
    }[v],
}

# プロンプトに並べる順番。並びが実行ごとに変わると比較がぶれるため固定する。
SETTING_ORDER = [
    "duration_seconds",
    "item_count",
    "first_answer_by_seconds",
    "framing",
    "amount_style",
    "audience_style",
    "cta",
]


class PlanError(Exception):
    """experiment.plan.json の書き方が正しくない。"""


def _ordered(keys: Any) -> list[str]:
    """SETTING_ORDER の順に並べ、そこに無いキーは後ろへ回す。"""
    known = [key for key in SETTING_ORDER if key in keys]
    return known + sorted(key for key in keys if key not in SETTING_ORDER)


def render_settings(settings: dict[str, Any]) -> list[str]:
    """条件のまとまりを、プロンプトに貼れる箇条書きへ変換する。"""
    lines: list[str] = []
    for key in _ordered(settings):
        renderer = SETTING_LINES.get(key)
        if renderer is None:
            raise PlanError(
                f'知らない条件キー "{key}" が指定されました。'
                f"使えるのは: {', '.join(sorted(SETTING_LINES))}"
            )
        try:
            lines.append(renderer(settings[key]))
        except KeyError as exc:
            raise PlanError(
                f'条件 "{key}" に知らない値 {settings[key]!r} が指定されました。'
            ) from exc
        except (TypeError, ValueError) as exc:
            raise PlanError(
                f'条件 "{key}" の値 {settings[key]!r} は数値で書いてください。'
            ) from exc
    return lines


def describe_settings(settings: dict[str, Any]) -> str:
    """ログ表示用に条件を1行へまとめる。"""
    return " / ".join(f"{key}={settings[key]}" for key in _ordered(settings))


# --------------------------------------------------------------------------
# 計画ファイルの読み込みと検証
# --------------------------------------------------------------------------
def load_plan(path: Path) -> dict[str, Any]:
    """計画ファイルを読み、ABテストとして成立しているかを検証する。"""
    if not path.exists():
        raise PlanError(f"ABテストの計画ファイルが見つかりません: {path}")
    try:
        plan = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise PlanError(f"計画ファイル {path} の書式が不正です: {exc}") from exc

    baseline = plan.get("baseline")
    if not isinstance(baseline, dict) or not baseline:
        raise PlanError("計画ファイルに baseline(共通の土台条件)がありません。")
    render_settings(baseline)  # 未知のキー・値をここで弾く

    pairs = plan.get("pairs")
    if not isinstance(pairs, list) or not pairs:
        raise PlanError("計画ファイルに pairs(検証する組)がありません。")

    seen_ids: set[str] = set()
    for index, pair in enumerate(pairs, start=1):
        where = f"{index}組目"
        pair_id = pair.get("id")
        if not pair_id:
            raise PlanError(f"{where}に id がありません。")
        if pair_id in seen_ids:
            raise PlanError(f'id "{pair_id}" が重複しています。')
        seen_ids.add(pair_id)

        if not pair.get("topic"):
            raise PlanError(f'{where}({pair_id}) に topic がありません。A案とB案で共通のテーマが必要です。')
        if not pair.get("variable"):
            raise PlanError(f"{where}({pair_id}) に variable(何を検証するか)がありません。")

        arms = pair.get("arms")
        if not isinstance(arms, dict) or set(arms) != {"A", "B"}:
            raise PlanError(f'{where}({pair_id}) の arms は "A" と "B" の2つにしてください。')

        effective: dict[str, dict[str, Any]] = {}
        for arm_key, arm in arms.items():
            if not arm.get("label"):
                raise PlanError(f"{where}({pair_id}) の {arm_key}案に label がありません。")
            settings = arm.get("settings")
            if not isinstance(settings, dict) or not settings:
                raise PlanError(f"{where}({pair_id}) の {arm_key}案に settings がありません。")
            unknown = set(settings) - set(baseline)
            if unknown:
                raise PlanError(
                    f"{where}({pair_id}) の {arm_key}案が baseline にない条件 "
                    f"{', '.join(sorted(unknown))} を指定しています。"
                    f"まず baseline に既定値を書いてください。"
                )
            render_settings(settings)
            effective[arm_key] = {**baseline, **settings}

        # ABテストの核心。2本のあいだで変わっている条件がちょうど1つであること。
        differing = sorted(
            key for key in effective["A"] if effective["A"][key] != effective["B"][key]
        )
        if len(differing) != 1:
            found = ", ".join(differing) if differing else "なし"
            raise PlanError(
                f"{where}({pair_id}) はA案とB案で変わっている条件が {len(differing)} 個あります "
                f"({found})。ABテストでは、ちょうど1つにしてください。"
            )
        pair["_differing_key"] = differing[0]

    return plan


def plan_days(plan: dict[str, Any]) -> int:
    """計画全体に必要な日数(1組2日)。"""
    return len(plan["pairs"]) * 2


# --------------------------------------------------------------------------
# 投稿枠 -> どの組のどちらの案か
# --------------------------------------------------------------------------
def assignment_for(publish_local: datetime, plan: dict[str, Any], settings: dict[str, Any]) -> dict[str, Any] | None:
    """その投稿枠が検証対象なら割り当てを返す。対象外なら None。

    settings は config["experiment"]。検証枠の時刻と開始日が一致し、
    かつ計画期間内の日付のときだけ割り当てが発生する。
    """
    if not settings.get("enabled"):
        return None
    if publish_local.strftime("%H:%M") != settings["slot"]:
        return None

    start = date.fromisoformat(settings["start_date"])
    day_index = (publish_local.date() - start).days
    if day_index < 0 or day_index >= plan_days(plan):
        return None

    pair = plan["pairs"][day_index // 2]
    arm_key = "A" if day_index % 2 == 0 else "B"
    arm = pair["arms"][arm_key]
    return {
        "plan_name": plan.get("name", ""),
        "pair_id": pair["id"],
        "variable": pair["variable"],
        "topic": pair["topic"],
        "arm": arm_key,
        "arm_label": arm["label"],
        "day_number": day_index + 1,
        "settings": {**plan["baseline"], **arm["settings"]},
    }


def iter_schedule(plan: dict[str, Any], settings: dict[str, Any]):
    """計画の全日程を (日付, 何日目, 組, 案) の順に列挙する。"""
    start = date.fromisoformat(settings["start_date"])
    for day_index in range(plan_days(plan)):
        pair = plan["pairs"][day_index // 2]
        arm_key = "A" if day_index % 2 == 0 else "B"
        yield start + timedelta(days=day_index), day_index + 1, pair, arm_key


# --------------------------------------------------------------------------
# 実測値の記録
# --------------------------------------------------------------------------
def find_job(jobs: list[dict[str, Any]], target: str) -> dict[str, Any]:
    """job_id か「YYYY-MM-DD」で対象の動画を1本に絞る。"""
    by_id = [job for job in jobs if job.get("job_id") == target]
    if len(by_id) == 1:
        return by_id[0]

    try:
        date.fromisoformat(target)
    except ValueError:
        raise PlanError(
            f'"{target}" に当てはまる動画がありません。'
            f"job_id か、公開日を YYYY-MM-DD の形で指定してください。"
        ) from None

    same_day = [job for job in jobs if str(job.get("publish_at_local", "")).startswith(target)]
    tested = [job for job in same_day if job.get("experiment")]
    candidates = tested or same_day
    if not candidates:
        raise PlanError(f"{target} に予約された動画が履歴にありません。")
    if len(candidates) > 1:
        listing = "\n".join(
            f'  {job.get("job_id")}  {job.get("publish_at_local")}  {job.get("title", "")}'
            for job in candidates
        )
        raise PlanError(
            f"{target} に複数の動画があります。job_id で指定してください。\n{listing}"
        )
    return candidates[0]


def record_metrics(job: dict[str, Any], metrics: dict[str, float], now: datetime) -> None:
    stored = job.setdefault("metrics", {})
    stored.update(metrics)
    stored["recorded_at"] = now.isoformat()


# --------------------------------------------------------------------------
# 集計
# --------------------------------------------------------------------------
def _fmt(value: Any, unit: str) -> str:
    if value is None:
        return "未記録"
    if unit == "回":
        return f"{int(value):,}{unit}"
    if unit == "秒":
        return f"{float(value):.1f}{unit}"
    return f"{float(value):.1f}{unit}"


def build_report(plan: dict[str, Any], jobs: list[dict[str, Any]], settings: dict[str, Any]) -> list[str]:
    """A案とB案を並べた比較表を、表示用の行のリストとして返す。"""
    thresholds = plan.get("win_threshold", {})
    min_views = plan.get("min_views_for_judgement")
    primary = plan.get("primary_metrics", ["retention_5s", "avg_view_pct"])

    # pair_id -> arm -> job
    booked: dict[str, dict[str, dict[str, Any]]] = {}
    for job in jobs:
        info = job.get("experiment")
        if not info:
            continue
        booked.setdefault(info["pair_id"], {})[info["arm"]] = job

    lines = [f"==== {plan.get('name', 'ABテスト')} の結果 ===="]
    decided = 0

    for index, pair in enumerate(plan["pairs"], start=1):
        arms = booked.get(pair["id"], {})
        lines.append("")
        lines.append(f"[{index}/{len(plan['pairs'])}] {pair['variable']}  ({pair['id']})")
        lines.append(f"  テーマ: {pair['topic']}")

        for arm_key in ("A", "B"):
            arm = pair["arms"][arm_key]
            job = arms.get(arm_key)
            if job is None:
                lines.append(f"  {arm_key}案 ({arm['label']}): まだ作られていません")
                continue
            metrics = job.get("metrics", {})
            values = "  ".join(
                f"{label}={_fmt(metrics.get(key), unit)}"
                for key, (label, unit) in METRIC_FIELDS.items()
                if key in metrics or key in primary
            )
            lines.append(f"  {arm_key}案 ({arm['label']}): {job.get('title', '(タイトル未定)')}")
            lines.append(f"       {values}")

        job_a, job_b = arms.get("A"), arms.get("B")
        if not job_a or not job_b:
            lines.append("  判定: 2本そろっていないため保留")
            continue

        metrics_a = job_a.get("metrics", {})
        metrics_b = job_b.get("metrics", {})
        verdicts: list[str] = []
        for key in primary:
            label = METRIC_FIELDS.get(key, (key, ""))[0]
            value_a, value_b = metrics_a.get(key), metrics_b.get(key)
            if value_a is None or value_b is None:
                verdicts.append(f"{label}: 実測が未記録")
                continue
            threshold = thresholds.get(key)
            diff = float(value_a) - float(value_b)
            if threshold is None:
                verdicts.append(f"{label}: 差 {diff:+.1f}ポイント (基準なし)")
            elif diff >= float(threshold):
                verdicts.append(f"{label}: A案の勝ち (差 {diff:+.1f}ポイント)")
            elif -diff >= float(threshold):
                verdicts.append(f"{label}: B案の勝ち (差 {diff:+.1f}ポイント)")
            else:
                verdicts.append(
                    f"{label}: 差 {diff:+.1f}ポイントで基準{threshold}未満のため引き分け"
                )
        for verdict in verdicts:
            lines.append(f"  判定: {verdict}")

        if min_views is not None:
            thin = [
                f"{arm_key}案 {int(job.get('metrics', {}).get('views', 0)):,}回"
                for arm_key, job in (("A", job_a), ("B", job_b))
                if job.get("metrics", {}).get("views") is not None
                and int(job["metrics"]["views"]) < int(min_views)
            ]
            if thin:
                lines.append(
                    f"  注意: 再生数が判定の目安 {int(min_views):,}回 に届いていません "
                    f"({', '.join(thin)})。差は偶然の可能性があります。"
                )
        if all("勝ち" in v or "引き分け" in v for v in verdicts) and verdicts:
            decided += 1

    lines.append("")
    lines.append(f"判定できた組: {decided} / {len(plan['pairs'])}")
    lines.append(
        "注意: 1組あたり各案1本のため、差は台本の条件以外(テーマ・配信量・曜日)の影響も含みます。"
    )
    lines.append("=" * 34)
    return lines
