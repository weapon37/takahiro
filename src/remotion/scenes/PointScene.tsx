import React from "react";
import { AbsoluteFill } from "remotion";
import { useEnter, useScale } from "../animations";
import { Card, SceneLayout } from "../components/Chrome";
import { RevealText } from "../components/RevealText";
import { FONT_FAMILY } from "../fonts";
import type { Theme } from "../theme";
import type { ShortVideoProps } from "../schema";

export const PointScene: React.FC<{
  point: ShortVideoProps["points"][number];
  index: number;
  total: number;
  theme: Theme;
}> = ({ point, index, total, theme }) => {
  const scale = useScale();
  const number = useEnter(4, "bouncy");

  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY }}>
      <SceneLayout>
        <div style={{ display: "flex", flexDirection: "column", gap: 40 * scale }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 * scale }}>
            <span
              style={{
                color: theme.accent,
                fontSize: 150 * scale,
                fontWeight: 900,
                lineHeight: 1,
                opacity: number,
                transform: `translateY(${(1 - number) * 30}px) scale(${0.7 + number * 0.3})`,
                transformOrigin: "left bottom",
                display: "inline-block",
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                color: theme.muted,
                fontSize: 44 * scale,
                fontWeight: 700,
                opacity: number,
              }}
            >
              / {String(total).padStart(2, "0")}
            </span>
          </div>

          <RevealText
            text={point.label}
            by="line"
            delay={10}
            travel={24}
            style={{
              color: theme.accentAlt,
              fontSize: 36 * scale,
              fontWeight: 700,
              letterSpacing: 0.08 * 36 * scale,
            }}
          />

          <RevealText
            text={point.title}
            by="char"
            stagger={1.5}
            delay={14}
            style={{
              color: theme.text,
              fontSize: 82 * scale,
              fontWeight: 900,
              lineHeight: 1.25,
              letterSpacing: -0.02 * 82 * scale,
            }}
          />

          <Card theme={theme} delay={26}>
            <span
              style={{
                color: theme.muted,
                fontSize: 38 * scale,
                fontWeight: 400,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {point.body}
            </span>
          </Card>
        </div>
      </SceneLayout>
    </AbsoluteFill>
  );
};
