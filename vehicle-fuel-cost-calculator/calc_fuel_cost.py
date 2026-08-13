#!/usr/bin/env python3
"""ガソリン代の領収書金額を運転手ごとの距離按分で計算し、スプレッドシートに書き込む

使い方:
    python calc_fuel_cost.py --receipts 5427,3293,4011 --month 2026.8
    python calc_fuel_cost.py --receipts-file sample_data/receipts.json --month 2026.8

対象月(--month)の運行表シートが既に存在し、A距離・B距離の合計が
書き込まれている必要がある(先に update_driving_log.py を実行しておくこと)。
"""
import argparse
import csv
import json
import sys
from pathlib import Path

from config import ConfigError, load_config
from layout import (
    COL_A_DISTANCE, COL_B_DISTANCE, COL_FUEL_A_DIST, COL_FUEL_A_SHARE,
    COL_FUEL_B_DIST, COL_FUEL_B_SHARE, COL_FUEL_TOTAL, COL_MONTH,
    FUEL_DATA_START_ROW, FUEL_HEADER_ROW, FUEL_HEADERS, MAX_RECEIPTS, TOTAL_ROW,
)
from sheets_client import (
    build_services, ensure_sheet_exists, get_sheet_titles, read_values,
    verify_spreadsheet_access, write_values,
)

RECEIPT_COLS = [chr(ord("B") + i) for i in range(MAX_RECEIPTS)]


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


def find_or_append_row(sheets_service, spreadsheet_id, sheet_name, month):
    existing = read_values(
        sheets_service, spreadsheet_id,
        f"'{sheet_name}'!{COL_MONTH}{FUEL_DATA_START_ROW}:{COL_MONTH}",
    )
    for i, row in enumerate(existing):
        if row and row[0] == month:
            return FUEL_DATA_START_ROW + i
    return FUEL_DATA_START_ROW + len(existing)


def main():
    parser = argparse.ArgumentParser(description="ガソリン代を距離按分し、スプレッドシートに反映します")
    parser.add_argument("--receipts", help="領収書金額をカンマ区切りで指定 (例: 5427,3293,4011)")
    parser.add_argument("--receipts-file", help="領収書金額を記載したJSON/CSVファイル")
    parser.add_argument("--month", required=True, help="対象月・運行表シート名 (例: 2026.8)")
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
                f"1回のガソリン代按分では領収書は最大{MAX_RECEIPTS}件までです"
                f"({len(receipts)}件指定されました)。"
            )

        sheets_service, drive_service = build_services(config["service_account_file"])
        spreadsheet_id = config["spreadsheet_id"]
        verify_spreadsheet_access(drive_service, spreadsheet_id)

        driving_log_titles = get_sheet_titles(sheets_service, spreadsheet_id)
        if args.month not in driving_log_titles:
            raise ConfigError(
                f"運行表シート '{args.month}' が見つかりません。"
                f"先に update_driving_log.py で '{args.month}' シートを作成してください。"
            )

        fuel_sheet = config["fuel_sheet_name"]
        ensure_sheet_exists(sheets_service, spreadsheet_id, fuel_sheet)

        write_values(
            sheets_service, spreadsheet_id,
            f"'{fuel_sheet}'!{COL_MONTH}{FUEL_HEADER_ROW}:{COL_FUEL_B_SHARE}{FUEL_HEADER_ROW}",
            [FUEL_HEADERS],
        )

        row = find_or_append_row(sheets_service, spreadsheet_id, fuel_sheet, args.month)

        receipt_row = [""] * MAX_RECEIPTS
        for i, amount in enumerate(receipts):
            receipt_row[i] = amount

        last_receipt_col = RECEIPT_COLS[-1]
        total_formula = f"=SUM(B{row}:{last_receipt_col}{row})"
        a_dist_formula = f"='{args.month}'!{COL_A_DISTANCE}{TOTAL_ROW}"
        b_dist_formula = f"='{args.month}'!{COL_B_DISTANCE}{TOTAL_ROW}"
        a_share_formula = (
            f"=IF(({COL_FUEL_A_DIST}{row}+{COL_FUEL_B_DIST}{row})=0, 0, "
            f"{COL_FUEL_TOTAL}{row}*{COL_FUEL_A_DIST}{row}/"
            f"({COL_FUEL_A_DIST}{row}+{COL_FUEL_B_DIST}{row}))"
        )
        b_share_formula = (
            f"=IF(({COL_FUEL_A_DIST}{row}+{COL_FUEL_B_DIST}{row})=0, 0, "
            f"{COL_FUEL_TOTAL}{row}*{COL_FUEL_B_DIST}{row}/"
            f"({COL_FUEL_A_DIST}{row}+{COL_FUEL_B_DIST}{row}))"
        )

        row_values = (
            [args.month]
            + receipt_row
            + [total_formula, a_dist_formula, b_dist_formula, a_share_formula, b_share_formula]
        )
        write_values(
            sheets_service, spreadsheet_id,
            f"'{fuel_sheet}'!{COL_MONTH}{row}:{COL_FUEL_B_SHARE}{row}",
            [row_values],
        )

        print(f"'{fuel_sheet}' シートの{row}行目に {len(receipts)}件の領収書データを反映しました。")
        print(f"対象月: {args.month} / 領収書合計(数式): {total_formula}")

    except ConfigError as e:
        print(f"エラー: {e}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"エラー: JSONの形式が不正です: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
