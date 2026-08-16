# YouTube Analytics/Data API の初回認可(デバイスフロー)。
#
# 使い方:
#   1. Google Cloud コンソールで以下を行う(1回だけ):
#      - プロジェクトを作成
#      - 「YouTube Analytics API」「YouTube Data API v3」を有効化
#      - OAuth同意画面を作成(External / テストユーザーに自分のGoogleアカウントを追加)
#      - 認証情報 → OAuthクライアントID作成 → アプリの種類は「TVとその他」を選択
#      - 発行されたクライアントIDとシークレットを控える
#   2. 環境変数にセットして実行:
#        GOOGLE_OAUTH_CLIENT_ID=xxxx GOOGLE_OAUTH_CLIENT_SECRET=xxxx .venv/bin/python tools/youtube_auth.py
#   3. 表示されるURLをブラウザで開き、表示されたコードを入力してログイン・許可する
#   4. 許可が完了すると tools/.youtube_token.json にrefresh_tokenが保存される(以後は自動更新、再認可不要)
import json
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
TOKEN_PATH = os.path.join(HERE, ".youtube_token.json")

CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")

SCOPES = "https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly"

DEVICE_CODE_URL = "https://oauth2.googleapis.com/device/code"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def post_form(url: str, params: dict) -> dict:
    data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        return json.load(e)


def main():
    if not CLIENT_ID or not CLIENT_SECRET:
        print("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET を環境変数にセットしてください。", file=sys.stderr)
        print("(Google Cloudコンソールで発行したOAuthクライアントID/シークレット)", file=sys.stderr)
        sys.exit(1)

    step1 = post_form(DEVICE_CODE_URL, {"client_id": CLIENT_ID, "scope": SCOPES})
    if "device_code" not in step1:
        print("デバイスコード取得に失敗しました:", step1, file=sys.stderr)
        sys.exit(1)

    print("\n=== ブラウザでこのURLを開いてください ===")
    print(step1["verification_url"])
    print(f"\nコードを入力: {step1['user_code']}\n")
    print("ログインして許可すると、このまま自動で完了します...")

    device_code = step1["device_code"]
    interval = step1.get("interval", 5)
    expires_in = step1.get("expires_in", 1800)
    waited = 0

    while waited < expires_in:
        time.sleep(interval)
        waited += interval
        result = post_form(
            TOKEN_URL,
            {
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "device_code": device_code,
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            },
        )
        if "access_token" in result:
            with open(TOKEN_PATH, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "refresh_token": result["refresh_token"],
                        "client_id": CLIENT_ID,
                        "client_secret": CLIENT_SECRET,
                    },
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
            print(f"認可完了。{TOKEN_PATH} に保存しました。")
            print("以後は tools/youtube_report.py がこのファイルを自動で使います。")
            return
        error = result.get("error")
        if error == "authorization_pending":
            continue
        if error == "slow_down":
            interval += 5
            continue
        print("認可に失敗しました:", result, file=sys.stderr)
        sys.exit(1)

    print("時間切れです。もう一度実行してください。", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
