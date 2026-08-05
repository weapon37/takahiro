import React from "react";
import { AbsoluteFill } from "remotion";
import { useScale } from "../animations";
import { Background } from "../components/Background";
import { SceneLayout } from "../components/Chrome";
import { FONT_FAMILY } from "../fonts";
import type { ShortVideoProps } from "../schema";
import { getTheme } from "../theme";

/**
 * サムネイル(カバー画像)用の静止画。
 * 動きがない分だけ情報量を増やし、フックの文言をそのまま使う。
 */
export const Thumbnail: React.FC<ShortVideoProps> = (props) => {
  const scale = useScale();
  const theme = getTheme(props.theme);

  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY }}>
      <Background theme={theme} />
      <SceneLayout>
        <div style={{ display: "flex", flexDirection: "column", gap: 48 * scale }}>
          <div
            style={{
              alignSelf: "flex-start",
              padding: `${16 * scale}px ${32 * scale}px`,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${theme.accent}, ${theme.accentAlt})`,
              color: "#0B1020",
              fontSize: 34 * scale,
              fontWeight: 900,
            }}
          >
            {props.hook.badge}
          </div>

          <div
            style={{
              color: theme.text,
              fontSize: 126 * scale,
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: -0.03 * 126 * scale,
              whiteSpace: "pre-wrap",
            }}
          >
            {props.hook.title}
          </div>

          <div
            style={{
              color: theme.muted,
              fontSize: 44 * scale,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {props.hook.subtitle}
          </div>

          <div
            style={{
              marginTop: 20 * scale,
              display: "flex",
              flexWrap: "wrap",
              gap: 20 * scale,
            }}
          >
            {props.points.slice(0, 3).map((point, index) => (
              <div
                key={index}
                style={{
                  padding: `${18 * scale}px ${30 * scale}px`,
                  borderRadius: 20 * scale,
                  background: theme.surface,
                  border: `${2 * scale}px solid ${theme.border}`,
                  color: theme.text,
                  fontSize: 32 * scale,
                  fontWeight: 700,
                }}
              >
                {point.label}
              </div>
            ))}
          </div>
        </div>
      </SceneLayout>
    </AbsoluteFill>
  );
};
