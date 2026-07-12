import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
// フォントはOSにインストール済みのものを使う(README参照)。
// レンダリング前に public/fonts/ のTTFをシステムに入れておくこと。
const fontFamily = "'Zen Maru Gothic', 'Zen Maru Gothic Black', 'IPAPGothic', sans-serif";

export type Scene = {
  audio: string;
  telop: string;
  telopStyle: 'normal' | 'paren';
  role: string;
  bg: 'fog' | 'stars' | 'phone' | 'mirror' | 'candle';
  playWhoosh: boolean;
  durationInFrames: number;
};

export type ShortVideoProps = {
  account: string;
  bgm: string;
  bgmVolume: number;
  whoosh: string;
  scenes: Scene[];
};

// ---------- 動く背景(5種類) ----------

const FogBg: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#1a1033 0%,#0a0618 100%)'}}>
      {Array.from({length: 6}).map((_, i) => {
        const x = random(`fx${i}`) * 1080;
        const y = random(`fy${i}`) * 1920;
        const drift = Math.sin(frame / 90 + i * 2) * 120;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - 400 + drift,
              top: y - 400 + Math.cos(frame / 110 + i) * 60,
              width: 800,
              height: 800,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(120,80,200,0.16) 0%, rgba(120,80,200,0) 70%)',
              filter: 'blur(40px)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const StarsBg: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#060c22 0%,#101a40 100%)'}}>
      {Array.from({length: 45}).map((_, i) => {
        const x = random(`sx${i}`) * 1080;
        const y = (random(`sy${i}`) * 1920 - frame * (0.2 + random(`sv${i}`) * 0.5) + 1920) % 1920;
        const size = 3 + random(`ss${i}`) * 6;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(frame / 20 + i * 1.7));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: 'white',
              opacity: tw,
              boxShadow: `0 0 ${size * 3}px rgba(180,200,255,${tw})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const PhoneBg: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#03161c 0%,#020a0e 100%)'}}>
      {Array.from({length: 5}).map((_, i) => {
        const r = ((frame * 3 + i * 130) % 700) + 40;
        const opacity = interpolate(r, [40, 740], [0.35, 0]);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 540 - r,
              top: 960 - r,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              border: '3px solid rgba(90,220,220,0.8)',
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const MirrorBg: React.FC = () => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 70) * 160;
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#180b28 0%,#070310 100%)'}}>
      {[-1, 1].map((side) => (
        <div
          key={side}
          style={{
            position: 'absolute',
            left: 540 + side * (260 + sway) - 300,
            top: 660,
            width: 600,
            height: 600,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(150,110,255,0.18) 0%, rgba(150,110,255,0) 70%)',
            filter: 'blur(30px)',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 538,
          top: 0,
          width: 4,
          height: 1920,
          background:
            'linear-gradient(180deg, transparent, rgba(200,170,255,0.35), transparent)',
        }}
      />
    </AbsoluteFill>
  );
};

const CandleBg: React.FC = () => {
  const frame = useCurrentFrame();
  const flicker =
    0.75 + 0.25 * Math.abs(Math.sin(frame / 4) * 0.5 + Math.sin(frame / 9) * 0.5);
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#140b04 0%,#060201 100%)'}}>
      <div
        style={{
          position: 'absolute',
          left: 540 - 500,
          top: 1250,
          width: 1000,
          height: 1000,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,170,60,${0.35 * flicker}) 0%, rgba(255,120,30,0) 65%)`,
          filter: 'blur(20px)',
        }}
      />
      {Array.from({length: 10}).map((_, i) => {
        const y = 1750 - ((frame * (1.5 + random(`ev${i}`) * 2) + random(`ey${i}`) * 900) % 900);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 340 + random(`ex${i}`) * 400 + Math.sin(frame / 30 + i) * 30,
              top: y,
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,190,90,0.8)',
              opacity: interpolate(y, [850, 1750], [0, 0.9]),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const BACKGROUNDS: Record<Scene['bg'], React.FC> = {
  fog: FogBg,
  stars: StarsBg,
  phone: PhoneBg,
  mirror: MirrorBg,
  candle: CandleBg,
};

// ---------- テロップ(黒フチ+フワッとフェードイン) ----------

const Telop: React.FC<{text: string; style: Scene['telopStyle']}> = ({text, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const appear = spring({frame, fps, config: {damping: 200}, durationInFrames: 14});
  const isParen = style === 'paren';
  const fontSize = isParen ? 54 : 78;
  const textStyle: React.CSSProperties = {
    fontFamily,
    fontWeight: 900,
    fontSize,
    lineHeight: 1.35,
    textAlign: 'center',
    whiteSpace: 'pre-wrap',
  };
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: isParen ? 1280 : 1180,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 40}px)`,
      }}
    >
      <div style={{position: 'relative'}}>
        {/* 黒フチ用のレイヤー */}
        <div
          style={{
            ...textStyle,
            position: 'absolute',
            inset: 0,
            WebkitTextStroke: '14px rgba(0,0,0,0.9)',
            color: 'transparent',
          }}
        >
          {text}
        </div>
        <div
          style={{
            ...textStyle,
            position: 'relative',
            color: isParen ? '#d9ccf5' : '#ffffff',
            textShadow: '0 6px 30px rgba(0,0,0,0.85)',
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};

// ---------- 1シーン ----------

const SceneView: React.FC<{scene: Scene; index: number; whoosh: string}> = ({
  scene,
  index,
  whoosh,
}) => {
  const frame = useCurrentFrame();
  const Bg = BACKGROUNDS[scene.bg];
  // ゆっくりズーム(シーンごとに寄り/引きを交互に)
  const zoomIn = index % 2 === 0;
  const scale = interpolate(
    frame,
    [0, scene.durationInFrames],
    zoomIn ? [1, 1.09] : [1.09, 1]
  );
  return (
    <AbsoluteFill style={{backgroundColor: 'black'}}>
      <AbsoluteFill style={{transform: `scale(${scale})`}}>
        <Bg />
      </AbsoluteFill>
      {/* 上下の暗転グラデーションで文字を読みやすく */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.7) 100%)',
        }}
      />
      <Telop text={scene.telop} style={scene.telopStyle} />
      <Audio src={staticFile(scene.audio)} />
      {scene.playWhoosh ? <Audio src={staticFile(whoosh)} volume={0.3} /> : null}
    </AbsoluteFill>
  );
};

// ---------- 動画全体 ----------

export const ShortVideo: React.FC<ShortVideoProps> = ({
  account,
  bgm,
  bgmVolume,
  whoosh,
  scenes,
}) => {
  const total = scenes.reduce((a, s) => a + s.durationInFrames, 0);
  let from = 0;
  return (
    <AbsoluteFill style={{backgroundColor: 'black'}}>
      {scenes.map((scene, i) => {
        const seq = (
          <Sequence key={i} from={from} durationInFrames={scene.durationInFrames}>
            <SceneView scene={scene} index={i} whoosh={whoosh} />
          </Sequence>
        );
        from += scene.durationInFrames;
        return seq;
      })}
      {/* アカウント名(常時・薄め) */}
      <div
        style={{
          position: 'absolute',
          top: 110,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily,
          fontWeight: 700,
          fontSize: 38,
          letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.5)',
          textShadow: '0 2px 12px rgba(0,0,0,0.6)',
        }}
      >
        {account}
      </div>
      {/* BGM(ループ+フェードイン/アウト) */}
      <Audio
        loop
        src={staticFile(bgm)}
        volume={(f) =>
          interpolate(
            f,
            [0, 45, Math.max(46, total - 60), Math.max(47, total - 4)],
            [0, bgmVolume, bgmVolume, 0],
            {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
          )
        }
      />
    </AbsoluteFill>
  );
};
