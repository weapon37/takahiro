# 【上位版】Pexels API で縦向き背景動画を自動ダウンロードするスクリプト
#
# 使い方:
#   1. https://www.pexels.com/api/ で無料APIキーを発行
#   2. PEXELS_API_KEY=あなたのキー .venv/bin/python tools/fetch_bg_pexels.py
#   3. public/bg/ に bg_01.mp4 ... が保存される
#      → src/props.json の各シーンの "bg" をファイル名に書き換えて render し直す
import json
import os
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(HERE, "public", "bg")

# 各検索ワードにつき縦動画を1本ダウンロードする(シーンの雰囲気に対応)
QUERIES = [
    "dark fog mystery",        # フック・導入
    "night sky stars",         # 第3位(夢)
    "old telephone dark",      # 第2位(電話)
    "mirror silhouette dark",  # 第1位(もう一人の自分)
    "candle flame dark",       # CTA(占い師の雰囲気)
]


def search_portrait_video(query: str, api_key: str):
    url = (
        "https://api.pexels.com/videos/search?"
        f"query={urllib.parse.quote(query)}&orientation=portrait&size=medium&per_page=3"
    )
    req = urllib.request.Request(url, headers={"Authorization": api_key})
    with urllib.request.urlopen(req) as res:
        data = json.load(res)
    for video in data.get("videos", []):
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
    for i, q in enumerate(QUERIES, start=1):
        link = search_portrait_video(q, api_key)
        if not link:
            print(f"bg_{i:02d}: 「{q}」で縦動画が見つかりませんでした")
            continue
        path = os.path.join(OUTDIR, f"bg_{i:02d}.mp4")
        urllib.request.urlretrieve(link, path)
        print(f"bg_{i:02d}.mp4  OK  ({q})")
    print("完了。props.json の bg をファイル名に書き換えてください。")


if __name__ == "__main__":
    sys.exit(main())
