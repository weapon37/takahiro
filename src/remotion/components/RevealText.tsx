import React from "react";
import { useEnter, type SpringPreset } from "../animations";

type Props = {
  /** `\n` で改行できる */
  text: string;
  /** アニメーションを始めるまでのフレーム数 */
  delay?: number;
  /** 分割単位。日本語は "char" か "line" が読みやすい */
  by?: "line" | "word" | "char";
  /** 分割された要素どうしをずらすフレーム数 */
  stagger?: number;
  preset?: SpringPreset;
  /** 下からせり上がる距離(px) */
  travel?: number;
  style?: React.CSSProperties;
};

export const RevealText: React.FC<Props> = ({
  text,
  delay = 0,
  by = "line",
  stagger = 3,
  preset = "gentle",
  travel = 40,
  style,
}) => {
  const lines = text.split("\n");
  let index = 0;

  return (
    <div style={style}>
      {lines.map((line, lineIndex) => {
        const chunks = by === "line" ? [line] : splitLine(line, by);

        return (
          <div key={lineIndex} style={{ display: "block", whiteSpace: "pre-wrap" }}>
            {chunks.map((chunk, chunkIndex) => (
              <Chunk
                key={chunkIndex}
                text={chunk}
                delay={delay + index++ * stagger}
                preset={preset}
                travel={travel}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

const splitLine = (line: string, by: "word" | "char"): string[] => {
  if (by === "char") {
    return Array.from(line);
  }

  // 単語の後ろに空白をくっつけたまま分割し、見た目の字間を保つ
  return line.split(/(?<=\s)/);
};

const Chunk: React.FC<{
  text: string;
  delay: number;
  preset: SpringPreset;
  travel: number;
}> = ({ text, delay, preset, travel }) => {
  const progress = useEnter(delay, preset);

  return (
    <span
      style={{
        display: "inline-block",
        opacity: progress,
        transform: `translateY(${(1 - progress) * travel}px)`,
        willChange: "transform, opacity",
      }}
    >
      {text === " " ? " " : text}
    </span>
  );
};
