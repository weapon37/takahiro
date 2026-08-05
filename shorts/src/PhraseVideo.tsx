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
import {BrandContext, fontFamily, resolveBrand, useBrand} from './brand';
import {AccountLabel, CutBg, DotGrid, Mascot, outline, parseTelop} from './common';

// ---------- 📝セリフ型テンプレ(このチャンネルの主役) ----------
// コンセプト:「不動産屋に聞きにくいことを、代わりに言語化する」
// 視聴者が損をするのは情報不足ではなく「聞けない・断れない・言い返せない」から。
// だからこの型が渡すのは知識ではなく、そのまま言える一言。
//
// 構成: hook(宛名+場面) → said(相手のセリフ) → phrase(こう言う★主役)
//       → why(なぜ効くか) → back(押し返されたときの返し) → save → cta
// テロップ記法: **単語** → 黄色マーカー強調

export type PhraseScene = {
  audio: string;
  role: 'hook' | 'said' | 'phrase' | 'why' | 'back' | 'save' | 'cta';
  telop: string;
  said?: string; // 相手(不動産屋・管理会社)のセリフ。role='said'/'back' で表示
  phrase?: string; // 自分が言うセリフ(この型の主役)。role='phrase'/'back' で表示
  bgVideo?: string | null;
  bgClips?: string[];
  bgWash?: number;
  durationInFrames: number;
};

export type PhraseVideoProps = {
  account: string;
  brand?: string;
  bgm: string;
  bgmVolume: number;
  scenes: PhraseScene[];
};

// ---------- 紙背景(役割ごとの差し色) ----------

const PaperBg: React.FC<{role: PhraseScene['role']; transparent?: boolean}> = ({role, transparent}) => {
  const BRAND = useBrand();
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 12;
  return (
    <AbsoluteFill style={{backgroundColor: transparent ? 'transparent' : BRAND.base}}>
      <DotGrid dotColor={`${BRAND.ink}14`} />
      {/* 主役のphraseシーンだけ、画面全体をわずかに温める */}
      {role === 'phrase' && (
        <div
          style={{
            position: 'absolute',
            left: -160,
            top: 380,
            width: 1400,
            height: 1000,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${BRAND.accent}66 0%, transparent 70%)`,
            transform: `translateY(${drift}px)`,
          }}
        />
      )}
      {role === 'save' && <AbsoluteFill style={{backgroundColor: BRAND.accent, opacity: 0.3}} />}
      {role === 'cta' && (
        <div
          style={{
            position: 'absolute',
            left: -150,
            top: 880,
            width: 1400,
            height: 1200,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${BRAND.primary}26 0%, transparent 70%)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ---------- チャット吹き出し ----------
// 左(グレー)=相手が言ってくること / 右(ブランド色)=こちらが言い返す一言

const Bubble: React.FC<{
  text: string;
  side: 'left' | 'right';
  delay?: number;
  top: number;
  label?: string;
}> = ({text, side, delay = 0, top, label}) => {
  const BRAND = useBrand();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - delay, fps, config: {damping: 14, mass: 0.6}, durationInFrames: 16});
  const isMine = side === 'right';
  const slide = interpolate(pop, [0, 1], [isMine ? 90 : -90, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: isMine ? 110 : 60,
        right: isMine ? 60 : 110,
        opacity: pop,
        transform: `translateX(${slide}px)`,
      }}
    >
      {label ? (
        <div
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 34,
            color: `${BRAND.ink}aa`,
            marginBottom: 12,
            textAlign: isMine ? 'right' : 'left',
          }}
        >
          {label}
        </div>
      ) : null}
      <div
        style={{
          position: 'relative',
          backgroundColor: isMine ? BRAND.primary : '#ffffff',
          color: isMine ? '#ffffff' : BRAND.ink,
          border: `9px solid ${BRAND.ink}`,
          borderRadius: 44,
          padding: '30px 40px',
          fontFamily,
          fontWeight: 900,
          fontSize: isMine
            ? fitFontSize(text, [[9, 72], [12, 62], [15, 54], [18, 46]])
            : fitFontSize(text, [[10, 60], [13, 54], [16, 48], [19, 42]]),
          lineHeight: 1.4,
          whiteSpace: 'pre-wrap',
          boxShadow: `0 12px 0 ${BRAND.ink}26`,
        }}
      >
        {text}
        {/* しっぽ */}
        <div
          style={{
            position: 'absolute',
            bottom: -34,
            [isMine ? 'right' : 'left']: 64,
            width: 0,
            height: 0,
            borderLeft: '26px solid transparent',
            borderRight: '26px solid transparent',
            borderTop: `34px solid ${BRAND.ink}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -18,
            [isMine ? 'right' : 'left']: 74,
            width: 0,
            height: 0,
            borderLeft: '16px solid transparent',
            borderRight: '16px solid transparent',
            borderTop: `22px solid ${isMine ? BRAND.primary : '#ffffff'}`,
          }}
        />
      </div>
    </div>
  );
};

// 行の最大文字数から字送りを決める(勝手な折り返しで1文字だけ次行に落ちるのを防ぐ)
const fitFontSize = (text: string, sizes: [number, number][]): number => {
  const longest = Math.max(...text.split('\n').map((l) => l.length));
  for (const [maxChars, size] of sizes) if (longest <= maxChars) return size;
  return sizes[sizes.length - 1][1];
};

// ---------- 主役: 言うべき一言(大きな引用カード) ----------

const PhraseCard: React.FC<{text: string}> = ({text}) => {
  const BRAND = useBrand();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - 4, fps, config: {damping: 12, mass: 0.6}, durationInFrames: 18});
  const badge = spring({frame: frame - 22, fps, config: {damping: 11, mass: 0.5}, durationInFrames: 14});
  return (
    <div style={{position: 'absolute', top: 470, left: 50, right: 50, transform: `scale(${0.7 + pop * 0.3})`, opacity: pop}}>
      {/* 「こう言う」ラベル */}
      <div style={{textAlign: 'center', marginBottom: 18}}>
        <span
          style={{
            display: 'inline-block',
            fontFamily,
            fontWeight: 900,
            fontSize: 46,
            color: '#ffffff',
            backgroundColor: BRAND.spark,
            border: `8px solid ${BRAND.ink}`,
            borderRadius: 999,
            padding: '10px 44px',
          }}
        >
          こう言う
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          backgroundColor: '#ffffff',
          border: `11px solid ${BRAND.ink}`,
          borderRadius: 48,
          padding: '56px 44px 48px',
          boxShadow: `0 16px 0 ${BRAND.ink}33`,
        }}
      >
        {/* 開き括弧 */}
        <div style={{position: 'absolute', top: -8, left: 26, fontFamily, fontWeight: 900, fontSize: 130, color: `${BRAND.accent}`, lineHeight: 1}}>
          「
        </div>
        <div
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: fitFontSize(text, [[8, 92], [11, 78], [14, 64], [17, 54]]),
            lineHeight: 1.45,
            color: BRAND.ink,
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
          }}
        >
          {text}
        </div>
        {/* 閉じ括弧 */}
        <div style={{position: 'absolute', bottom: -46, right: 26, fontFamily, fontWeight: 900, fontSize: 130, color: `${BRAND.accent}`, lineHeight: 1}}>
          」
        </div>
      </div>
      {/* そのまま言ってOKバッジ */}
      <div style={{textAlign: 'center', marginTop: 34, transform: `scale(${badge}) rotate(-4deg)`}}>
        <span
          style={{
            display: 'inline-block',
            fontFamily,
            fontWeight: 900,
            fontSize: 42,
            color: BRAND.ink,
            backgroundColor: BRAND.accent,
            borderRadius: 16,
            padding: '10px 32px',
          }}
        >
          このまま言ってOK
        </span>
      </div>
    </div>
  );
};

// ---------- 根拠(whyシーン) ----------

const WhyNote: React.FC = () => {
  const BRAND = useBrand();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - 3, fps, config: {damping: 13, mass: 0.6}, durationInFrames: 16});
  return (
    <div style={{position: 'absolute', top: 520, left: 0, right: 0, textAlign: 'center', transform: `scale(${pop})`}}>
      <span
        style={{
          display: 'inline-block',
          fontFamily,
          fontWeight: 900,
          fontSize: 54,
          color: '#ffffff',
          backgroundColor: BRAND.ink,
          borderRadius: 999,
          padding: '16px 56px',
        }}
      >
        なぜ効くか
      </span>
    </div>
  );
};

// ---------- 保存誘導 ----------

const SaveCue: React.FC = () => {
  const BRAND = useBrand();
  const frame = useCurrentFrame();
  const bounce = Math.abs(Math.sin(frame / 12)) * 24;
  return (
    <div style={{position: 'absolute', top: 430, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32}}>
      <div style={{transform: `translateY(${-bounce}px)`}}>
        <Mascot size={230} tilt={5} />
      </div>
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 84,
          color: '#ffffff',
          backgroundColor: BRAND.primary,
          border: `10px solid ${BRAND.ink}`,
          borderRadius: 40,
          padding: '20px 68px',
          boxShadow: `0 14px 0 ${BRAND.ink}44`,
        }}
      >
        🔖 保存
      </div>
    </div>
  );
};

// ---------- テロップ ----------

const Telop: React.FC<{text: string; big?: boolean; top: number}> = ({text, big, top}) => {
  const BRAND = useBrand();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const appear = spring({frame: frame - 3, fps, config: {damping: 200}, durationInFrames: 12});
  return (
    <div
      style={{
        position: 'absolute',
        left: 50,
        right: 50,
        top,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 32}px)`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: big ? 108 : 88,
          lineHeight: 1.5,
          color: BRAND.ink,
          whiteSpace: 'pre-wrap',
          textShadow: outline('#ffffff'),
        }}
      >
        {parseTelop(text).map((seg, i) =>
          seg.hl ? (
            <span
              key={i}
              style={{
                background: `linear-gradient(transparent 42%, ${BRAND.accent} 42%, ${BRAND.accent} 96%, transparent 96%)`,
                padding: '0 6px',
              }}
            >
              {seg.t}
            </span>
          ) : (
            <span key={i}>{seg.t}</span>
          )
        )}
      </div>
    </div>
  );
};

// ---------- 1シーン ----------

const SceneView: React.FC<{scene: PhraseScene; index: number}> = ({scene, index}) => {
  const BRAND = useBrand();
  const clips = scene.bgClips ?? (scene.bgVideo ? [scene.bgVideo] : []);
  const {role} = scene;
  return (
    <AbsoluteFill style={{backgroundColor: BRAND.base}}>
      <CutBg clips={clips} seed={index} washColor={BRAND.base} wash={scene.bgWash} />
      <PaperBg role={role} transparent={clips.length > 0} />

      {/* 相手のセリフ(言われがちなこと) */}
      {role === 'said' && scene.said ? (
        <Bubble text={scene.said} side="left" top={520} label="言われがちなこと" />
      ) : null}

      {/* 主役: こちらが言う一言 */}
      {role === 'phrase' && scene.phrase ? <PhraseCard text={scene.phrase} /> : null}

      {/* 押し返されたときの返し: 相手 → 自分 の2段 */}
      {role === 'back' && scene.said ? (
        <>
          <Bubble text={scene.said} side="left" top={420} label="こう返されたら" />
          {scene.phrase ? <Bubble text={scene.phrase} side="right" delay={16} top={760} label="こう返す" /> : null}
        </>
      ) : null}

      {role === 'why' ? <WhyNote /> : null}
      {role === 'save' ? <SaveCue /> : null}

      <Telop
        text={scene.telop}
        big={role === 'hook'}
        top={role === 'hook' ? 800 : role === 'why' ? 700 : 1320}
      />

      {/* マスコット(常に左下で見守る。saveシーンは中央に出るので省く) */}
      {role !== 'save' ? (
        <div style={{position: 'absolute', left: 44, top: 1620}}>
          <Mascot size={140} tilt={6} />
        </div>
      ) : null}

      <Audio src={staticFile(scene.audio)} />
    </AbsoluteFill>
  );
};

// ---------- 動画全体 ----------

export const PhraseVideo: React.FC<PhraseVideoProps> = ({account, brand, bgm, bgmVolume, scenes}) => {
  // 最上位だけは props からブランドを解決し、以下の部品へコンテキストで配る
  const BRAND = resolveBrand(brand);
  const total = scenes.reduce((a, s) => a + s.durationInFrames, 0);
  let from = 0;
  return (
    <BrandContext.Provider value={BRAND}>
      <AbsoluteFill style={{backgroundColor: BRAND.base}}>
        {scenes.map((scene, i) => {
          const seq = (
            <Sequence key={i} from={from} durationInFrames={scene.durationInFrames}>
              <SceneView scene={scene} index={i} />
            </Sequence>
          );
          from += scene.durationInFrames;
          return seq;
        })}
        <AccountLabel name={account} color={`${BRAND.ink}99`} />
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
    </BrandContext.Provider>
  );
};
