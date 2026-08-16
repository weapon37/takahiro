"""YouTube Data API v3 の共通処理。

外部ライブラリは使わない(標準ライブラリのみ)。make_voice_google.py と同じ方針。

認証情報の置き場所:
  shorts/client_secret.json   … Google Cloud Console からダウンロードしたもの
  shorts/.youtube_token.json  … youtube_auth.py が作るリフレッシュトークン

どちらも .gitignore 済み。**絶対にコミットしないこと。**
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT_SECRET = os.path.join(HERE, "client_secret.json")
TOKEN_FILE = os.path.join(HERE, ".youtube_token.json")

TOKEN_URL = "https://oauth2.googleapis.com/token"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
API_BASE = "https://www.googleapis.com/youtube/v3"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"

# upload = 投稿、readonly = 一覧の取得(ストック確認用)
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
]


class YouTubeError(Exception):
    pass


def load_client_secret():
    """Console からダウンロードした client_secret.json を読む。"""
    if not os.path.exists(CLIENT_SECRET):
        raise YouTubeError(
            f"{CLIENT_SECRET} がありません。\n"
            "docs/youtube_api_setup.md の手順1〜3で作成してください。"
        )
    with open(CLIENT_SECRET, encoding="utf-8") as f:
        data = json.load(f)
    # デスクトップアプリなら "installed"、ウェブなら "web" キーに入っている
    conf = data.get("installed") or data.get("web")
    if not conf:
        raise YouTubeError(
            "client_secret.json の形式が想定と違います。"
            "OAuthクライアントの種類を『デスクトップアプリ』で作り直してください。"
        )
    return conf["client_id"], conf["client_secret"]


def save_refresh_token(refresh_token: str) -> None:
    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        json.dump({"refresh_token": refresh_token}, f)
    os.chmod(TOKEN_FILE, 0o600)


def load_refresh_token() -> str:
    if not os.path.exists(TOKEN_FILE):
        raise YouTubeError(
            f"{TOKEN_FILE} がありません。\n"
            "先に `python3 tools/youtube_auth.py` を実行して認証してください。"
        )
    with open(TOKEN_FILE, encoding="utf-8") as f:
        return json.load(f)["refresh_token"]


def get_access_token() -> str:
    """リフレッシュトークンからアクセストークンを取り直す(有効期限は1時間)。"""
    client_id, client_secret = load_client_secret()
    body = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": load_refresh_token(),
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=body)
    try:
        with urllib.request.urlopen(req) as res:
            return json.load(res)["access_token"]
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise YouTubeError(
            f"アクセストークンの取得に失敗しました({e.code})。\n{detail}\n"
            "リフレッシュトークンが失効している場合は youtube_auth.py をやり直してください。"
        ) from e


def api_get(path: str, params: dict, token: str) -> dict:
    """読み取り系のAPIを叩く。"""
    url = f"{API_BASE}/{path}?" + urllib.parse.urlencode(params, doseq=True)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise YouTubeError(f"APIエラー({e.code}) {path}\n{detail}") from e
