import React from "react";
import { AbsoluteFill } from "remotion";
import { useFloat } from "../animations";
import type { Theme } from "../theme";

/**
 * 全シーン共通の背景。
 * ぼかしフィルタは重いので、radial-gradient だけで光のにじみを作っている。
 */
export const Background: React.FC<{ theme: Theme }> = ({ theme }) => {
  const driftA = useFloat(60, 9);
  const driftB = useFloat(80, 12, Math.PI / 2);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${theme.backdrop[0]} 0%, ${theme.backdrop[1]} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          transform: `translate(${driftA}px, ${-driftA}px)`,
          background: `radial-gradient(45% 28% at 18% 22%, ${theme.blobs[0]}AA 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          transform: `translate(${-driftB}px, ${driftB}px)`,
          background: `radial-gradient(50% 30% at 82% 78%, ${theme.blobs[1]}99 0%, transparent 70%)`,
        }}
      />
      <Grain />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(75% 60% at 50% 45%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** うっすらノイズを乗せてグラデーションのバンディングを隠す */
const Grain: React.FC = () => (
  <AbsoluteFill style={{ opacity: 0.055, mixBlendMode: "overlay" }}>
    <svg width="100%" height="100%">
      <filter id="remotion-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves={3}
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#remotion-grain)" />
    </svg>
  </AbsoluteFill>
);
