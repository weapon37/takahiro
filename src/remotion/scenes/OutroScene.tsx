import React from "react";
import { AbsoluteFill } from "remotion";
import { useEnter, useFloat, useScale } from "../animations";
import { SceneLayout } from "../components/Chrome";
import { RevealText } from "../components/RevealText";
import { FONT_FAMILY } from "../fonts";
import type { Theme } from "../theme";
import type { ShortVideoProps } from "../schema";

export const OutroScene: React.FC<{
  outro: ShortVideoProps["outro"];
  theme: Theme;
}> = ({ outro, theme }) => {
  const scale = useScale();
  const ctaProgress = useEnter(18, "pop");
  const pulse = useFloat(0.02, 1.6);

  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY }}>
      <SceneLayout>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 52 * scale,
          }}
        >
          <RevealText
            text={outro.message}
            by="char"
            stagger={2}
            style={{
              color: theme.text,
              fontSize: 92 * scale,
              fontWeight: 900,
              lineHeight: 1.25,
            }}
          />

          <div
            style={{
              padding: `${28 * scale}px ${64 * scale}px`,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${theme.accent}, ${theme.accentAlt})`,
              color: "#0B1020",
              fontSize: 46 * scale,
              fontWeight: 900,
              opacity: ctaProgress,
              transform: `scale(${(0.8 + ctaProgress * 0.2) * (1 + pulse)})`,
              boxShadow: `0 ${20 * scale}px ${60 * scale}px rgba(0,0,0,0.4)`,
            }}
          >
            {outro.cta}
          </div>

          <RevealText
            text={outro.handle}
            by="line"
            delay={30}
            travel={20}
            style={{
              color: theme.muted,
              fontSize: 38 * scale,
              fontWeight: 700,
              letterSpacing: 0.05 * 38 * scale,
            }}
          />
        </div>
      </SceneLayout>
    </AbsoluteFill>
  );
};
