#!/usr/bin/env python3
"""スプレッドシートに月次タブのテンプレート(運行表+ガソリン代按分)を作成する

使い方:
    python init_sheet.py --month 2026.8

既存の同名タブがある場合は中身を上書きするため、実データが入っている場合は注意すること。
"""
import argparse
import sys

from config import ConfigError, load_config
from layout import (
    COL_A_DISTANCE, COL_B_DISTANCE, COL_DAY, COL_DISTANCE, COL_DRIVER,
    COL_FUEL_LABEL, COL_FUEL_VALUE, DATA_START_ROW, DRIVING_LOG_HEADERS,
    FUEL_A_DIST_ROW, FUEL_B_DIST_ROW, FUEL_B_SHARE_ROW, FUEL_SECTION_ROW,
    FUEL_SECTION_TITLE, FUEL_TOTAL_ROW, HEADER_ROW, MAX_DAYS, MAX_RECEIPTS,
    RECEIPT_END_ROW, RECEIPT_START_ROW, TOTAL_ROW,
)
from sheets_client import (
    build_services, ensure_sheet_exists, get_sheet_id, verify_spreadsheet_access,
    write_values,
)

HEADER_BG = {"red": 0.85, "green": 0.85, "blue": 0.85}
INPUT_BG = {"red": 1.0, "green": 0.95, "blue": 0.80}
TOTAL_BG = {"red": 0.89, "green": 0.94, "blue": 0.86}
SECTION_BG = {"red": 0.74, "green": 0.84, "blue": 0.94}
FORMULA_COLOR = {"red": 0.0, "green": 0.5, "blue": 0.0}

LEGEND_NOTES = [
    "使い方",
    "・黄色のセルだけ入力してください(運行表の終了距離数・移動距離・運転手・備考、ガソリン代の領収書金額)。",
    "・運転手欄は A / B / AB のいずれかを入力。AB はその日の移動距離を1/2ずつA・Bに按分します。",
    "・緑文字のセル(A距離・B距離・合計・ガソリン代の各金額)は数式で自動計算されるため編集不要です。",
    "・A/B負担額は、ガソリン代合計を月間の走行距離比(A距離:B距離)で按分した金額です。",
    "・翌月分はこのタブを右クリック→「コピーを作成」し、タブ名を「YYYY.M」(例: 2026.9)に変更してください。",
]


def build_content(sheet_name):
    """(range, values, raw) のリストを返す"""
    blocks = []

    blocks.append((
        f"'{sheet_name}'!{COL_DAY}{HEADER_ROW}:{COL_B_DISTANCE}{HEADER_ROW}",
        [DRIVING_LOG_HEADERS], True,
    ))

    rows = []
    for offset in range(MAX_DAYS):
        row = DATA_START_ROW + offset
        rows.append([
            offset + 1, "", "", "", "",
            f'=IF({COL_DRIVER}{row}="AB", {COL_DISTANCE}{row}/2, '
            f'IF({COL_DRIVER}{row}="A", {COL_DISTANCE}{row}, 0))',
            f'=IF({COL_DRIVER}{row}="AB", {COL_DISTANCE}{row}/2, '
            f'IF({COL_DRIVER}{row}="B", {COL_DISTANCE}{row}, 0))',
        ])
    blocks.append((
        f"'{sheet_name}'!{COL_DAY}{DATA_START_ROW}:{COL_B_DISTANCE}{DATA_START_ROW + MAX_DAYS - 1}",
        rows, False,
    ))

    blocks.append((
        f"'{sheet_name}'!{COL_DAY}{TOTAL_ROW}:{COL_B_DISTANCE}{TOTAL_ROW}",
        [[
            "合計", "",
            f"=SUM({COL_DISTANCE}{DATA_START_ROW}:{COL_DISTANCE}{TOTAL_ROW - 1})", "", "",
            f"=SUM({COL_A_DISTANCE}{DATA_START_ROW}:{COL_A_DISTANCE}{TOTAL_ROW - 1})",
            f"=SUM({COL_B_DISTANCE}{DATA_START_ROW}:{COL_B_DISTANCE}{TOTAL_ROW - 1})",
        ]], False,
    ))

    blocks.append((f"'{sheet_name}'!{COL_DAY}{FUEL_SECTION_ROW}", [[FUEL_SECTION_TITLE]], True))

    blocks.append((
        f"'{sheet_name}'!{COL_FUEL_LABEL}{RECEIPT_START_ROW}:{COL_FUEL_VALUE}{RECEIPT_END_ROW}",
        [[f"領収書{i + 1}", ""] for i in range(MAX_RECEIPTS)], True,
    ))

    a_dist = f"{COL_FUEL_VALUE}{FUEL_A_DIST_ROW}"
    b_dist = f"{COL_FUEL_VALUE}{FUEL_B_DIST_ROW}"
    total = f"{COL_FUEL_VALUE}{FUEL_TOTAL_ROW}"
    blocks.append((
        f"'{sheet_name}'!{COL_FUEL_LABEL}{FUEL_TOTAL_ROW}:{COL_FUEL_VALUE}{FUEL_B_SHARE_ROW}",
        [
            ["合計金額", f"=SUM({COL_FUEL_VALUE}{RECEIPT_START_ROW}:{COL_FUEL_VALUE}{RECEIPT_END_ROW})"],
            ["A距離(km)", f"={COL_A_DISTANCE}{TOTAL_ROW}"],
            ["B距離(km)", f"={COL_B_DISTANCE}{TOTAL_ROW}"],
            ["A負担額", f"=IF(({a_dist}+{b_dist})=0, 0, {total}*{a_dist}/({a_dist}+{b_dist}))"],
            ["B負担額", f"=IF(({a_dist}+{b_dist})=0, 0, {total}*{b_dist}/({a_dist}+{b_dist}))"],
        ], False,
    ))

    legend_start = FUEL_B_SHARE_ROW + 2
    blocks.append((
        f"'{sheet_name}'!{COL_DAY}{legend_start}:{COL_DAY}{legend_start + len(LEGEND_NOTES) - 1}",
        [[note] for note in LEGEND_NOTES], True,
    ))

    return blocks


def _repeat_cell(sheet_id, start_row, end_row, start_col, end_col, cell, fields):
    """行・列は0始まり、endは含まない"""
    return {"repeatCell": {
        "range": {
            "sheetId": sheet_id,
            "startRowIndex": start_row, "endRowIndex": end_row,
            "startColumnIndex": start_col, "endColumnIndex": end_col,
        },
        "cell": cell,
        "fields": fields,
    }}


def build_format_requests(sheet_id):
    requests = []

    # ヘッダー行
    requests.append(_repeat_cell(
        sheet_id, 0, 1, 0, 7,
        {"userEnteredFormat": {
            "backgroundColor": HEADER_BG,
            "textFormat": {"bold": True},
            "horizontalAlignment": "CENTER",
            "wrapStrategy": "WRAP",
        }},
        "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,wrapStrategy)",
    ))

    # 運行表の入力欄 (B〜E, 2〜32行)
    requests.append(_repeat_cell(
        sheet_id, DATA_START_ROW - 1, TOTAL_ROW - 1, 1, 5,
        {"userEnteredFormat": {"backgroundColor": INPUT_BG}},
        "userEnteredFormat.backgroundColor",
    ))

    # A距離・B距離 (F〜G) は数式なので緑文字
    requests.append(_repeat_cell(
        sheet_id, DATA_START_ROW - 1, TOTAL_ROW - 1, 5, 7,
        {"userEnteredFormat": {
            "textFormat": {"foregroundColor": FORMULA_COLOR},
            "numberFormat": {"type": "NUMBER", "pattern": "#,##0.0"},
        }},
        "userEnteredFormat(textFormat,numberFormat)",
    ))

    # 合計行
    requests.append(_repeat_cell(
        sheet_id, TOTAL_ROW - 1, TOTAL_ROW, 0, 7,
        {"userEnteredFormat": {
            "backgroundColor": TOTAL_BG,
            "textFormat": {"bold": True},
            "numberFormat": {"type": "NUMBER", "pattern": "#,##0.0"},
        }},
        "userEnteredFormat(backgroundColor,textFormat,numberFormat)",
    ))

    # ガソリン代セクション見出し
    requests.append(_repeat_cell(
        sheet_id, FUEL_SECTION_ROW - 1, FUEL_SECTION_ROW, 0, 7,
        {"userEnteredFormat": {
            "backgroundColor": SECTION_BG,
            "textFormat": {"bold": True, "fontSize": 12},
        }},
        "userEnteredFormat(backgroundColor,textFormat)",
    ))

    # 領収書の入力欄 (C列)
    requests.append(_repeat_cell(
        sheet_id, RECEIPT_START_ROW - 1, RECEIPT_END_ROW, 2, 3,
        {"userEnteredFormat": {
            "backgroundColor": INPUT_BG,
            "numberFormat": {"type": "CURRENCY", "pattern": "¥#,##0"},
        }},
        "userEnteredFormat(backgroundColor,numberFormat)",
    ))

    # ガソリン代の集計行 (B〜C, 46〜50行)
    requests.append(_repeat_cell(
        sheet_id, FUEL_TOTAL_ROW - 1, FUEL_B_SHARE_ROW, 1, 3,
        {"userEnteredFormat": {
            "backgroundColor": TOTAL_BG,
            "textFormat": {"bold": True},
        }},
        "userEnteredFormat(backgroundColor,textFormat)",
    ))
    # 金額行は通貨表示・緑文字 (合計金額/A負担額/B負担額)
    for row in (FUEL_TOTAL_ROW, FUEL_B_SHARE_ROW - 1, FUEL_B_SHARE_ROW):
        requests.append(_repeat_cell(
            sheet_id, row - 1, row, 2, 3,
            {"userEnteredFormat": {
                "textFormat": {"bold": True, "foregroundColor": FORMULA_COLOR},
                "numberFormat": {"type": "CURRENCY", "pattern": "¥#,##0"},
            }},
            "userEnteredFormat(textFormat,numberFormat)",
        ))
    # 距離行は数値表示・緑文字
    for row in (FUEL_A_DIST_ROW, FUEL_B_DIST_ROW):
        requests.append(_repeat_cell(
            sheet_id, row - 1, row, 2, 3,
            {"userEnteredFormat": {
                "textFormat": {"bold": True, "foregroundColor": FORMULA_COLOR},
                "numberFormat": {"type": "NUMBER", "pattern": "#,##0.0"},
            }},
            "userEnteredFormat(textFormat,numberFormat)",
        ))

    # 列幅
    for col_index, width in enumerate([50, 120, 110, 130, 180, 100, 100]):
        requests.append({"updateDimensionProperties": {
            "range": {
                "sheetId": sheet_id, "dimension": "COLUMNS",
                "startIndex": col_index, "endIndex": col_index + 1,
            },
            "properties": {"pixelSize": width},
            "fields": "pixelSize",
        }})

    # ヘッダー行を固定
    requests.append({"updateSheetProperties": {
        "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
        "fields": "gridProperties.frozenRowCount",
    }})

    return requests


def main():
    parser = argparse.ArgumentParser(description="月次タブのテンプレートを作成します")
    parser.add_argument("--month", required=True, help="作成するタブ名 (例: 2026.8)")
    args = parser.parse_args()

    try:
        config = load_config()
        sheets_service, drive_service = build_services(config["service_account_file"])
        spreadsheet_id = config["spreadsheet_id"]
        verify_spreadsheet_access(drive_service, spreadsheet_id)

        ensure_sheet_exists(sheets_service, spreadsheet_id, args.month)

        for range_name, values, raw in build_content(args.month):
            write_values(sheets_service, spreadsheet_id, range_name, values, raw=raw)

        sheet_id = get_sheet_id(sheets_service, spreadsheet_id, args.month)
        sheets_service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"requests": build_format_requests(sheet_id)},
        ).execute()

        print(f"タブ '{args.month}' にテンプレートを作成しました。")

    except ConfigError as e:
        print(f"エラー: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
