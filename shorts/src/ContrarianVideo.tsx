import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {BRAND, fontFamily} from './brand';
import {AccountLabel, CutBg, DotGrid, EraserChar, outline, parseTelop, softBreaks} from './common';

// ---------- ⚡逆張り型テンプレ(ネイビー基調・議論を誘発する構成) ----------
// 構成: hook(言い切り) → body(根拠) → point(①②③) → flip(条件付きの例外) → vs(どっち派?)
// テロップ記法: **単語** → オレンジ帯強調

export type ContraScene = {
  audio: string;
  role: 'hook' | 'body' | 'point' | 'flip' | 'vs';
  telop: string;
  num?: number; // role='point' の番号(①②③)
  vs?: {left: string; right: string}; // role='vs' の対決ラベル
  bgVideo?: string | null; // 単一の実写背景動画(bgClips未指定時のフォールバック)
  bgClips?: string[]; // 実写背景クリップ群(カット割りで巡回)
  bgSync?: boolean; // true=内容シンクロ(このシーン専用の映像をシーン内で表示)
  bgWash?: number; // 背景動画に被せるブランド色ウォッシュ(0=無し〜1)。既定0
  durationInFrames: number;
};

export type ContrarianVideoProps = {
  account: string;
  bgm: string;
  bgmVolume: number;
  scenes: ContraScene[];
};

// ネイビー紙背景(ダークトーン+役割で差し色)
const NavyBg: React.FC<{role: ContraScene['role']; transparent?: boolean}> = ({role, transparent}) => (
  <AbsoluteFill style={{backgroundColor: transparent ? 'transparent' : BRAND.ink}}>
    <DotGrid dotColor="rgba(247,244,238,0.09)" />
    {role === 'hook' && (
      <div
        style={{
          position: 'absolute',
          left: -180,
          top: 420,
          width: 1440,
          height: 900,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${BRAND.spark}33 0%, transparent 68%)`,
        }}
      />
    )}
    {role === 'flip' && (
      <div
        style={{
          position: 'absolute',
          left: -100,
          top: 500,
          width: 1280,
          height: 900,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${BRAND.accent}40 0%, transparent 68%)`,
        }}
      />
    )}
  </AbsoluteFill>
);

// テロップ(白文字+**強調**はオレンジ帯)
const Telop: React.FC<{text: string; big?: boolean}> = ({text, big}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const appear = spring({frame: frame - 3, fps, config: {damping: 200}, durationInFrames: 12});
  return (
    <div
      style={{
        position: 'absolute',
        left: 50,
        right: 50,
        top: big ? 760 : 1200,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 36}px)`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: big ? 104 : 94,
          lineHeight: 1.5,
          color: '#ffffff',
          whiteSpace: 'pre-wrap', wordBreak: 'keep-all', textWrap: 'balance',
          textShadow: outline(BRAND.ink),
        }}
      >
        {parseTelop(text).map((seg, i) =>
          seg.hl ? (
            <span
              key={i}
              style={{
                background: `linear-gradient(transparent 8%, ${BRAND.spark} 8%, ${BRAND.spark} 96%, transparent 96%)`,
                padding: '0 10px',
                borderRadius: 12,
                whiteSpace: 'nowrap',
              }}
            >
              {seg.t}
            </span>
          ) : (
            <span key={i}>{softBreaks(seg.t)}</span>
          )
        )}
      </div>
    </div>
  );
};

// ①②③の番号バッジ(pointシーン)
const NumBadge: React.FC<{num: number}> = ({num}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - 2, fps, config: {damping: 11, mass: 0.6}, durationInFrames: 16});
  return (
    <div
      style={{
        position: 'absolute',
        top: 520,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        transform: `scale(${pop})`,
      }}
    >
      <div
        style={{
          width: 300,
          height: 300,
          borderRadius: '50%',
          backgroundColor: BRAND.spark,
          border: '12px solid #ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily,
          fontWeight: 900,
          fontSize: 160,
          color: '#ffffff',
          boxShadow: `0 16px 0 rgba(0,0,0,0.25)`,
        }}
      >
        {num}
      </div>
    </div>
  );
};

// 対決画面(vsシーン): 左右パネル+中央VS
const VsPanel: React.FC<{vs: {left: string; right: string}}> = ({vs}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const slideL = spring({frame: frame - 2, fps, config: {damping: 16}, durationInFrames: 14});
  const slideR = spring({frame: frame - 6, fps, config: {damping: 16}, durationInFrames: 14});
  const vsPop = spring({frame: frame - 12, fps, config: {damping: 9, mass: 0.5}, durationInFrames: 16});
  const panel: React.CSSProperties = {
    position: 'absolute',
    top: 560,
    width: 400,
    height: 540,
    borderRadius: 44,
    border: `12px solid #ffffff`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily,
    fontWeight: 900,
    fontSize: 72,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 1.25,
    padding: '0 18px',
    boxSizing: 'border-box',
    whiteSpace: 'pre-wrap', wordBreak: 'keep-all', textWrap: 'balance',
  };
  return (
    <>
      <div
        style={{
          ...panel,
          left: 50,
          backgroundColor: BRAND.primary,
          transform: `translateX(${(1 - slideL) * -600}px)`,
        }}
      >
        {vs.left}
      </div>
      <div
        style={{
          ...panel,
          right: 50,
          backgroundColor: BRAND.spark,
          transform: `translateX(${(1 - slideR) * 600}px)`,
        }}
      >
        {vs.right}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 768,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily,
          fontWeight: 900,
          fontSize: 110,
          color: BRAND.accent,
          transform: `scale(${vsPop}) rotate(-6deg)`,
          textShadow: outline(BRAND.ink, 7),
        }}
      >
        VS
      </div>
    </>
  );
};

// フックの打ち消し演出: 消しゴムが下から通り、**強調**語に取り消し線が走る
const HookStrike: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const slide = spring({frame: frame - 8, fps, config: {damping: 18}, durationInFrames: 18});
  const x = interpolate(slide, [0, 1], [-300, 800]);
  return (
    <div style={{position: 'absolute', left: x, top: 1420}}>
      <EraserChar size={190} tilt={interpolate(slide, [0, 1], [-20, 6])} />
    </div>
  );
};

const SceneView: React.FC<{scene: ContraScene; index: number; startFrame: number}> = ({scene, startFrame}) => {
  const clips = scene.bgClips ?? (scene.bgVideo ? [scene.bgVideo] : []);
  return (
    <AbsoluteFill style={{backgroundColor: BRAND.ink}}>
      <CutBg
        clips={clips}
        startFrame={startFrame}
        washColor={BRAND.ink}
        wash={scene.bgWash}
        local={scene.bgSync}
        sceneDuration={scene.durationInFrames}
      />
      <NavyBg role={scene.role} transparent={clips.length > 0} />
      {scene.role === 'point' && scene.num ? <NumBadge num={scene.num} /> : null}
      {scene.role === 'vs' && scene.vs ? <VsPanel vs={scene.vs} /> : null}
      <Telop text={scene.telop} big={scene.role === 'hook' || scene.role === 'flip'} />
      {scene.role === 'hook' ? <HookStrike /> : null}
      <Audio src={staticFile(scene.audio)} />
    </AbsoluteFill>
  );
};

export const ContrarianVideo: React.FC<ContrarianVideoProps> = ({
  account,
  bgm,
  bgmVolume,
  scenes,
}) => {
  const total = scenes.reduce((a, s) => a + s.durationInFrames, 0);
  let from = 0;
  return (
    <AbsoluteFill style={{backgroundColor: BRAND.ink}}>
      {scenes.map((scene, i) => {
        const seq = (
          <Sequence key={i} from={from} durationInFrames={scene.durationInFrames}>
            <SceneView scene={scene} index={i} startFrame={from} />
          </Sequence>
        );
        from += scene.durationInFrames;
        return seq;
      })}
      <AccountLabel name={account} />
      {bgm ? (
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
      ) : null}
    </AbsoluteFill>
  );
};
