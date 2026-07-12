# 無料BGM(ダークアンビエント)と効果音を自動生成するスクリプト
# 使い方:  .venv/bin/python tools/make_bgm.py
#   → public/bgm/bgm.wav(約16秒ループ)と public/se/whoosh.wav ができる
# あなたが選んだ曲に差し替えたい場合は public/bgm/ にファイルを置き、
# src/props.json の "bgm" をそのファイル名に書き換えるだけでよい。
import os

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100

# ---- BGM: 暗めのアンビエントパッド(Am → F → Dm → E) ----
NOTE = {
    "A2": 110.0, "C3": 130.81, "D3": 146.83, "E3": 164.81,
    "F3": 174.61, "A3": 220.0, "C4": 261.63, "D4": 293.66,
    "E4": 329.63, "F4": 349.23, "G#3": 207.65, "B3": 246.94,
}
CHORDS = [
    ["A2", "C3", "E3", "A3", "C4"],   # Am
    ["F3", "A3", "C4", "F4"],         # F
    ["D3", "F3", "A3", "D4"],         # Dm
    ["E3", "G#3", "B3", "E4"],        # E
]
CHORD_SEC = 4.0


def pad_tone(freq: float, n: int) -> np.ndarray:
    t = np.arange(n) / SR
    # わずかにずらした2つの正弦波+倍音で、柔らかいパッドの音色にする
    x = (
        np.sin(2 * np.pi * freq * t)
        + np.sin(2 * np.pi * freq * 1.003 * t)
        + 0.35 * np.sin(2 * np.pi * freq * 2.0 * t)
        + 0.12 * np.sin(2 * np.pi * freq * 3.0 * t)
    )
    # ゆっくり揺れるトレモロ
    x *= 1.0 + 0.15 * np.sin(2 * np.pi * 0.25 * t + freq)
    return x


def make_bgm():
    n_chord = int(SR * CHORD_SEC)
    fade = int(SR * 1.2)  # コード間を1.2秒かけてなめらかに繋ぐ
    out = np.zeros(int(SR * CHORD_SEC * len(CHORDS)) + fade)
    for i, chord in enumerate(CHORDS):
        seg = np.zeros(n_chord + fade)
        for name in chord:
            seg += pad_tone(NOTE[name], n_chord + fade)
        seg /= len(chord)
        env = np.ones(n_chord + fade)
        env[:fade] = np.linspace(0, 1, fade)
        env[-fade:] = np.linspace(1, 0, fade)
        start = i * n_chord
        out[start:start + n_chord + fade] += seg * env
    # 末尾のフェード部分を先頭に折り返して、切れ目のないループにする
    body = out[: len(CHORDS) * n_chord].copy()
    body[:fade] += out[len(CHORDS) * n_chord:]
    body /= np.max(np.abs(body))
    stereo = np.stack([body, np.roll(body, int(SR * 0.012))], axis=1) * 0.75
    path = os.path.join(HERE, "public", "bgm", "bgm.wav")
    sf.write(path, stereo.astype(np.float32), SR)
    print(f"bgm.wav  {len(body)/SR:.1f}秒ループ  -> {path}")


# ---- SE: 場面転換の「ヒュッ」(ノイズスイープ) ----
def make_whoosh():
    dur = 0.55
    n = int(SR * dur)
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(n)
    # 簡易ローパス(移動平均)をかけ、周波数が上がっていく質感にする
    kernel = np.ones(24) / 24
    lowpass = np.convolve(noise, kernel, mode="same")
    t = np.linspace(0, 1, n)
    mix = lowpass * (1 - t) + noise * t * 0.6
    env = np.sin(np.pi * t) ** 2
    x = mix * env
    x /= np.max(np.abs(x))
    path = os.path.join(HERE, "public", "se", "whoosh.wav")
    sf.write(path, (x * 0.9).astype(np.float32), SR)
    print(f"whoosh.wav  {dur}秒  -> {path}")


if __name__ == "__main__":
    make_bgm()
    make_whoosh()
