# 【上位版】Google Cloud Text-to-Speech (Chirp3-HD) でナレーションを作り直すスクリプト
#
# 使い方:
#   1. Google Cloud コンソールで「Text-to-Speech API」を有効化し、APIキーを発行
#   2. 環境変数にセットして実行:
#        GOOGLE_TTS_API_KEY=あなたのキー .venv/bin/python tools/make_voice_google.py
#   3. public/audio/ の 01.wav〜 が高音質版で上書きされる → 動画を書き出し直すだけ
#
# 注意: Chirp3-HD 系の声は SSML 非対応のため、速さは audioConfig.speakingRate で指定する。
import base64
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(HERE, "script.json")
OUTDIR = os.path.join(HERE, "public", "audio")

VOICE = "ja-JP-Chirp3-HD-Orus"
LANG = "ja-JP"
SPEAKING_RATE = 1.4  # 1.3〜1.5 が推奨(視聴維持率対策)


def synthesize(text: str, api_key: str) -> bytes:
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
    body = {
        "input": {"text": text},
        "voice": {"languageCode": LANG, "name": VOICE},
        "audioConfig": {
            "audioEncoding": "LINEAR16",
            "speakingRate": SPEAKING_RATE,
            "sampleRateHertz": 24000,
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as res:
        payload = json.load(res)
    return base64.b64decode(payload["audioContent"])


def main():
    api_key = os.environ.get("GOOGLE_TTS_API_KEY")
    if not api_key:
        print("環境変数 GOOGLE_TTS_API_KEY にAPIキーを入れて実行してください。")
        print("例: GOOGLE_TTS_API_KEY=xxxx .venv/bin/python tools/make_voice_google.py")
        return 1
    with open(SCRIPT, encoding="utf-8") as f:
        data = json.load(f)
    os.makedirs(OUTDIR, exist_ok=True)
    for i, s in enumerate(data["sentences"], start=1):
        wav = synthesize(s["narration"], api_key)
        path = os.path.join(OUTDIR, f"{i:02d}.wav")
        with open(path, "wb") as f:
            f.write(wav)
        print(f"{i:02d}.wav  OK  {s['narration']}")
    print("完了。次は動画の書き出し(render)をやり直してください。")


if __name__ == "__main__":
    sys.exit(main())
