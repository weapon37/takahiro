# YouTube Analytics/Data APIから、これまで手動でスクショを見て集計していた指標を自動取得する。
# 使い方:
#   .venv/bin/python tools/youtube_report.py            # 全動画(チャンネル開始日〜今日)
#   .venv/bin/python tools/youtube_report.py --days 14   # 直近14日に投稿された動画のみ
#
# 事前に tools/youtube_auth.py で1回だけ認可を済ませておくこと(tools/.youtube_token.jsonが必要)。
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
TOKEN_PATH = os.path.join(HERE, ".youtube_token.json")
CHANNEL_START = "2026-07-25"  # 実測: 最古の投稿日(youtube_reportで確認済み)

TOKEN_URL = "https://oauth2.googleapis.com/token"
YT_DATA = "https://www.googleapis.com/youtube/v3"
YT_ANALYTICS = "https://youtubeanalytics.googleapis.com/v2/reports"

# このプロジェクトで決めた判断基準(会話で確定した値)
THRESHOLDS = {
    "ranking_benchmark": 0.603,  # test_hybridで実証した確定フォーマットの目標値
    "contrarian_good": 0.50,  # これを超えれば持論型も継続
    "contrarian_bad": 0.40,  # これを切ったらランキング中心に戻す
}


def get_access_token() -> str:
    if not os.path.exists(TOKEN_PATH):
        print(f"{TOKEN_PATH} がありません。先に tools/youtube_auth.py で認可してください。", file=sys.stderr)
        sys.exit(1)
    with open(TOKEN_PATH, encoding="utf-8") as f:
        tok = json.load(f)
    data = urllib.parse.urlencode(
        {
            "client_id": tok["client_id"],
            "client_secret": tok["client_secret"],
            "refresh_token": tok["refresh_token"],
            "grant_type": "refresh_token",
        }
    ).encode()
    req = urllib.request.Request(TOKEN_URL, data=data)
    with urllib.request.urlopen(req) as res:
        return json.load(res)["access_token"]


def api_get(url: str, token: str, params: dict) -> dict:
    full_url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(full_url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as res:
        return json.load(res)


def list_uploaded_videos(token: str) -> list[dict]:
    ch = api_get(f"{YT_DATA}/channels", token, {"part": "contentDetails", "mine": "true"})
    uploads_id = ch["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]

    videos = []
    page_token = ""
    while True:
        params = {"part": "snippet", "playlistId": uploads_id, "maxResults": 50}
        if page_token:
            params["pageToken"] = page_token
        page = api_get(f"{YT_DATA}/playlistItems", token, params)
        for item in page["items"]:
            sn = item["snippet"]
            videos.append(
                {
                    "videoId": sn["resourceId"]["videoId"],
                    "title": sn["title"],
                    "publishedAt": sn["publishedAt"][:10],
                }
            )
        page_token = page.get("nextPageToken")
        if not page_token:
            break
    return videos


def fetch_analytics(token: str, video_ids: list[str], start_date: str) -> dict:
    end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = {}
    # filters=video==id1,id2,... は一度に大量指定すると失敗しやすいので50件ずつに分ける
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i : i + 50]
        report = api_get(
            YT_ANALYTICS,
            token,
            {
                "ids": "channel==MINE",
                "startDate": start_date,
                "endDate": end_date,
                "metrics": "views,averageViewPercentage,likes,comments,subscribersGained",
                "dimensions": "video",
                "filters": "video==" + ",".join(chunk),
                "maxResults": 50,
            },
        )
        headers = [h["name"] for h in report.get("columnHeaders", [])]
        for row in report.get("rows", []):
            d = dict(zip(headers, row))
            result[d["video"]] = d
    return result


def classify(title: str) -> str:
    if any(k in title for k in ["BEST3", "BEST5", "ランキング"]):
        return "🏆ランキング"
    if "ニュース" in title:
        return "🗞️ニュース"
    return "⚡持論"


def main():
    days = None
    if "--days" in sys.argv:
        days = int(sys.argv[sys.argv.index("--days") + 1])

    token = get_access_token()
    videos = list_uploaded_videos(token)
    if days:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
        videos = [v for v in videos if v["publishedAt"] >= cutoff]
    videos.sort(key=lambda v: v["publishedAt"])

    analytics = fetch_analytics(token, [v["videoId"] for v in videos], CHANNEL_START)

    print(f"{'投稿日':<10} {'型':<10} {'再生数':>6} {'維持率':>7} {'いいね':>5} {'コメント':>6} {'登録':>4}  タイトル")
    print("-" * 100)
    for v in videos:
        a = analytics.get(v["videoId"], {})
        views = a.get("views", "-")
        pct = a.get("averageViewPercentage")
        pct_str = f"{pct:.1f}%" if pct is not None else "-"
        likes = a.get("likes", "-")
        comments = a.get("comments", "-")
        subs = a.get("subscribersGained", "-")
        kind = classify(v["title"])

        flag = ""
        if pct is not None:
            p = pct / 100
            if "ランキング" in kind and p >= THRESHOLDS["ranking_benchmark"]:
                flag = " ★benchmark到達"
            elif "持論" in kind and p < THRESHOLDS["contrarian_bad"]:
                flag = " ⚠️40%未満"
            elif "持論" in kind and p >= THRESHOLDS["contrarian_good"]:
                flag = " ★50%超"

        print(
            f"{v['publishedAt']:<10} {kind:<10} {views!s:>6} {pct_str:>7} {likes!s:>5} {comments!s:>6} {subs!s:>4}  {v['title']}{flag}"
        )


if __name__ == "__main__":
    main()
