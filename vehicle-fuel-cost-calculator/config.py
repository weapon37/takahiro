"""設定の読み込み(.env または config.json)"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


class ConfigError(Exception):
    """設定不備・API呼び出し失敗など、ユーザーに直接伝えるべきエラー"""


def _load_config_file():
    config_path = Path(os.environ.get("CONFIG_FILE", "config.json"))
    if not config_path.exists():
        return {}
    try:
        with config_path.open(encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise ConfigError(f"config.jsonの読み込みに失敗しました: {e}") from e


def load_config():
    file_config = _load_config_file()

    def get(key, default=None, required=False):
        value = file_config.get(key) or os.environ.get(key) or default
        if required and not value:
            raise ConfigError(
                f"設定 '{key}' が見つかりません。.env または config.json に設定してください。"
            )
        return value

    return {
        "service_account_file": get("GOOGLE_SERVICE_ACCOUNT_FILE", required=True),
        "spreadsheet_id": get("SPREADSHEET_ID", required=True),
        "fuel_sheet_name": get("FUEL_SHEET_NAME", default="ガソリン代按分"),
    }
