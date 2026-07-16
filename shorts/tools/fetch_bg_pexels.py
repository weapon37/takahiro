# 【上位版】Pexels API で縦向き背景動画を自動ダウンロードするスクリプト
#
# 使い方:
#   1. https://www.pexels.com/api/ で無料APIキーを発行
#   2a. 一括モード(旧ShortVideo用):
#       PEXELS_API_KEY=xxxx .venv/bin/python tools/fetch_bg_pexels.py
#       → public/bg/ に bg_01.mp4 ... bg_05.mp4
#   2b. 単発モード(検索ワードとファイル名を指定):
#       PEXELS_API_KEY=xxxx .venv/bin/python tools/fetch_bg_pexels.py "office desk" keiri.mp4
#       → public/bg/keiri.mp4
#   3. 台本JSONの "bgVideo": "bg/keiri.mp4" で背景に使われる
import json
import os
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(HERE, "public", "bg")

# 各検索ワードにつき縦動画を1本ダウンロードする(シーンの雰囲気に対応)
# bg_01=フック・導入 / bg_02=特徴①コンビニ / bg_03=特徴②セール /
# bg_04=特徴③貯金 / bg_05=CTA
QUERIES = [
    "night city lights walking",   # フック・導入(夜の街)
    "convenience store night",     # 特徴①(コンビニ)
    "shopping mall people",        # 特徴②(セール・買い物)
    "counting money savings",      # 特徴③(貯金・お金)
    "cozy desk lamp night",        # CTA(落ち着いた締め)
]


# 既定のPython UAはCDNに弾かれることがあるためブラウザ風UAを付ける
UA = "Mozilla/5.0 (X11; Linux x86_64) shorts-bg-fetcher/1.0"


def download(url: str, path: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req) as res, open(path, "wb") as f:
        while chunk := res.read(1 << 20):
            f.write(chunk)


def search_portrait_video(query: str, api_key: str):
    url = (
        "https://api.pexels.com/videos/search?"
        f"query={urllib.parse.quote(query)}&orientation=portrait&size=medium&per_page=3"
    )
    req = urllib.request.Request(url, headers={"Authorization": api_key, "User-Agent": UA})
    with urllib.request.urlopen(req) as res:
        data = json.load(res)
    for video in data.get("videos", []):
        # カットエンジンの要件: トリム3秒+カット1.7秒に耐える長さ(6秒以上)
        if video.get("duration", 0) < 6:
            continue
        files = [
            f for f in video.get("video_files", [])
            if f.get("height", 0) >= 1280 and f.get("width", 0) < f.get("height", 0)
        ]
        if files:
            files.sort(key=lambda f: f["height"])
            return files[0]["link"]
    return None


def main():
    api_key = os.environ.get("PEXELS_API_KEY")
    if not api_key:
        print("環境変数 PEXELS_API_KEY にAPIキーを入れて実行してください。")
        print("例: PEXELS_API_KEY=xxxx .venv/bin/python tools/fetch_bg_pexels.py")
        return 1
    os.makedirs(OUTDIR, exist_ok=True)

    # 単発モード: 検索ワードと保存ファイル名を引数で指定
    if len(sys.argv) >= 3:
        query, outfile = sys.argv[1], sys.argv[2]
        link = search_portrait_video(query, api_key)
        if not link:
            print(f"「{query}」で縦動画が見つかりませんでした")
            return 1
        path = os.path.join(OUTDIR, outfile)
        download(link, path)
        size_mb = os.path.getsize(path) / 1e6
        print(f"{outfile}  OK  ({query}, {size_mb:.1f}MB)")
        return 0

    for i, q in enumerate(QUERIES, start=1):
        link = search_portrait_video(q, api_key)
        if not link:
            print(f"bg_{i:02d}: 「{q}」で縦動画が見つかりませんでした")
            continue
        path = os.path.join(OUTDIR, f"bg_{i:02d}.mp4")
        download(link, path)
        print(f"bg_{i:02d}.mp4  OK  ({q})")
    print("完了。props.json の bg をファイル名に書き換えてください。")


if __name__ == "__main__":
    sys.exit(main())
