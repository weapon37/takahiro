#!/usr/bin/env python3
"""車両運行表の画像をClaude Vision (Anthropic API) でOCRし、
update_driving_log.py が読み込めるJSON形式に変換する

使い方:
    # JSONに出力して内容を確認してから反映する(推奨)
    python ocr_driving_log.py --images log1.jpg log2.jpg --sheet 2026.8 --output driving_log.json
    python update_driving_log.py --data driving_log.json

    # 確認を挟まず直接スプレッドシートに書き込む
    python ocr_driving_log.py --images log.jpg --sheet 2026.8 --apply

判読できなかったセルや値が不正な行は自動では書き込まず、
「要確認」として一覧表示するのみに留める(誤った値を書き込まないため)。
"""
import argparse
import base64
import json
import sys
from pathlib import Path

from anthropic import Anthropic, APIError, APIConnectionError

from config import ConfigError, get_setting, load_config
from sheets_client import build_services, verify_spreadsheet_access
from update_driving_log import validate_entry, write_driving_log

MEDIA_TYPES = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".webp": "image/webp",
}

DEFAULT_MODEL = "claude-sonnet-5"

PROMPT = """あなたは車両運行表(手書きまたは印字の記録を撮影した画像)を読み取るアシスタントです。
画像に写っている表から、日付ごとに以下の項目を抽出してください。

- day: 日(1〜31の整数)
- end_km: その日の終了距離数(km、数値)
- distance_km: その日の移動距離(km、数値)
- driver: 運転手欄の記載。"A"のみなら"A"、"B"のみなら"B"、両方の記載があれば"AB"
- note: 備考欄のテキスト(なければ空文字)

判読できないセルは値の代わりに null を入れてください(推測で埋めないこと)。
記載が全くない日(空欄の行)は出力しないでください。
複数枚の画像がある場合は、すべての画像の内容をまとめて1つのリストにしてください。

出力は次のJSON形式のみとし、説明文やマークダウンのコードフェンスは付けないでください。

{"entries": [{"day": 1, "end_km": 12345, "distance_km": 20, "driver": "A", "note": ""}]}
"""


def image_to_block(path: Path):
    if not path.exists():
        raise ConfigError(f"画像ファイルが見つかりません: {path}")
    media_type = MEDIA_TYPES.get(path.suffix.lower())
    if not media_type:
        raise ConfigError(
            f"対応していない画像形式です: {path.suffix} (jpg/jpeg/png/webpに対応)"
        )
    data = base64.standard_b64encode(path.read_bytes()).decode("ascii")
    return {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}}


def extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[len("json"):]
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ConfigError(
            f"読み取り結果をJSONとして解釈できませんでした: {e}\n---応答内容---\n{text}"
        ) from e


def ocr_images(image_paths, api_key: str, model: str):
    client = Anthropic(api_key=api_key)
    content = [image_to_block(Path(p)) for p in image_paths]
    content.append({"type": "text", "text": PROMPT})
    try:
        response = client.messages.create(
            model=model,
            max_tokens=4096,
            messages=[{"role": "user", "content": content}],
        )
    except APIConnectionError as e:
        raise ConfigError(f"Claude APIへの接続に失敗しました: {e}") from e
    except APIError as e:
        raise ConfigError(f"Claude APIの呼び出しに失敗しました: {e}") from e

    text = "".join(block.text for block in response.content if block.type == "text")
    data = extract_json(text)
    entries = data.get("entries")
    if entries is None:
        raise ConfigError(f"読み取り結果に 'entries' が含まれていません: {data}")
    return entries


def review_entries(raw_entries):
    """OCR結果を検証し、(書き込み可能なentries, 要確認の生entries)を返す"""
    valid, needs_review = [], []
    for i, entry in enumerate(raw_entries):
        if not isinstance(entry, dict) or any(v is None for v in entry.values()):
            needs_review.append(entry)
            continue
        try:
            valid.append(validate_entry(entry, i))
        except ConfigError:
            needs_review.append(entry)
    return valid, needs_review


def merge_by_day(entries):
    """複数画像にまたがる場合、同じ日は後に読み取った方を優先してまとめる"""
    by_day = {}
    for entry in entries:
        by_day[entry["day"]] = entry
    return sorted(by_day.values(), key=lambda e: e["day"])


def main():
    parser = argparse.ArgumentParser(
        description="車両運行表の画像をOCR(Claude Vision)で読み取り、JSONまたはスプレッドシートに反映します"
    )
    parser.add_argument("--images", required=True, nargs="+", help="運行表の画像ファイル(複数可)")
    parser.add_argument("--sheet", required=True, help="対象シート名 (例: 2026.8)")
    parser.add_argument("--output", default="driving_log.json", help="出力先JSONファイル(既定: driving_log.json)")
    parser.add_argument(
        "--apply", action="store_true",
        help="JSONに出力せず、読み取れた項目をそのままスプレッドシートに書き込む(要確認項目は除外)",
    )
    args = parser.parse_args()

    try:
        api_key = get_setting("ANTHROPIC_API_KEY", required=True)
        model = get_setting("ANTHROPIC_MODEL", default=DEFAULT_MODEL)

        raw_entries = ocr_images(args.images, api_key, model)
        if not raw_entries:
            raise ConfigError("画像から運行表データを読み取れませんでした。")

        valid, needs_review = review_entries(raw_entries)
        merged = merge_by_day(valid)

        print(f"{len(args.images)}枚の画像から {len(merged)} 日分のデータを読み取りました。")
        if needs_review:
            print(f"判読できなかった・値が不正なため除外した項目が {len(needs_review)} 件あります:", file=sys.stderr)
            for entry in needs_review:
                print(f"  - {entry}", file=sys.stderr)
            print("上記は画像を見ながら手動で確認し、必要であれば出力JSONに追記してください。", file=sys.stderr)

        if not merged:
            raise ConfigError("有効な運行表データが1件も読み取れませんでした。")

        if args.apply:
            config = load_config()
            sheets_service, drive_service = build_services(config["service_account_file"])
            spreadsheet_id = config["spreadsheet_id"]
            verify_spreadsheet_access(drive_service, spreadsheet_id)
            write_driving_log(sheets_service, spreadsheet_id, args.sheet, merged)
            print(f"'{args.sheet}' シートに {len(merged)} 件を直接書き込みました。")
        else:
            output = {
                "sheet": args.sheet,
                "entries": [
                    {
                        "day": e["day"], "end_km": e["end_km"], "distance_km": e["distance_km"],
                        "driver": e["driver"], "note": e["note"],
                    }
                    for e in merged
                ],
            }
            output_path = Path(args.output)
            output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"'{output_path}' に出力しました。内容を確認のうえ、次を実行してください。")
            print(f"  python update_driving_log.py --data {output_path}")

    except ConfigError as e:
        print(f"エラー: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
