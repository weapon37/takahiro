# ナレーション一括生成スクリプト(無料・ローカル動作の Open JTalk「メイ」使用)
# 使い方:  .venv/bin/python tools/make_voice.py
import json
import os
import sys

import numpy as np
import soundfile as sf
import pyopenjtalk

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(HERE, "script.json")
OUTDIR = os.path.join(HERE, "public", "audio")

SPEED = 1.3  # 1.0が標準。1.3=やや速め(視聴維持率対策)
HALF_TONE = 0.0

def main():
    with open(SCRIPT, encoding="utf-8") as f:
        data = json.load(f)
    os.makedirs(OUTDIR, exist_ok=True)
    total = 0.0
    for i, s in enumerate(data["sentences"], start=1):
        text = s["narration"]
        audio, sr = pyopenjtalk.tts(text, speed=SPEED, half_tone=HALF_TONE)
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
