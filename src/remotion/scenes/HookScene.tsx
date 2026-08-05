import React from "react";
import { AbsoluteFill } from "remotion";
import { useEnter, useScale } from "../animations";
import { Badge, SceneLayout } from "../components/Chrome";
import { RevealText } from "../components/RevealText";
import { FONT_FAMILY } from "../fonts";
import type { Theme } from "../theme";
import type { ShortVideoProps } from "../schema";

export const HookScene: React.FC<{
  hook: ShortVideoProps["hook"];
  theme: Theme;
}> = ({ hook, theme }) => {
  const scale = useScale();
  const underline = useEnter(20, "gentle");

  return (
    <AbsoluteFill style={{ fontFamily: FONT_FAMILY }}>
      <SceneLayout>
        <div style={{ display: "flex", flexDirection: "column", gap: 44 * scale }}>
          <div>
            <Badge theme={theme}>{hook.badge}</Badge>
          </div>

          <div>
            <RevealText
              text={hook.title}
              by="char"
              stagger={2}
              delay={8}
              travel={60}
              style={{
                color: theme.text,
                fontSize: 108 * scale,
                fontWeight: 900,
                lineHeight: 1.18,
                letterSpacing: -0.02 * 108 * scale,
              }}
            />
            <div
              style={{
                marginTop: 28 * scale,
                height: 12 * scale,
                width: `${underline * 62}%`,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${theme.accent}, ${theme.accentAlt})`,
              }}
            />
          </div>

          <RevealText
            text={hook.subtitle}
            by="line"
            delay={26}
            style={{
              color: theme.muted,
              fontSize: 40 * scale,
              fontWeight: 400,
              lineHeight: 1.55,
            }}
          />
        </div>
      </SceneLayout>
    </AbsoluteFill>
  );
};
