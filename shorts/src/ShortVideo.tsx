import React from 'react';
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {BRAND, fontFamily} from './brand';
import {EraserChar} from './common';

export type Scene = {
  audio: string;
  telop: string;
  telopStyle: 'normal' | 'paren';
  role: string;
  bg: 'bokeh' | 'neon' | 'sale' | 'rise' | 'calm';
  bgVideo?: string | null; // public/ 内の実写背景動画(あれば自前背景より優先)
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

// ---------- 動く背景(5種類・お金/自己啓発テーマ) ----------

// ふわっと漂う光の玉(ボケ)を敷く共通部品
const Bokeh: React.FC<{
  count: number;
  color: string;
  seed: string;
  size?: number;
}> = ({count, color, seed, size = 500}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {Array.from({length: count}).map((_, i) => {
        const x = random(`${seed}x${i}`) * 1080;
        const y = random(`${seed}y${i}`) * 1920;
        const s = size * (0.4 + random(`${seed}s${i}`));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - s / 2 + Math.sin(frame / 80 + i * 2.1) * 90,
              top: y - s / 2 + Math.cos(frame / 100 + i * 1.3) * 50,
              width: s,
              height: s,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
              filter: 'blur(30px)',
            }}
          />
        );
      })}
    </>
  );
};

// フック・導入:夜の街のイメージ(紺+金のボケ)
const BokehBg: React.FC = () => (
  <AbsoluteFill style={{background: 'linear-gradient(180deg,#0c1430 0%,#060a1a 100%)'}}>
    <Bokeh count={7} color="rgba(255,200,90,0.14)" seed="g" />
    <Bokeh count={5} color="rgba(90,140,255,0.12)" seed="b" />
  </AbsoluteFill>
);

// ①コンビニ:深夜の青白いネオンのイメージ
const NeonBg: React.FC = () => (
  <AbsoluteFill style={{background: 'linear-gradient(180deg,#041a24 0%,#020c12 100%)'}}>
    <Bokeh count={8} color="rgba(80,220,255,0.14)" seed="n" size={420} />
  </AbsoluteFill>
);

// ②セール:赤札の警戒色をほんのり
const SaleBg: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.8 + 0.2 * Math.sin(frame / 25);
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#2a0c10 0%,#12050a 100%)'}}>
      <div
        style={{
          position: 'absolute',
          left: 40,
          top: 560,
          width: 1000,
          height: 800,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,90,80,${0.14 * pulse}) 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
      />
      <Bokeh count={6} color="rgba(255,150,60,0.12)" seed="w" size={380} />
    </AbsoluteFill>
  );
};

// ③収入・貯金:上へ昇る金色の粒(貯まっていくイメージ)
const RiseBg: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#06201a 0%,#03100d 100%)'}}>
      {Array.from({length: 26}).map((_, i) => {
        const speed = 1.2 + random(`rv${i}`) * 2.2;
        const y = 1980 - ((frame * speed + random(`ry${i}`) * 1900) % 2100);
        const size = 5 + random(`rs${i}`) * 9;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: random(`rx${i}`) * 1040 + Math.sin(frame / 40 + i) * 24,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,210,100,0.85)',
              boxShadow: `0 0 ${size * 2.5}px rgba(255,210,100,0.6)`,
              opacity: interpolate(y, [-100, 300, 1500, 2000], [0, 0.9, 0.9, 0]),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// CTA:あたたかい琥珀色の落ち着いた光
const CalmBg: React.FC = () => {
  const frame = useCurrentFrame();
  const glow = 0.85 + 0.15 * Math.sin(frame / 18);
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#1c1206 0%,#0a0502 100%)'}}>
      <div
        style={{
          position: 'absolute',
          left: 540 - 550,
          top: 1150,
          width: 1100,
          height: 1100,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,180,80,${0.28 * glow}) 0%, transparent 65%)`,
          filter: 'blur(24px)',
        }}
      />
      <Bokeh count={5} color="rgba(255,210,120,0.12)" seed="c" size={360} />
    </AbsoluteFill>
  );
};

const BACKGROUNDS: Record<Scene['bg'], React.FC> = {
  bokeh: BokehBg,
  neon: NeonBg,
  sale: SaleBg,
  rise: RiseBg,
  calm: CalmBg,
};

// ---------- テロップ(黒フチ+バウンスして飛び込む) ----------

const Telop: React.FC<{text: string; style: Scene['telopStyle']}> = ({text, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // フェードは滑らかに、拡大は他テンプレの数字ポップと同じ弾ける動きにして
  // テンポを出す(damping:200のフェードだけだと勢いが出ない)
  const opacity = spring({frame, fps, config: {damping: 200}, durationInFrames: 10});
  const pop = spring({frame, fps, config: {damping: 10, mass: 0.6}, durationInFrames: 14});
  const scale = interpolate(pop, [0, 1], [0.75, 1]);
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
        opacity,
        transform: `scale(${scale})`,
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
  const {fps} = useVideoConfig();
  const Bg = BACKGROUNDS[scene.bg];
  // ゆっくりズーム(シーンごとに寄り/引きを交互に)
  const zoomIn = index % 2 === 0;
  const scale = interpolate(
    frame,
    [0, scene.durationInFrames],
    zoomIn ? [1, 1.09] : [1.09, 1]
  );
  // 消しゴムキャラは全シーン常駐(左下)。カットの頭でひょこっと跳ねて、
  // 待ってる間はゆっくり揺れる。これでカットの切れ目にテンポが出る
  const hop = spring({frame, fps, config: {damping: 9, mass: 0.6}, durationInFrames: 14});
  const hopY = interpolate(hop, [0, 1], [46, 0]);
  const idleTilt = Math.sin(frame / 20) * 4;
  const eraserTilt = interpolate(hop, [0, 1], [16, 6]) + idleTilt;
  return (
    <AbsoluteFill style={{backgroundColor: 'black'}}>
      <AbsoluteFill style={{transform: `scale(${scale})`}}>
        {/* 背景は OffthreadVideo で描画する。ブラウザではなくRemotion側でデコードするため、
            H.264が入っていないChromeでも背景が出る(レンダリング時の推奨コンポーネント) */}
        {scene.bgVideo ? (
          <OffthreadVideo
            src={staticFile(scene.bgVideo)}
            muted
            loop
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
        ) : (
          <Bg />
        )}
      </AbsoluteFill>
      {/* 上下の暗転グラデーションで文字を読みやすく */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.7) 100%)',
        }}
      />
      <Telop text={scene.telop} style={scene.telopStyle} />
      {/* 消しゴムキャラ(相棒。左下に常駐) */}
      <div style={{position: 'absolute', left: 46, top: 1610 + hopY}}>
        <EraserChar size={150} tilt={eraserTilt} />
      </div>
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
      {/* アカウント名(常時表示。白地+ブランドの青フチで、暗い実写背景でも読める) */}
      {account ? (
        <div style={{position: 'absolute', top: 110, left: 0, right: 0, textAlign: 'center'}}>
          <div style={{position: 'relative', display: 'inline-block'}}>
            <div
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 38,
                letterSpacing: '0.12em',
                position: 'absolute',
                inset: 0,
                WebkitTextStroke: `10px ${BRAND.primary}`,
                color: 'transparent',
              }}
            >
              {account}
            </div>
            <div
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 38,
                letterSpacing: '0.12em',
                position: 'relative',
                color: '#ffffff',
              }}
            >
              {account}
            </div>
          </div>
        </div>
      ) : null}
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
