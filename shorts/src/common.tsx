import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {useBrand} from './brand';

// ---------- 3テンプレ共通の部品 ----------

// マスコット(ブランドで切り替わる)。テンプレ側はこれだけを使う
export const Mascot: React.FC<{size?: number; tilt?: number}> = ({size, tilt}) => {
  const brand = useBrand();
  return brand.mascot === 'hermit' ? (
    <HermitCrabChar size={size} tilt={tilt} />
  ) : (
    <EraserChar size={size} tilt={tilt} />
  );
};

// 消しゴムキャラ(CSS描画・「仕事が消えるAI帳」アイコン8番と同デザイン)
export const EraserChar: React.FC<{size?: number; tilt?: number}> = ({
  size = 260,
  tilt = -12,
}) => {
  const BRAND = useBrand();
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

// ヤドカリキャラ(CSS描画・引っ越し/住宅チャンネル用)
// 「家そのものを背負って引っ越す」=このチャンネルの主題をそのまま形にしたもの。
// 背中の家: 屋根=spark / 壁=白+inkの輪郭 / 窓=primary。本体: 白い顔+ハサミ+脚=primary。
// 消しゴムキャラと同じ寸法比(w × w*1.45)なので、テンプレ側の配置座標をそのまま使い回せる。
export const HermitCrabChar: React.FC<{size?: number; tilt?: number}> = ({
  size = 260,
  tilt = -6,
}) => {
  const BRAND = useBrand();
  const w = size;
  const h = size * 1.45;
  const bw = size * 0.05; // 輪郭線の太さ
  const houseW = w * 0.78; // 背負っている家の幅
  const roofH = h * 0.26;
  return (
    <div style={{width: w, height: h, position: 'relative', transform: `rotate(${tilt}deg)`}}>
      {/* 背中の家: 屋根の輪郭(外側の三角) */}
      <div
        style={{
          position: 'absolute',
          left: w * 0.05,
          top: 0,
          width: 0,
          height: 0,
          borderLeft: `${houseW * 0.5}px solid transparent`,
          borderRight: `${houseW * 0.5}px solid transparent`,
          borderBottom: `${roofH}px solid ${BRAND.ink}`,
        }}
      />
      {/* 背中の家: 屋根の面(内側の三角) */}
      <div
        style={{
          position: 'absolute',
          left: w * 0.05 + bw * 1.7,
          top: bw * 1.7,
          width: 0,
          height: 0,
          borderLeft: `${houseW * 0.5 - bw * 1.7}px solid transparent`,
          borderRight: `${houseW * 0.5 - bw * 1.7}px solid transparent`,
          borderBottom: `${roofH - bw * 1.7}px solid ${BRAND.spark}`,
        }}
      />
      {/* 背中の家: 壁 */}
      <div
        style={{
          position: 'absolute',
          left: w * 0.14,
          top: roofH - bw,
          width: houseW * 0.74,
          height: h * 0.3,
          backgroundColor: '#ffffff',
          border: `${bw}px solid ${BRAND.ink}`,
          borderRadius: size * 0.06,
        }}
      >
        {/* 窓(家であることの記号) */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '26%',
            marginLeft: -w * 0.09,
            width: w * 0.18,
            height: w * 0.18,
            backgroundColor: BRAND.primary,
            border: `${bw * 0.8}px solid ${BRAND.ink}`,
            borderRadius: size * 0.03,
          }}
        />
      </div>
      {/* 本体の顔(家の右下から出る) */}
      <div
        style={{
          position: 'absolute',
          left: w * 0.46,
          top: h * 0.55,
          width: w * 0.48,
          height: w * 0.44,
          borderRadius: '46% 50% 50% 46%',
          backgroundColor: '#ffffff',
          border: `${bw}px solid ${BRAND.ink}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: w * 0.1,
            top: w * 0.14,
            width: w * 0.075,
            height: w * 0.075,
            borderRadius: '50%',
            backgroundColor: BRAND.ink,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: w * 0.27,
            top: w * 0.14,
            width: w * 0.075,
            height: w * 0.075,
            borderRadius: '50%',
            backgroundColor: BRAND.ink,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: w * 0.16,
            top: w * 0.25,
            width: w * 0.13,
            height: w * 0.065,
            borderBottom: `${bw * 0.7}px solid ${BRAND.ink}`,
            borderRadius: '0 0 50% 50%',
          }}
        />
      </div>
      {/* ハサミ(前に突き出す) */}
      <div
        style={{
          position: 'absolute',
          left: w * 0.2,
          top: h * 0.66,
          width: w * 0.26,
          height: w * 0.22,
          borderRadius: '60% 20% 50% 60%',
          backgroundColor: BRAND.primary,
          border: `${bw}px solid ${BRAND.ink}`,
        }}
      />
      {/* 脚(2本) */}
      <div
        style={{
          position: 'absolute',
          left: w * 0.56,
          top: h * 0.9,
          width: w * 0.13,
          height: w * 0.12,
          borderRadius: '0 0 50% 50%',
          backgroundColor: BRAND.primary,
          border: `${bw * 0.9}px solid ${BRAND.ink}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: w * 0.78,
          top: h * 0.88,
          width: w * 0.13,
          height: w * 0.12,
          borderRadius: '0 0 50% 50%',
          backgroundColor: BRAND.primary,
          border: `${bw * 0.9}px solid ${BRAND.ink}`,
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

// 背景のカットエンジン: 約1.7秒ごとにクリップ・開始位置・寄り/引きを切り替えて
// 「編集されたカット割り」の密度を出す。クリップは最短7秒を想定(トリム最大90F+カット50F)。
const CUT_FRAMES = 50;

export const CutBg: React.FC<{
  clips: string[];
  seed: number; // シーン番号。シーンごとにカットの並びを変える
  washColor: string;
  wash?: number; // 0=素の映像
}> = ({clips, seed, washColor, wash = 0}) => {
  const frame = useCurrentFrame();
  if (clips.length === 0) return null;
  const cut = Math.floor(frame / CUT_FRAMES);
  const local = frame - cut * CUT_FRAMES;
  // シーンとカットで異なるクリップを選ぶ(連続カットで同じクリップにならないよう素数でずらす)
  const idx = (seed * 2 + cut) % clips.length;
  // 開始位置も散らす(0/45/90フレーム)
  const trim = ((seed * 37 + cut * 53) % 3) * 45;
  // 寄り/引きを交互に(カット感の主成分)
  const zoomIn = (seed + cut) % 2 === 0;
  const scale = interpolate(local, [0, CUT_FRAMES], zoomIn ? [1, 1.1] : [1.1, 1]);
  return (
    <>
      <AbsoluteFill style={{transform: `scale(${scale})`}}>
        <OffthreadVideo
          key={`${idx}-${cut}`}
          src={staticFile(clips[idx])}
          muted
          trimBefore={trim}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </AbsoluteFill>
      {wash ? <AbsoluteFill style={{backgroundColor: washColor, opacity: wash}} /> : null}
    </>
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
