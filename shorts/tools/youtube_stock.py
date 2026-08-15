"""予約済み動画の残り本数を確認する。

stock.md の補充ルール(残2本で次の6本に着手)を機械的に判定するためのもの。

使い方:
    cd shorts
    python3 tools/youtube_stock.py            # 一覧と残数を表示
    python3 tools/youtube_stock.py --quiet    # 残数だけ出力(スクリプト用)

終了コード:
    0 … ストックが閾値より多い(補充不要)
    9 … ストックが閾値以下(補充が必要)  ← シェルから条件分岐できる

APIクォータ: 1回の実行で概ね 3〜5 ユニット。1日10,000なので気にしなくてよい。
"""

import datetime
import sys

from youtube_api import YouTubeError, api_get, get_access_token

THRESHOLD = 2  # stock.md の発注点。これ以下になったら補充する


def fetch_scheduled(token):
    """自分のチャンネルの「予約公開(private + publishAt)」動画を集める。"""
    # 1) 自分のチャンネルのアップロード用プレイリストIDを取る
    ch = api_get("channels", {"part": "contentDetails", "mine": "true"}, token)
    items = ch.get("items", [])
    if not items:
        raise YouTubeError("チャンネルが取得できませんでした。認証したアカウントを確認してください。")
    uploads = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]

    # 2) 直近の動画IDを集める(予約分は新しい側に入るので50件で足りる)
    pl = api_get(
        "playlistItems",
        {"part": "contentDetails", "playlistId": uploads, "maxResults": 50},
        token,
    )
    video_ids = [i["contentDetails"]["videoId"] for i in pl.get("items", [])]
    if not video_ids:
        return []

    # 3) それぞれの公開状態を見る
    vids = api_get(
        "videos",
        {"part": "status,snippet,contentDetails", "id": ",".join(video_ids)},
        token,
    )

    now = datetime.datetime.now(datetime.timezone.utc)
    scheduled = []
    for v in vids.get("items", []):
        st = v["status"]
        publish_at = st.get("publishAt")
        if st.get("privacyStatus") == "private" and publish_at:
            when = datetime.datetime.fromisoformat(publish_at.replace("Z", "+00:00"))
            if when > now:
                scheduled.append({
                    "id": v["id"],
                    "title": v["snippet"]["title"],
                    "at": when,
                    "category": v["snippet"].get("categoryId", "?"),
                    "duration": v["contentDetails"].get("duration", "?"),
                })
    scheduled.sort(key=lambda x: x["at"])
    return scheduled


def main():
    quiet = "--quiet" in sys.argv
    try:
        token = get_access_token()
        scheduled = fetch_scheduled(token)
    except YouTubeError as e:
        print(f"エラー: {e}", file=sys.stderr)
        return 1

    count = len(scheduled)

    if quiet:
        print(count)
    else:
        jst = datetime.timezone(datetime.timedelta(hours=9))
        print(f"予約済み: {count}本\n")
        for s in scheduled:
            local = s["at"].astimezone(jst).strftime("%m/%d(%a) %H:%M")
            print(f"  {local}  {s['title'][:38]}")
            print(f"              尺{s['duration']}  カテゴリ{s['category']}  {s['id']}")
        print()
        if count <= THRESHOLD:
            print(f"⚠ 残り{count}本。発注点({THRESHOLD}本)に到達しています。")
            print("  → 次の6本の制作に入ってください。")
        else:
            print(f"○ 残り{count}本。発注点は{THRESHOLD}本なので、まだ補充不要です。")

    return 9 if count <= THRESHOLD else 0


if __name__ == "__main__":
    sys.exit(main())
