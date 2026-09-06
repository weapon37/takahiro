# 横型(1920x1080)ポートフォリオ用の背景クリップを Pexels から取得するスクリプト
#
# 使い方:
#   1. https://www.pexels.com/api/ で無料APIキーを発行
#   2a. 一括モード(下の QUERIES をまとめて取得):
#         PEXELS_API_KEY=xxxx python3 tools/fetch_bg_wide.py
#   2b. 単発モード(検索ワードとファイル名を指定):
#         PEXELS_API_KEY=xxxx python3 tools/fetch_bg_wide.py "trail running" trail_run.mp4
#   → public/bg_wide/ に保存され、台本の "bgClips": ["bg_wide/xxx.mp4"] で使う
#
# 注意: これは本人の撮影素材が届くまでの「仮置き」用。差し替え前提。
#      縦型(ショート)用の取得は tools/fetch_bg_pexels.py の方を使う。
import json
import os
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(HERE, "public", "bg_wide")

# 仮置き背景のワード(山岳・マラソン並走・ドローンの3領域に対応)
QUERIES = {
    "mountain_hike.mp4": "mountain hiking trail",
    "ridge_sunrise.mp4": "mountain ridge sunrise",
    "trail_running.mp4": "trail running forest",
    "marathon_runners.mp4": "marathon runners road",
    "drone_mountain.mp4": "aerial drone mountain",
    "camera_operator.mp4": "camera operator filming",
    "forest_trail.mp4": "forest trail hiking",
    "snow_mountain.mp4": "snow mountain climbing",
}

UA = "Mozilla/5.0 (X11; Linux x86_64) shorts-bg-fetcher/1.0"


def download(url: str, path: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req) as res, open(path, "wb") as f:
        while chunk := res.read(1 << 20):
            f.write(chunk)


def search_landscape_video(query: str, api_key: str):
    url = (
        "https://api.pexels.com/videos/search?"
        f"query={urllib.parse.quote(query)}&orientation=landscape&size=medium&per_page=5"
    )
    req = urllib.request.Request(url, headers={"Authorization": api_key, "User-Agent": UA})
    with urllib.request.urlopen(req) as res:
        data = json.load(res)
    for video in data.get("videos", []):
        # カットエンジン(tools/common.tsx CutBg)の要件: トリム3秒+カット1.7秒 → 6秒以上
        if video.get("duration", 0) < 6:
            continue
        files = [
            f
            for f in video.get("video_files", [])
            if f.get("width", 0) >= 1920 and f.get("width", 0) > f.get("height", 0)
        ]
        if files:
            files.sort(key=lambda f: f["width"])
            return files[0]["link"]
    return None


def main():
    api_key = os.environ.get("PEXELS_API_KEY")
    if not api_key:
        print("環境変数 PEXELS_API_KEY にAPIキーを入れて実行してください。")
        return 1
    os.makedirs(OUTDIR, exist_ok=True)

    targets = QUERIES
    if len(sys.argv) >= 3:
        targets = {sys.argv[2]: sys.argv[1]}

    for outfile, query in targets.items():
        link = search_landscape_video(query, api_key)
        if not link:
            print(f"{outfile}: 「{query}」で横動画が見つかりませんでした")
            continue
        path = os.path.join(OUTDIR, outfile)
        download(link, path)
        print(f"{outfile}  OK  ({query}, {os.path.getsize(path) / 1e6:.1f}MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
