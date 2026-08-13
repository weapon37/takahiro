"""Google Sheets / Drive APIクライアントの初期化とヘルパー関数"""
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config import ConfigError

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]


def build_services(service_account_file: str):
    """サービスアカウント鍵からSheets APIとDrive APIのクライアントを作成する"""
    key_path = Path(service_account_file)
    if not key_path.exists():
        raise ConfigError(
            f"サービスアカウントの鍵ファイルが見つかりません: {service_account_file}\n"
            "GOOGLE_SERVICE_ACCOUNT_FILE の設定を確認してください。"
        )
    try:
        credentials = service_account.Credentials.from_service_account_file(
            str(key_path), scopes=SCOPES
        )
    except ValueError as e:
        raise ConfigError(f"サービスアカウント鍵ファイルの形式が不正です: {e}") from e

    sheets_service = build("sheets", "v4", credentials=credentials, cache_discovery=False)
    drive_service = build("drive", "v3", credentials=credentials, cache_discovery=False)
    return sheets_service, drive_service


def verify_spreadsheet_access(drive_service, spreadsheet_id: str):
    """Drive APIでスプレッドシートの存在とアクセス権を確認する(Sheets APIより先に分かりやすいエラーを出す)"""
    try:
        file = drive_service.files().get(
            fileId=spreadsheet_id, fields="id,name,mimeType"
        ).execute()
    except HttpError as e:
        status = e.resp.status
        if status == 404:
            raise ConfigError(
                f"スプレッドシートが見つかりません(ID: {spreadsheet_id})。"
                "SPREADSHEET_ID が正しいか確認してください。"
            ) from e
        if status == 403:
            raise ConfigError(
                "スプレッドシートへのアクセス権がありません。"
                "サービスアカウントのメールアドレスをスプレッドシートの「共有」設定に"
                "編集者として追加してください。"
            ) from e
        raise ConfigError(f"スプレッドシートの確認に失敗しました: {e}") from e

    if file.get("mimeType") != "application/vnd.google-apps.spreadsheet":
        raise ConfigError(
            f"指定されたIDはGoogleスプレッドシートではありません(ID: {spreadsheet_id})。"
        )
    return file


def get_sheet_titles(sheets_service, spreadsheet_id: str):
    try:
        meta = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    except HttpError as e:
        raise ConfigError(f"シート一覧の取得に失敗しました: {e}") from e
    return {s["properties"]["title"] for s in meta.get("sheets", [])}


def ensure_sheet_exists(sheets_service, spreadsheet_id: str, sheet_name: str):
    if sheet_name in get_sheet_titles(sheets_service, spreadsheet_id):
        return
    try:
        sheets_service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"requests": [{"addSheet": {"properties": {"title": sheet_name}}}]},
        ).execute()
    except HttpError as e:
        raise ConfigError(f"シート '{sheet_name}' の作成に失敗しました: {e}") from e


def write_values(sheets_service, spreadsheet_id: str, range_name: str, values, raw: bool = False):
    """rangeにvaluesを書き込む。raw=Trueなら文字列をそのまま(数式として解釈しない)"""
    value_input_option = "RAW" if raw else "USER_ENTERED"
    try:
        sheets_service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption=value_input_option,
            body={"values": values},
        ).execute()
    except HttpError as e:
        raise ConfigError(f"シートへの書き込みに失敗しました ({range_name}): {e}") from e


def read_values(sheets_service, spreadsheet_id: str, range_name: str):
    try:
        result = (
            sheets_service.spreadsheets()
            .values()
            .get(spreadsheetId=spreadsheet_id, range=range_name)
            .execute()
        )
    except HttpError as e:
        raise ConfigError(f"シートの読み取りに失敗しました ({range_name}): {e}") from e
    return result.get("values", [])
