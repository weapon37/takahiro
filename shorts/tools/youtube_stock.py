"""予約済み動画の残り本数を確認する。

stock.md の補充ルール(残2本で次の6本に着手)を機械的に判定するためのもの。

使い方:
    cd shorts
    python3 tools/youtube_stock.py            # 一覧と残数を表示
    python3 tools/youtube_stock.py --quiet    # 残数だけ出力(スクリプト用)
    python3 tools/youtube_stock.py --debug    # 取得の内訳を出す(0本になる等の調査用)

終了コード:
    0 … ストックが閾値より多い(補充不要)
    9 … ストックが閾値以下(補充が必要)  ← シェルから条件分岐できる

⚠ 動画の集め方について:
    **予約公開(privacyStatus=private + publishAt)の動画は、
    アップロード用プレイリスト(UU...)には入らないことがある。**
    そのため search.list(forMine=true) と併用して両方から集め、IDで重複を除く。
    search.list は100ユニット消費するが、1日10,000あるので問題にならない。

APIクォータ: 1回の実行で概ね 105 ユニット。
"""

import datetime
import sys

from youtube_api import YouTubeError, api_get, get_access_token


THRESHOLD = 2  # stock.md の発注点。これ以下になったら補充する


def collect_video_ids(token, debug=False):
    """自分の動画IDを、2つの経路から集めて重複を除く。"""
    ids = []

    # 経路1: アップロード用プレイリスト(公開済みは確実に入る。予約分は入らないことがある)
    try:
        ch = api_get("channels", {"part": "contentDetails", "mine": "true"}, token)
        items = ch.get("items", [])
        if not items:
            raise YouTubeError(
                "チャンネルが取得できませんでした。\n"
                "承認したGoogleアカウントが、チャンネルの所有者と一致しているか確認してください"
                "(ブランドアカウントの場合は特に注意)。"
            )
        uploads = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]
        pl = api_get(
            "playlistItems",
            {"part": "contentDetails", "playlistId": uploads, "maxResults": 50},
            token,
        )
        got = [i["contentDetails"]["videoId"] for i in pl.get("items", [])]
        ids += got
        if debug:
            print(f"[debug] アップロードプレイリスト: {len(got)}件")
    except YouTubeError as e:
        if debug:
            print(f"[debug] プレイリスト取得に失敗: {e}")

    # 経路2: 自分の動画を検索(非公開・予約も含む。100ユニット)
    try:
        sr = api_get(
            "search",
            {
                "part": "id",
                "forMine": "true",
                "type": "video",
                "order": "date",
                "maxResults": 50,
            },
            token,
        )
        got = [i["id"]["videoId"] for i in sr.get("items", []) if "videoId" in i.get("id", {})]
        ids += got
        if debug:
            print(f"[debug] search(forMine): {len(got)}件")
    except YouTubeError as e:
        if debug:
            print(f"[debug] search取得に失敗: {e}")

    # 重複を除く(順序は保つ)
    uniq = list(dict.fromkeys(ids))
    if debug:
        print(f"[debug] 重複除去後: {len(uniq)}件")
    return uniq


def dump_all(token):
    """取得できた全動画の状態フィールドを並べる(予約日時がどこに入るかの調査用)。"""
    video_ids = collect_video_ids(token, debug=True)
    print(f"\n=== {len(video_ids)}件の状態 ===")
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i:i + 50]
        vids = api_get(
            "videos",
            {"part": "status,snippet,contentDetails", "id": ",".join(chunk)},
            token,
        )
        for v in vids.get("items", []):
            st = v["status"]
            sn = v["snippet"]
            print(
                f"{st.get('privacyStatus','?'):9} "
                f"upload={st.get('uploadStatus','?'):10} "
                f"publishAt={st.get('publishAt','-'):22} "
                f"publishedAt={sn.get('publishedAt','-'):22} "
                f"{sn.get('title','')[:26]}"
            )
    print("\n※ statusに入っている全キー(1件目):")
    if video_ids:
        one = api_get("videos", {"part": "status", "id": video_ids[0]}, token)
        items = one.get("items", [])
        if items:
            print("  ", sorted(items[0]["status"].keys()))


def fetch_scheduled(token, debug=False):
    """予約公開(private + 未来のpublishAt)の動画を集める。"""
    video_ids = collect_video_ids(token, debug=debug)
    if not video_ids:
        return []

    now = datetime.datetime.now(datetime.timezone.utc)
    scheduled = []
    counts = {"total": 0, "private": 0, "has_publish_at": 0, "future": 0}

    # videos.list は一度に50件まで
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i:i + 50]
        vids = api_get(
            "videos",
            {"part": "status,snippet,contentDetails", "id": ",".join(chunk)},
            token,
        )
        for v in vids.get("items", []):
            counts["total"] += 1
            st = v["status"]
            if st.get("privacyStatus") == "private":
                counts["private"] += 1
            publish_at = st.get("publishAt")
            if publish_at:
                counts["has_publish_at"] += 1
                when = datetime.datetime.fromisoformat(publish_at.replace("Z", "+00:00"))
                if when > now:
                    counts["future"] += 1
                    scheduled.append({
                        "id": v["id"],
                        "title": v["snippet"]["title"],
                        "at": when,
                        "category": v["snippet"].get("categoryId", "?"),
                        "duration": v["contentDetails"].get("duration", "?"),
                        "privacy": st.get("privacyStatus", "?"),
                    })

    if debug:
        print(f"[debug] 詳細取得: {counts['total']}件 / "
              f"非公開 {counts['private']} / "
              f"publishAtあり {counts['has_publish_at']} / "
              f"未来 {counts['future']}")

    scheduled.sort(key=lambda x: x["at"])
    return scheduled


def main():
    quiet = "--quiet" in sys.argv
    debug = "--debug" in sys.argv

    if "--dump" in sys.argv:
        try:
            dump_all(get_access_token())
        except YouTubeError as e:
            print(f"エラー: {e}", file=sys.stderr)
            return 1
        return 0

    try:
        token = get_access_token()
        scheduled = fetch_scheduled(token, debug=debug)
    except YouTubeError as e:
        print(f"エラー: {e}", file=sys.stderr)
        return 1

    count = len(scheduled)

    if quiet:
        print(count)
    else:
        jst = datetime.timezone(datetime.timedelta(hours=9))
        # どのチャンネルを見ているかを毎回出す(別チャンネルで認証する事故の防止)
        try:
            ch = api_get("channels", {"part": "snippet", "mine": "true"}, token)
            items = ch.get("items", [])
            if items:
                print(f"\nチャンネル: 【{items[0]['snippet'].get('title','?')}】")
        except YouTubeError:
            pass
        print(f"\n予約済み: {count}本\n")
        for s in scheduled:
            local = s["at"].astimezone(jst).strftime("%m/%d %H:%M")
            print(f"  {local}  {s['title'][:38]}")
            print(f"             尺{s['duration']}  カテゴリ{s['category']}  {s['id']}")
        print()
        if count <= THRESHOLD:
            print(f"⚠ 残り{count}本。発注点({THRESHOLD}本)に到達しています。")
            print("  → 次の6本の制作に入ってください。")
        else:
            print(f"○ 残り{count}本。発注点は{THRESHOLD}本なので、まだ補充不要です。")

    return 9 if count <= THRESHOLD else 0


if __name__ == "__main__":
    sys.exit(main())
