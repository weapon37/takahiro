import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
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

// 太い輪郭線をtext-shadowの多方向重ねで作る(-webkit-text-strokeは塗りを侵食するため不使用)
export const outline = (color: string, w = 9): string => {
  const shadows: string[] = [];
  for (let r = w; r >= 2; r -= 2) {
    for (let a = 0; a < 360; a += 30) {
      const x = (Math.cos((a * Math.PI) / 180) * r).toFixed(1);
      const y = (Math.sin((a * Math.PI) / 180) * r).toFixed(1);
      shadows.push(`${x}px ${y}px 0 ${color}`);
    }
  }
  return shadows.join(',');
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

// 背景カット: 動画全体を約2.5秒ごとに切り替え(1本40秒で約16カット)。
// カット番号は動画通し(startFrame=シーン開始位置)で数えるので、クリップ本数 ≥ 総カット数 なら
// 動画内で同じ映像が2回出ない。ズームはカットごとにリセットして"編集感"を出す。
const CUT_FRAMES = 75;

export const CutBg: React.FC<{
  clips: string[];
  seed?: number; // 後方互換(未使用)
  startFrame?: number; // このシーンの動画内での開始フレーム
  washColor: string;
  wash?: number; // 0=素の映像
}> = ({clips, startFrame = 0, washColor, wash = 0}) => {
  const frame = useCurrentFrame();
  if (clips.length === 0) return null;
  const g = startFrame + frame; // 動画通しフレーム
  const cut = Math.floor(g / CUT_FRAMES);
  const local = g - cut * CUT_FRAMES;
  const idx = cut % clips.length; // 通しカット番号で巡回 → 本数が足りれば重複なし
  const zoomIn = cut % 2 === 0;
  const scale = interpolate(local, [0, CUT_FRAMES], zoomIn ? [1, 1.09] : [1.09, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <>
      <AbsoluteFill style={{transform: `scale(${scale})`}}>
        <OffthreadVideo
          key={cut}
          src={staticFile(clips[idx])}
          muted
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </AbsoluteFill>
      {wash ? <AbsoluteFill style={{backgroundColor: washColor, opacity: wash}} /> : null}
    </>
  );
};

// 日本語テロップの改行位置調整: 助詞・記号の直後にだけ改行候補(ゼロ幅スペース)を挿入。
// これと word-break:keep-all を併用すると、単語の途中では改行されなくなる。
export const softBreaks = (t: string): string =>
  t.replace(/([をはがにへとでもやかねよ、。・！？＋／」』）】〜ー])/g, '$1​');

// アカウント名(上部常時表示・青文字＋白フチ。背景カットが変わっても読める)
export const AccountLabel: React.FC<{name: string}> = ({name}) =>
  name ? (
    <div
      style={{
        position: 'absolute',
        top: 118,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: "'Zen Maru Gothic', sans-serif",
        fontWeight: 900,
        fontSize: 46,
        letterSpacing: '0.10em',
        color: BRAND.primary,
        textShadow: outline('#ffffff', 8),
      }}
    >
      {name}
    </div>
  ) : null;
