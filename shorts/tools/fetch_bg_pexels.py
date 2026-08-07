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
# bg_01=フック・導入 / bg_02=項目① / bg_03=項目② / bg_04=項目③ / bg_05=締め
#
# 検索ワードは動画ごとに変わるので、台本JSONに "bg_queries" を書けばそちらが使われる。
# 書いていなければ下の既定値(貯金ネタ用)が使われる。
DEFAULT_QUERIES = [
    "night city lights walking",   # フック・導入(夜の街)
    "convenience store night",     # 特徴①(コンビニ)
    "shopping mall people",        # 特徴②(セール・買い物)
    "counting money savings",      # 特徴③(貯金・お金)
    "cozy desk lamp night",        # CTA(落ち着いた締め)
]


def load_queries() -> list:
    """台本JSON(引数、なければ script.json)の bg_queries を読む。"""
    script = os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else "script.json")
    try:
        with open(script, encoding="utf-8") as f:
            queries = json.load(f).get("bg_queries")
    except (OSError, json.JSONDecodeError):
        return DEFAULT_QUERIES
    if not queries:
        return DEFAULT_QUERIES
    print(f"検索ワードを {os.path.basename(script)} から読みました。")
    return queries


# Pexels の配信CDNは Python-urllib のUAを 403 で弾くため、ブラウザ相当のUAを名乗る
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def download(link: str, path: str) -> None:
    req = urllib.request.Request(link, headers={"User-Agent": UA})
    with urllib.request.urlopen(req) as res, open(path, "wb") as out:
        while chunk := res.read(1 << 16):
            out.write(chunk)


def search_portrait_video(query: str, api_key: str):
    url = (
        "https://api.pexels.com/videos/search?"
        f"query={urllib.parse.quote(query)}&orientation=portrait&size=medium&per_page=3"
    )
    req = urllib.request.Request(url, headers={"Authorization": api_key, "User-Agent": UA})
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
    for i, q in enumerate(load_queries(), start=1):
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
