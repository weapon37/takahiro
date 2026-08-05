import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** よく使うバネのプリセット */
export const SPRINGS = {
  /** ほぼ跳ねない。テキストの登場向け */
  gentle: { damping: 200, mass: 0.6, stiffness: 120 },
  /** 少しだけ跳ねる。カードやバッジ向け */
  pop: { damping: 14, mass: 0.5, stiffness: 140 },
  /** しっかり跳ねる。数字やアイコン向け */
  bouncy: { damping: 9, mass: 0.6, stiffness: 160 },
} as const;

export type SpringPreset = keyof typeof SPRINGS;

/**
 * 0→1 に進む進捗値。`delayInFrames` 分だけ待ってから動き出す。
 * Sequence を切らずに要素ごとのタイミングをずらしたいときに使う。
 */
export const useEnter = (
  delayInFrames = 0,
  preset: SpringPreset = "gentle",
): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return spring({
    frame: frame - delayInFrames,
    fps,
    config: SPRINGS[preset],
    durationInFrames: 24,
  });
};

/**
 * シーンの終わり際にフェードアウトさせるための係数(1→0)。
 * TransitionSeries を使わない素の Sequence でも自然に消えるようにする。
 */
export const useExit = (
  durationInFrames: number,
  fadeFrames = 12,
): number => {
  const frame = useCurrentFrame();

  return interpolate(
    frame,
    [durationInFrames - fadeFrames, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
};

/** ゆっくり上下に漂う値。背景の装飾などに使う */
export const useFloat = (
  amplitude: number,
  periodInSeconds = 4,
  phase = 0,
): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return Math.sin((frame / (fps * periodInSeconds)) * Math.PI * 2 + phase) * amplitude;
};

/**
 * 解像度が変わってもレイアウトが崩れないようにするための倍率。
 * 1080px を基準とし、縦動画(1080x1920)でも横動画(1920x1080)でも
 * 短辺基準で同じ見た目になる。
 */
export const useScale = (): number => {
  const { width, height } = useVideoConfig();

  return Math.min(width, height) / 1080;
};
