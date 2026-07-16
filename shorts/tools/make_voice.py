# ナレーション一括生成スクリプト(無料・ローカル動作の Open JTalk 使用)
# 使い方:  .venv/bin/python tools/make_voice.py [台本.json] [出力ディレクトリ]
#   例:    .venv/bin/python tools/make_voice.py script_ranking.json public/audio_ranking
#   省略時は script.json → public/audio
#
# 声の切り替え:
#   VOICE = "male"  … 男性声 nitech m001(voices/ に要ダウンロード)
#   VOICE = "mei"   … 女性声 メイ(pyopenjtalk-plus に同梱)
import json
import os
import sys

import numpy as np
import soundfile as sf
import pyopenjtalk
from pyopenjtalk.htsengine import HTSEngine

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else "script.json")
OUTDIR = os.path.join(HERE, sys.argv[2] if len(sys.argv) > 2 else os.path.join("public", "audio"))

VOICE = "male"
MALE_VOICE_PATH = os.path.join(
    HERE, "voices", "hts_voice_nitech_jp_atr503_m001-1.05", "nitech_jp_atr503_m001.htsvoice"
)
SPEED = 1.3  # 1.0が標準。1.3=やや速め(視聴維持率対策)


# 読み間違い対策辞書(tools/reading_dict.json)をナレーションへ適用する
# 長い語から先に置換して部分一致の誤爆を防ぐ(例: 相応しい→ふさわしい を 相応→そうおう より先に)
def apply_reading_dict(text: str) -> str:
    dict_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reading_dict.json")
    with open(dict_path, encoding="utf-8") as f:
        readings = json.load(f)["readings"]
    for kanji in sorted(readings, key=len, reverse=True):
        text = text.replace(kanji, readings[kanji])
    return text


def synth_male(engine: HTSEngine, text: str):
    labels = pyopenjtalk.extract_fullcontext(text)
    audio = engine.synthesize(labels)
    return np.asarray(audio, dtype=np.float64), engine.get_sampling_frequency()


def main():
    with open(SCRIPT, encoding="utf-8") as f:
        data = json.load(f)
    os.makedirs(OUTDIR, exist_ok=True)

    engine = None
    if VOICE == "male":
        engine = HTSEngine(MALE_VOICE_PATH.encode())
        engine.set_speed(SPEED)

    total = 0.0
    for i, s in enumerate(data["sentences"], start=1):
        text = apply_reading_dict(s["narration"])
        if engine is not None:
            audio, sr = synth_male(engine, text)
        else:
            audio, sr = pyopenjtalk.tts(text, speed=SPEED)
        # 音割れ防止の正規化(ピークを85%に)
        peak = np.max(np.abs(audio))
        if peak > 0:
            audio = audio / peak * 0.85 * 32767
        wav = audio.astype(np.int16)
        # 前後に0.08秒の無音を足してブツ切れを防ぐ
        pad = np.zeros(int(sr * 0.08), dtype=np.int16)
        wav = np.concatenate([pad, wav, pad])
        path = os.path.join(OUTDIR, f"{i:02d}.wav")
        sf.write(path, wav, sr)
        dur = len(wav) / sr
        total += dur
        print(f"{i:02d}.wav  {dur:5.2f}秒  {text}")
    print(f"--- 合計 {total:.1f}秒 ---")


if __name__ == "__main__":
    sys.exit(main())
