"""レンダリング済みの動画を YouTube に予約投稿する。

タイトルと概要欄は台本JSONの title / caption を使い、
末尾に共通のLINE枠(tools/description_footer.txt)を足す。

使い方:
    cd shorts
    python3 tools/youtube_upload.py scripts/w5a_example.json --at "2026-08-21 07:00"
    python3 tools/youtube_upload.py scripts/w5a_example.json --at "2026-08-21 07:00" --dry-run

    --at       日本時間で指定する。省略すると「下書き(非公開)」として上げる
    --dry-run  APIを叩かず、送信内容だけ表示する(先にこれで確認すること)
    --category カテゴリID(既定22=People & Blogs)。既存動画に合わせること

⚠ APIクォータに注意:
    videos.insert は1本あたり 1,600 ユニット。1日の既定枠は 10,000 ユニット。
    → **1日に投稿できるのは6本まで。** 6本バッチで 9,600 使うのでほぼ上限。
    失敗して上げ直すと枠を食うので、必ず --dry-run で確認してから実行すること。

⚠ 「AIの使用」の開示設定はこのスクリプトでは設定していない。
    投稿後にStudioで確認・設定すること(ニュース回は「いいえ」、他は「はい」が現行運用)。
"""

import datetime
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request

from youtube_api import UPLOAD_URL, YouTubeError, get_access_token

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOOTER = os.path.join(HERE, "tools", "description_footer.txt")
JST = datetime.timezone(datetime.timedelta(hours=9))


def build_description(caption: str) -> str:
    """台本のcaptionに共通のLINE枠を足す。"""
    if not os.path.exists(FOOTER):
        return caption
    with open(FOOTER, encoding="utf-8") as f:
        footer = f.read().strip()
    if "【チャンネルID】" in footer:
        raise YouTubeError(
            "tools/description_footer.txt に【チャンネルID】が残っています。\n"
            "実際のハンドルに置き換えてから実行してください。"
        )
    return f"{caption}\n\n{footer}"


def parse_at(value: str) -> str:
    """『2026-08-21 07:00』(日本時間)をRFC3339のUTC表記にする。"""
    try:
        dt = datetime.datetime.strptime(value, "%Y-%m-%d %H:%M")
    except ValueError:
        raise YouTubeError(f"--at の書式が違います: {value}\n例: --at \"2026-08-21 07:00\"")
    dt = dt.replace(tzinfo=JST)
    if dt <= datetime.datetime.now(JST):
        raise YouTubeError(f"--at が過去です: {value}(日本時間で未来を指定してください)")
    return dt.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def upload(video_path: str, body: dict, token: str) -> str:
    """再開可能アップロード(2段階)で動画を送る。"""
    size = os.path.getsize(video_path)
    mime = mimetypes.guess_type(video_path)[0] or "video/mp4"

    # 1段階目: メタデータを送ってアップロード先URLをもらう
    init = urllib.request.Request(
        f"{UPLOAD_URL}?uploadType=resumable&part=snippet,status",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Length": str(size),
            "X-Upload-Content-Type": mime,
        },
    )
    try:
        with urllib.request.urlopen(init) as res:
            location = res.headers["Location"]
    except urllib.error.HTTPError as e:
        raise YouTubeError(
            f"アップロードの開始に失敗({e.code})\n{e.read().decode(errors='replace')}"
        ) from e
    if not location:
        raise YouTubeError("アップロード先URLが返ってきませんでした。")

    # 2段階目: 本体を送る
    with open(video_path, "rb") as f:
        data = f.read()
    put = urllib.request.Request(
        location,
        data=data,
        method="PUT",
        headers={"Content-Type": mime, "Content-Length": str(size)},
    )
    try:
        with urllib.request.urlopen(put) as res:
            return json.load(res)["id"]
    except urllib.error.HTTPError as e:
        raise YouTubeError(
            f"アップロード本体で失敗({e.code})\n{e.read().decode(errors='replace')}"
        ) from e


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 1

    script_path = args[0]
    dry_run = "--dry-run" in args
    at_value = None
    category = "22"
    for i, a in enumerate(args):
        if a == "--at" and i + 1 < len(args):
            at_value = args[i + 1]
        if a == "--category" and i + 1 < len(args):
            category = args[i + 1]

    try:
        with open(script_path, encoding="utf-8") as f:
            script = json.load(f)
    except FileNotFoundError:
        print(f"エラー: 台本が見つかりません: {script_path}", file=sys.stderr)
        return 1

    name = os.path.splitext(os.path.basename(script_path))[0]
    video_path = os.path.join(HERE, "out", f"{name}.mp4")
    if not os.path.exists(video_path):
        print(f"エラー: 動画がありません: {video_path}", file=sys.stderr)
        print("  先に tools/make_video.sh で書き出してください。", file=sys.stderr)
        return 1

    try:
        description = build_description(script.get("caption", ""))
        status = {
            "privacyStatus": "private",
            "selfDeclaredMadeForKids": False,
        }
        if at_value:
            status["publishAt"] = parse_at(at_value)
    except YouTubeError as e:
        print(f"エラー: {e}", file=sys.stderr)
        return 1

    title = script.get("title", name)
    if len(title) > 100:
        print(f"エラー: タイトルが100文字を超えています({len(title)}文字)", file=sys.stderr)
        return 1

    body = {
        "snippet": {
            "title": title,
            "description": description,
            "categoryId": category,
        },
        "status": status,
    }

    size_mb = os.path.getsize(video_path) / 1024 / 1024

    # 空ファイルや途中で切れたファイルを本番投稿してしまう事故を防ぐ。
    # このチャンネルの動画は15〜20MB程度なので、1MB未満は明らかに異常。
    # (--dry-run はダミーファイルでの動作確認に使うため対象外)
    if not dry_run and size_mb < 1.0:
        print(f"エラー: 動画が小さすぎます({size_mb:.2f}MB)。", file=sys.stderr)
        print("  ダミーファイルが残っているか、書き出しが途中で失敗しています。", file=sys.stderr)
        print(f"  {video_path} を確認してください。", file=sys.stderr)
        return 1

    print(f"ファイル : {video_path} ({size_mb:.1f}MB)")
    print(f"タイトル : {title}")
    print(f"公開設定 : " + (f"予約 {at_value}(日本時間)" if at_value else "下書き(非公開)"))
    print(f"カテゴリ : {category}")
    print("概要欄   :")
    print("  " + "\n  ".join(description.splitlines()))

    if dry_run:
        print("\n[dry-run] 送信していません。問題なければ --dry-run を外して実行してください。")
        return 0

    print("\nアップロード中(1本あたり1,600ユニット消費)...")
    try:
        video_id = upload(video_path, body, get_access_token())
    except YouTubeError as e:
        print(f"エラー: {e}", file=sys.stderr)
        return 1

    print(f"\n完了: https://studio.youtube.com/video/{video_id}/edit")
    print("⚠ Studioで「AIの使用」の開示設定を確認してください(このスクリプトでは設定していません)。")
    print("⚠ 投稿30〜60分後に再生数を確認し、極端に低ければ削除して上げ直すこと。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
