#!/usr/bin/env python3
"""ガソリン代の領収書金額を運転手ごとの距離按分で計算し、スプレッドシートに書き込む

使い方:
    python calc_fuel_cost.py --receipts 5427,3293,4011 --month 2026.8
    python calc_fuel_cost.py --receipts-file sample_data/receipts.json --month 2026.8

ガソリン代按分は運行表と同じタブ(--month で指定したシート)の下部に書き込む。
対象シートが既に存在している必要がある(先に update_driving_log.py を実行しておくこと)。
"""
import argparse
import csv
import json
import sys
from pathlib import Path

from config import ConfigError, load_config
from layout import (
    COL_A_DISTANCE, COL_B_DISTANCE, COL_DAY, COL_FUEL_LABEL, COL_FUEL_VALUE,
    FUEL_A_DIST_ROW, FUEL_A_SHARE_ROW, FUEL_B_DIST_ROW, FUEL_B_SHARE_ROW,
    FUEL_SECTION_ROW, FUEL_SECTION_TITLE, FUEL_TOTAL_ROW, MAX_RECEIPTS,
    RECEIPT_END_ROW, RECEIPT_START_ROW, TOTAL_ROW,
)
from sheets_client import (
    build_services, get_sheet_titles, verify_spreadsheet_access, write_values,
)


def parse_amount(value):
    try:
        amount = float(value)
    except (TypeError, ValueError):
        raise ConfigError(f"領収書金額は数値である必要があります (値: {value!r})")
    if amount <= 0:
        raise ConfigError(f"領収書金額は正の数値である必要があります (値: {value!r})")
    return amount


def parse_receipts_arg(raw: str):
    parts = [p.strip() for p in raw.split(",") if p.strip() != ""]
    return [parse_amount(p) for p in parts]


def load_receipts_file(path: Path):
    suffix = path.suffix.lower()
    if suffix == ".json":
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            data = data.get("receipts", [])
        return [parse_amount(v) for v in data]
    if suffix == ".csv":
        with path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            cells = [cell for row in reader for cell in row if cell.strip() != ""]
        return [parse_amount(v) for v in cells]
    raise ConfigError(f"対応していないファイル形式です: {path.suffix} (JSONまたはCSVを指定してください)")


def write_fuel_section(sheets_service, spreadsheet_id, sheet_name, receipts):
    """運行表と同じシートの下部にガソリン代按分セクションを書き込む"""
    write_values(
        sheets_service, spreadsheet_id,
        f"'{sheet_name}'!{COL_DAY}{FUEL_SECTION_ROW}",
        [[FUEL_SECTION_TITLE]], raw=True,
    )

    receipt_rows = []
    for i in range(MAX_RECEIPTS):
        amount = receipts[i] if i < len(receipts) else ""
        receipt_rows.append([f"領収書{i + 1}", amount])
    write_values(
        sheets_service, spreadsheet_id,
        f"'{sheet_name}'!{COL_FUEL_LABEL}{RECEIPT_START_ROW}:{COL_FUEL_VALUE}{RECEIPT_END_ROW}",
        receipt_rows, raw=True,
    )

    a_dist = f"{COL_FUEL_VALUE}{FUEL_A_DIST_ROW}"
    b_dist = f"{COL_FUEL_VALUE}{FUEL_B_DIST_ROW}"
    total = f"{COL_FUEL_VALUE}{FUEL_TOTAL_ROW}"
    summary_rows = [
        ["合計金額", f"=SUM({COL_FUEL_VALUE}{RECEIPT_START_ROW}:{COL_FUEL_VALUE}{RECEIPT_END_ROW})"],
        ["A距離(km)", f"={COL_A_DISTANCE}{TOTAL_ROW}"],
        ["B距離(km)", f"={COL_B_DISTANCE}{TOTAL_ROW}"],
        ["A負担額", f"=IF(({a_dist}+{b_dist})=0, 0, {total}*{a_dist}/({a_dist}+{b_dist}))"],
        ["B負担額", f"=IF(({a_dist}+{b_dist})=0, 0, {total}*{b_dist}/({a_dist}+{b_dist}))"],
    ]
    write_values(
        sheets_service, spreadsheet_id,
        f"'{sheet_name}'!{COL_FUEL_LABEL}{FUEL_TOTAL_ROW}:{COL_FUEL_VALUE}{FUEL_B_SHARE_ROW}",
        summary_rows,
    )


def main():
    parser = argparse.ArgumentParser(description="ガソリン代を距離按分し、スプレッドシートに反映します")
    parser.add_argument("--receipts", help="領収書金額をカンマ区切りで指定 (例: 5427,3293,4011)")
    parser.add_argument("--receipts-file", help="領収書金額を記載したJSON/CSVファイル")
    parser.add_argument("--month", required=True, help="対象月・シート名 (例: 2026.8)")
    args = parser.parse_args()

    if not args.receipts and not args.receipts_file:
        print("エラー: --receipts か --receipts-file のいずれかを指定してください。", file=sys.stderr)
        sys.exit(1)

    try:
        config = load_config()

        if args.receipts:
            receipts = parse_receipts_arg(args.receipts)
        else:
            receipts_path = Path(args.receipts_file)
            if not receipts_path.exists():
                raise ConfigError(f"領収書データファイルが見つかりません: {receipts_path}")
            receipts = load_receipts_file(receipts_path)

        if not receipts:
            raise ConfigError("領収書金額が1件も指定されていません。")
        if len(receipts) > MAX_RECEIPTS:
            raise ConfigError(
                f"領収書は最大{MAX_RECEIPTS}件までです({len(receipts)}件指定されました)。"
            )

        sheets_service, drive_service = build_services(config["service_account_file"])
        spreadsheet_id = config["spreadsheet_id"]
        verify_spreadsheet_access(drive_service, spreadsheet_id)

        if args.month not in get_sheet_titles(sheets_service, spreadsheet_id):
            raise ConfigError(
                f"シート '{args.month}' が見つかりません。"
                f"先に update_driving_log.py で '{args.month}' シートを作成してください。"
            )

        write_fuel_section(sheets_service, spreadsheet_id, args.month, receipts)

        print(f"'{args.month}' シートに {len(receipts)}件の領収書データを反映しました。")
        print(
            f"ガソリン代按分は{FUEL_SECTION_ROW}行目以降です "
            f"(A負担額: {COL_FUEL_VALUE}{FUEL_A_SHARE_ROW}, B負担額: {COL_FUEL_VALUE}{FUEL_B_SHARE_ROW})"
        )

    except ConfigError as e:
        print(f"エラー: {e}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"エラー: JSONの形式が不正です: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
