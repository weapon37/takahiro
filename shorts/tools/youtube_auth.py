"""YouTube API の初回認証(1回だけ実行する)。

ブラウザで承認画面を開き、リフレッシュトークンを .youtube_token.json に保存する。
以後 youtube_upload.py / youtube_stock.py はこのトークンを使うので、
再認証は不要(取り消すか失効するまで)。

使い方:
    cd shorts
    python3 tools/youtube_auth.py

**この作業だけはブラウザ操作が必要なため、手元のMacで実行すること。**
リモート環境では承認画面を開けない。
"""

import http.server
import json
import secrets
import socketserver
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

from youtube_api import (
    AUTH_URL,
    SCOPES,
    TOKEN_URL,
    YouTubeError,
    load_client_secret,
    save_refresh_token,
)

# デスクトップアプリのクライアントは、ループバック(localhost)ならポート自由
PORT = 8765
REDIRECT_URI = f"http://localhost:{PORT}"

_result = {}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        _result.update({k: v[0] for k, v in params.items()})

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        if "code" in params:
            msg = "認証できました。このタブを閉じてターミナルに戻ってください。"
        else:
            msg = f"認証に失敗しました: {params.get('error', ['不明'])[0]}"
        self.wfile.write(f"<html><body><h2>{msg}</h2></body></html>".encode())

    def log_message(self, *args):
        pass  # アクセスログは出さない


def main():
    try:
        client_id, client_secret = load_client_secret()
    except YouTubeError as e:
        print(f"エラー: {e}")
        return 1

    state = secrets.token_urlsafe(16)
    auth_url = AUTH_URL + "?" + urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",   # リフレッシュトークンをもらうために必須
        "prompt": "consent",        # 2回目以降も確実に refresh_token を返させる
        "state": state,
    })

    with socketserver.TCPServer(("localhost", PORT), Handler) as httpd:
        httpd.timeout = 300
        thread = threading.Thread(target=httpd.handle_request, daemon=True)
        thread.start()

        print("ブラウザで承認画面を開きます。")
        print("開かない場合は、次のURLを手でブラウザに貼ってください:\n")
        print(auth_url + "\n")
        try:
            webbrowser.open(auth_url)
        except Exception:
            pass

        print("承認を待っています(最大5分)...")
        thread.join(timeout=300)

    if "code" not in _result:
        print("エラー: 認証コードを受け取れませんでした。")
        if "error" in _result:
            print(f"  Googleからの応答: {_result['error']}")
        return 1
    if _result.get("state") != state:
        print("エラー: stateが一致しません。中断します。")
        return 1

    # 認証コードをリフレッシュトークンに交換する
    body = urllib.parse.urlencode({
        "code": _result["code"],
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    }).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=body)) as res:
            payload = json.load(res)
    except urllib.error.HTTPError as e:
        print(f"エラー: トークン交換に失敗({e.code})")
        print(e.read().decode(errors="replace"))
        return 1

    if "refresh_token" not in payload:
        print("エラー: refresh_token が返ってきませんでした。")
        print("Google アカウントの『サードパーティ アプリとの連携』から")
        print("このアプリのアクセスを削除して、もう一度実行してください。")
        return 1

    save_refresh_token(payload["refresh_token"])
    print("\n完了。.youtube_token.json に保存しました(パーミッション600)。")
    print("このファイルは .gitignore 済みです。絶対にコミットしないでください。")
    print("\n動作確認: python3 tools/youtube_stock.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
