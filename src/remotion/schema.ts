import { z } from "zod";
import { themeNames } from "./theme";

/**
 * 動画の中身をすべてこのスキーマで表現する。
 * Remotion Studio の右ペインからそのまま編集でき、
 * `--props` で JSON を渡せば同じ構造でレンダリングできる。
 */
export const shortVideoSchema = z.object({
  theme: z.enum(themeNames).describe("配色テーマ"),
  hook: z
    .object({
      badge: z.string().describe("左上のバッジ(ジャンル名など)"),
      title: z.string().describe("最初に出す一番大きい見出し。改行は \\n"),
      subtitle: z.string().describe("見出しの下の補足"),
    })
    .describe("冒頭2〜3秒で見せるフック"),
  points: z
    .array(
      z.object({
        label: z.string().describe("小見出しの上に出すラベル"),
        title: z.string().describe("そのポイントの結論"),
        body: z.string().describe("補足説明。2行程度が読みやすい"),
      }),
    )
    .min(1)
    .max(8)
    .describe("本編で順番に見せるポイント"),
  outro: z
    .object({
      message: z.string().describe("締めのひとこと"),
      cta: z.string().describe("行動喚起(保存・フォローなど)"),
      handle: z.string().describe("アカウント名 / URL"),
    })
    .describe("締め"),
  timing: z
    .object({
      hookInSeconds: z.number().min(1).max(10).describe("フックの秒数"),
      pointInSeconds: z.number().min(1).max(15).describe("ポイント1つあたりの秒数"),
      outroInSeconds: z.number().min(1).max(10).describe("締めの秒数"),
    })
    .describe("尺の設定"),
});

export type ShortVideoProps = z.infer<typeof shortVideoSchema>;

/** シーンの切り替えにかけるフレーム数(30fps 前提で 0.5 秒) */
export const TRANSITION_FRAMES = 15;

/** 各シーンの長さをフレーム数で返す */
export const getSceneDurations = (props: ShortVideoProps, fps: number) => {
  const { timing } = props;

  return {
    hook: Math.round(timing.hookInSeconds * fps),
    points: props.points.map(() => Math.round(timing.pointInSeconds * fps)),
    outro: Math.round(timing.outroInSeconds * fps),
  };
};

/**
 * 動画全体の長さ。
 * TransitionSeries は切り替えの分だけシーンを重ねるので、
 * 単純な合計から (シーン数 - 1) × 切り替え時間 を引く。
 */
export const getTotalDuration = (props: ShortVideoProps, fps: number): number => {
  const durations = getSceneDurations(props, fps);
  const all = [durations.hook, ...durations.points, durations.outro];
  const overlap = (all.length - 1) * TRANSITION_FRAMES;

  return Math.max(all.reduce((sum, d) => sum + d, 0) - overlap, 1);
};
