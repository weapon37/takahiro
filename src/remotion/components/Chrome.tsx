import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useEnter, useScale } from "../animations";
import type { Theme } from "../theme";

/** ジャンル名などを入れる小さなピル */
export const Badge: React.FC<{
  theme: Theme;
  children: React.ReactNode;
  delay?: number;
}> = ({ theme, children, delay = 0 }) => {
  const scale = useScale();
  const progress = useEnter(delay, "pop");

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12 * scale,
        padding: `${14 * scale}px ${28 * scale}px`,
        borderRadius: 999,
        background: theme.surface,
        border: `${2 * scale}px solid ${theme.border}`,
        color: theme.accent,
        fontSize: 30 * scale,
        fontWeight: 700,
        letterSpacing: 0.04 * 30 * scale,
        opacity: progress,
        transform: `scale(${0.85 + progress * 0.15})`,
      }}
    >
      <span
        style={{
          width: 14 * scale,
          height: 14 * scale,
          borderRadius: 999,
          background: theme.accent,
        }}
      />
      {children}
    </div>
  );
};

/** 本文を載せるガラス風のカード */
export const Card: React.FC<{
  theme: Theme;
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ theme, children, delay = 0, style }) => {
  const scale = useScale();
  const progress = useEnter(delay, "pop");

  return (
    <div
      style={{
        padding: `${48 * scale}px ${52 * scale}px`,
        borderRadius: 40 * scale,
        background: theme.surface,
        border: `${2 * scale}px solid ${theme.border}`,
        boxShadow: `0 ${30 * scale}px ${80 * scale}px rgba(0,0,0,0.35)`,
        opacity: progress,
        transform: `translateY(${(1 - progress) * 50}px) scale(${0.96 + progress * 0.04})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** 画面下に出す全体の進捗バー(絶対フレームで動かすため一番外側に置く) */
export const ProgressBar: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = useScale();
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div style={{ height: 10 * scale, background: "rgba(255,255,255,0.12)" }}>
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg, ${theme.accent}, ${theme.accentAlt})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** 各シーンの共通余白。縦横どちらの解像度でも同じ見た目になる */
export const SceneLayout: React.FC<{
  children: React.ReactNode;
  align?: React.CSSProperties["justifyContent"];
}> = ({ children, align = "center" }) => {
  const scale = useScale();

  return (
    <AbsoluteFill
      style={{
        padding: `${120 * scale}px ${80 * scale}px`,
        justifyContent: align,
      }}
    >
      {/* 横位置(1920x1080)でも1行が長くなりすぎないよう幅を制限する */}
      <div style={{ width: "100%", maxWidth: 1100 * scale, margin: "0 auto" }}>
        {children}
      </div>
    </AbsoluteFill>
  );
};
