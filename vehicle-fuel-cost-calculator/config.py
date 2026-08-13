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


_FILE_CONFIG = _load_config_file()


def get_setting(key, default=None, required=False):
    """個別の設定値を .env / config.json / 環境変数から取得する"""
    value = _FILE_CONFIG.get(key) or os.environ.get(key) or default
    if required and not value:
        raise ConfigError(
            f"設定 '{key}' が見つかりません。.env または config.json に設定してください。"
        )
    return value


def load_config():
    """Google Sheets連携に必要な設定一式を取得する"""
    return {
        "service_account_file": get_setting("GOOGLE_SERVICE_ACCOUNT_FILE", required=True),
        "spreadsheet_id": get_setting("SPREADSHEET_ID", required=True),
    }
