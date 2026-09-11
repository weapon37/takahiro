#!/usr/bin/env python3
"""車両運行表のデータをGoogleスプレッドシートに書き込む

使い方:
    python update_driving_log.py --data driving_log.json
    python update_driving_log.py --data driving_log.csv --sheet 2026.8

driving_log.json の形式:
    {
      "sheet": "2026.8",
      "entries": [
        {"day": 1, "end_km": 45210, "distance_km": 18, "driver": "A", "note": "通勤"},
        {"day": 3, "end_km": 45260, "distance_km": 50, "driver": "AB", "note": "買い物"}
      ]
    }

driving_log.csv の形式 (--sheet で対象シート名を別途指定する):
    day,end_km,distance_km,driver,note
    1,45210,18,A,通勤
    3,45260,50,AB,買い物
"""
import argparse
import csv
import sys
from pathlib import Path

import json as jsonlib

from config import ConfigError, load_config
from layout import (
    COL_A_DISTANCE, COL_B_DISTANCE, COL_DAY, COL_DISTANCE, COL_DRIVER,
    COL_END_KM, COL_NOTE, DATA_START_ROW, DRIVING_LOG_HEADERS, HEADER_ROW,
    MAX_DAYS, TOTAL_ROW,
)
from sheets_client import (
    build_services, ensure_sheet_exists, verify_spreadsheet_access, write_values,
)

VALID_DRIVERS = {"A", "B", "AB"}


def load_entries(data_path: Path):
    """データファイルを読み込み、(シート名 or None, 生のエントリ一覧)を返す"""
    if data_path.suffix.lower() == ".csv":
        with data_path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            return None, list(reader)

    with data_path.open(encoding="utf-8") as f:
        data = jsonlib.load(f)
    if isinstance(data, list):
        return None, data
    return data.get("sheet"), data.get("entries", [])


def validate_entry(entry, index):
    def fail(msg):
        raise ConfigError(f"{index + 1}件目のデータが不正です: {msg}\n内容: {entry}")

    raw_day = entry.get("day")
    try:
        day = int(raw_day)
    except (TypeError, ValueError):
        fail(f"'day' は1〜31の整数である必要があります (値: {raw_day!r})")
    if not (1 <= day <= MAX_DAYS):
        fail(f"'day' は1〜{MAX_DAYS}の範囲である必要があります (値: {day})")

    def to_number(key):
        value = entry.get(key)
        if value in (None, ""):
            return ""
        try:
            return float(value)
        except (TypeError, ValueError):
            fail(f"'{key}' は数値である必要があります (値: {value!r})")

    end_km = to_number("end_km")
    distance_km = to_number("distance_km")

    driver = str(entry.get("driver", "")).strip().upper()
    if driver not in VALID_DRIVERS:
        fail(f"'driver' は A・B・AB のいずれかである必要があります (値: {entry.get('driver')!r})")

    note = entry.get("note") or ""

    return {
        "day": day,
        "end_km": end_km,
        "distance_km": distance_km,
        "driver": driver,
        "note": note,
    }


def build_formula_rows():
    """A距離・B距離のIF数式を31日分作成する(未入力行は0になる)"""
    rows = []
    for offset in range(MAX_DAYS):
        row = DATA_START_ROW + offset
        a_formula = (
            f'=IF({COL_DRIVER}{row}="AB", {COL_DISTANCE}{row}/2, '
            f'IF({COL_DRIVER}{row}="A", {COL_DISTANCE}{row}, 0))'
        )
        b_formula = (
            f'=IF({COL_DRIVER}{row}="AB", {COL_DISTANCE}{row}/2, '
            f'IF({COL_DRIVER}{row}="B", {COL_DISTANCE}{row}, 0))'
        )
        rows.append([a_formula, b_formula])
    return rows


def write_driving_log(sheets_service, spreadsheet_id, sheet_name, entries):
    """検証済みentries(validate_entryの戻り値のリスト)を運行表シートに書き込む"""
    ensure_sheet_exists(sheets_service, spreadsheet_id, sheet_name)

    write_values(
        sheets_service, spreadsheet_id,
        f"'{sheet_name}'!{COL_DAY}{HEADER_ROW}:{COL_B_DISTANCE}{HEADER_ROW}",
        [DRIVING_LOG_HEADERS],
    )

    day_values = [[d] for d in range(1, MAX_DAYS + 1)]
    write_values(
        sheets_service, spreadsheet_id,
        f"'{sheet_name}'!{COL_DAY}{DATA_START_ROW}:{COL_DAY}{DATA_START_ROW + MAX_DAYS - 1}",
        day_values, raw=True,
    )

    write_values(
        sheets_service, spreadsheet_id,
        f"'{sheet_name}'!{COL_A_DISTANCE}{DATA_START_ROW}:{COL_B_DISTANCE}{DATA_START_ROW + MAX_DAYS - 1}",
        build_formula_rows(),
    )

    for entry in entries:
        row = DATA_START_ROW + entry["day"] - 1
        write_values(
            sheets_service, spreadsheet_id,
            f"'{sheet_name}'!{COL_END_KM}{row}:{COL_NOTE}{row}",
            [[entry["end_km"], entry["distance_km"], entry["driver"], entry["note"]]],
            raw=True,
        )

    write_values(
        sheets_service, spreadsheet_id,
        f"'{sheet_name}'!{COL_DAY}{TOTAL_ROW}:{COL_B_DISTANCE}{TOTAL_ROW}",
        [[
            "合計", "",
            f"=SUM({COL_DISTANCE}{DATA_START_ROW}:{COL_DISTANCE}{TOTAL_ROW - 1})",
            "", "",
            f"=SUM({COL_A_DISTANCE}{DATA_START_ROW}:{COL_A_DISTANCE}{TOTAL_ROW - 1})",
            f"=SUM({COL_B_DISTANCE}{DATA_START_ROW}:{COL_B_DISTANCE}{TOTAL_ROW - 1})",
        ]],
    )


def main():
    parser = argparse.ArgumentParser(description="車両運行表をスプレッドシートに反映します")
    parser.add_argument("--data", required=True, help="運行表データ(JSONまたはCSV)")
    parser.add_argument("--sheet", help="書き込み先シート名(JSON内のsheetより優先。例: 2026.8)")
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"エラー: データファイルが見つかりません: {data_path}", file=sys.stderr)
        sys.exit(1)

    try:
        config = load_config()

        sheet_from_data, raw_entries = load_entries(data_path)
        sheet_name = args.sheet or sheet_from_data
        if not sheet_name:
            raise ConfigError(
                "書き込み先シート名が指定されていません。"
                "JSONの 'sheet' か --sheet 引数で指定してください(例: 2026.8)"
            )

        entries = [validate_entry(e, i) for i, e in enumerate(raw_entries)]
        if not entries:
            raise ConfigError("データファイルに運行表データが含まれていません。")

        sheets_service, drive_service = build_services(config["service_account_file"])
        spreadsheet_id = config["spreadsheet_id"]
        verify_spreadsheet_access(drive_service, spreadsheet_id)
        write_driving_log(sheets_service, spreadsheet_id, sheet_name, entries)

        print(f"'{sheet_name}' シートに {len(entries)} 件の運行データを書き込みました。")
        print(
            f"月間合計は{TOTAL_ROW}行目です "
            f"(A距離合計: {COL_A_DISTANCE}{TOTAL_ROW}, B距離合計: {COL_B_DISTANCE}{TOTAL_ROW})"
        )

    except ConfigError as e:
        print(f"エラー: {e}", file=sys.stderr)
        sys.exit(1)
    except jsonlib.JSONDecodeError as e:
        print(f"エラー: JSONの形式が不正です: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
