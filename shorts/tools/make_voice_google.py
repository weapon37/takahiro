# 【上位版】Google Cloud Text-to-Speech (Chirp3-HD) でナレーションを作り直すスクリプト
#
# 使い方:
#   1. Google Cloud コンソールで「Text-to-Speech API」を有効化し、APIキーを発行
#   2. 環境変数にセットして実行:
#        GOOGLE_TTS_API_KEY=あなたのキー .venv/bin/python tools/make_voice_google.py [台本.json] [出力ディレクトリ]
#      例: GOOGLE_TTS_API_KEY=xxxx .venv/bin/python tools/make_voice_google.py script_ranking.json public/audio_ranking
#      省略時は script.json → public/audio
#   3. 01.wav〜 が高音質版で上書きされる → 動画を書き出し直すだけ
#
# 注意: Chirp3-HD 系の声は SSML 非対応のため、速さは audioConfig.speakingRate で指定する。
import base64
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else "script.json")
OUTDIR = os.path.join(HERE, sys.argv[2] if len(sys.argv) > 2 else os.path.join("public", "audio"))

# Aoede = 温かみのある女性声。他候補: Leda(若め)・Charon(落ち着いた男性)・Orus(低め男性)
VOICE = "ja-JP-Chirp3-HD-Aoede"
LANG = "ja-JP"
SPEAKING_RATE = 1.10  # 自然さ優先(1.25は詰まって機械っぽいので緩めた)。テンポを上げたい回だけ台本側で調整


# 読み間違い対策辞書(tools/reading_dict.json)をナレーションへ適用する
# 長い語から先に置換して部分一致の誤爆を防ぐ(例: 相応しい→ふさわしい を 相応→そうおう より先に)
def apply_reading_dict(text: str) -> str:
    dict_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reading_dict.json")
    with open(dict_path, encoding="utf-8") as f:
        readings = json.load(f)["readings"]
    for kanji in sorted(readings, key=len, reverse=True):
        text = text.replace(kanji, readings[kanji])
    return text


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
        text = apply_reading_dict(s["narration"])
        wav = synthesize(text, api_key)
        path = os.path.join(OUTDIR, f"{i:02d}.wav")
        with open(path, "wb") as f:
            f.write(wav)
        print(f"{i:02d}.wav  OK  {text}")
    print("完了。次は動画の書き出し(render)をやり直してください。")


if __name__ == "__main__":
    sys.exit(main())
