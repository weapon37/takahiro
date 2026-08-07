import React from 'react';
import {useCurrentFrame} from 'remotion';
import {BRAND} from './brand';

// ---------- 3テンプレ共通の部品 ----------

// 消しゴムキャラ(CSS描画・アイコン8番と同デザイン)
export const EraserChar: React.FC<{size?: number; tilt?: number}> = ({
  size = 260,
  tilt = -12,
}) => {
  const w = size;
  const h = size * 1.45;
  return (
    <div style={{width: w, height: h, position: 'relative', transform: `rotate(${tilt}deg)`}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#ffffff',
          border: `${size * 0.045}px solid ${BRAND.ink}`,
          borderRadius: size * 0.16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: h * 0.14,
            height: h * 0.2,
            backgroundColor: BRAND.primary,
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: w * 0.24,
          top: h * 0.34,
          width: w * 0.09,
          height: w * 0.09,
          borderRadius: '50%',
          backgroundColor: BRAND.ink,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: w * 0.24,
          top: h * 0.34,
          width: w * 0.09,
          height: w * 0.09,
          borderRadius: '50%',
          backgroundColor: BRAND.ink,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: w * 0.41,
          top: h * 0.41,
          width: w * 0.18,
          height: w * 0.09,
          borderBottom: `${size * 0.035}px solid ${BRAND.ink}`,
          borderRadius: '0 0 50% 50%',
        }}
      />
    </div>
  );
};

// テロップ記法 **単語** をマーカー強調に分解
export const parseTelop = (text: string): {t: string; hl: boolean}[] =>
  text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**')
        ? {t: part.slice(2, -2), hl: true}
        : {t: part, hl: false}
    );

// ドット方眼(紙・ノート感)。色を変えてライト/ダーク両テーマで使う
export const DotGrid: React.FC<{dotColor: string}> = ({dotColor}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 12;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `radial-gradient(${dotColor} 3px, transparent 3px)`,
        backgroundSize: '72px 72px',
        backgroundPosition: `${drift}px 0px`,
      }}
    />
  );
};

// アカウント名(上部常時表示)
export const AccountLabel: React.FC<{name: string; color: string}> = ({name, color}) =>
  name ? (
    <div
      style={{
        position: 'absolute',
        top: 120,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: "'Zen Maru Gothic', sans-serif",
        fontWeight: 700,
        fontSize: 40,
        letterSpacing: '0.14em',
        color,
      }}
    >
      {name}
    </div>
  ) : null;
