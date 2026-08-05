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

// ---------- 💬体験談型テンプレ(検証ノート風・進行形ドキュメンタリー) ----------
// 構成: day(Day表示) → story(語り) → big(数字ドン) → rule(3か条) → line(LINE誘導)
// ナレーションは肉声推奨。TTSを使う場合はAI生成開示フラグを忘れずに。

export type StoryScene = {
  audio: string;
  role: 'day' | 'story' | 'big' | 'rule' | 'line';
  telop: string;
  day?: number; // role='day' の日数
  big?: {value: string; label: string}; // role='big' の数字(例 ¥0)
  items?: string[]; // role='rule' の箇条書き
  keyword?: string; // role='line' の合言葉
  bgVideo?: string | null; // 単一の実写背景動画(bgClips未指定時のフォールバック)
  bgClips?: string[]; // 実写背景クリップ群(カット割りで巡回)
  bgWash?: number; // 背景動画に被せるブランド色ウォッシュ(0=無し〜1)。既定0
  durationInFrames: number;
};

export type StoryVideoProps = {
  account: string;
  brand?: string; // ブランドキー(src/brand.ts の BRANDS)。未指定は既定ブランド
  bgm: string;
  bgmVolume: number;
  scenes: StoryScene[];
};

// ノート風背景(横罫線+温かい紙色)
const NoteBg: React.FC<{transparent?: boolean}> = ({transparent}) => {
  const BRAND = useBrand();
  return (
    <AbsoluteFill style={{backgroundColor: transparent ? 'transparent' : BRAND.base}}>
      <DotGrid dotColor={`${BRAND.ink}10`} />
      {/* 横罫線(大学ノート風) */}
      {Array.from({length: 12}).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 70,
            right: 70,
            top: 400 + i * 120,
            height: 3,
            backgroundColor: `${BRAND.primary}22`,
          }}
        />
      ))}
      {/* 左マージンの赤線(ノート感) */}
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 340,
          bottom: 240,
          width: 3,
          backgroundColor: `${BRAND.spark}44`,
        }}
      />
    </AbsoluteFill>
  );
};

// Dayスタンプ(役所の判子風・少し傾ける)
const DayStamp: React.FC<{day: number}> = ({day}) => {
  const BRAND = useBrand();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - 4, fps, config: {damping: 9, mass: 0.5}, durationInFrames: 14});
  return (
    <div
      style={{
        position: 'absolute',
        top: 480,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        transform: `scale(${pop}) rotate(-5deg)`,
      }}
    >
      <div
        style={{
          border: `14px solid ${BRAND.spark}`,
          borderRadius: 28,
          padding: '20px 70px',
          fontFamily,
          fontWeight: 900,
          fontSize: 150,
          color: BRAND.spark,
          backgroundColor: `${BRAND.base}dd`,
        }}
      >
        Day {day}
      </div>
    </div>
  );
};

// 数字ドン(収支など)
const BigValue: React.FC<{big: {value: string; label: string}}> = ({big}) => {
  const BRAND = useBrand();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const appear = spring({frame: frame - 4, fps, config: {damping: 200}, durationInFrames: 10});
  const pop = spring({frame: frame - 10, fps, config: {damping: 10, mass: 0.5}, durationInFrames: 16});
  return (
    <div style={{position: 'absolute', top: 560, left: 0, right: 0, textAlign: 'center'}}>
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 72,
          color: BRAND.ink,
          opacity: appear,
          textShadow: outline('#ffffff'),
        }}
      >
        {big.label}
      </div>
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 250,
          color: BRAND.spark,
          transform: `scale(${0.6 + pop * 0.4})`,
          textShadow: outline('#ffffff'),
          marginTop: 10,
        }}
      >
        {big.value}
      </div>
    </div>
  );
};

// 3か条(1行ずつスタンプされる)
const RuleList: React.FC<{items: string[]}> = ({items}) => {
  const BRAND = useBrand();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div
      style={{
        position: 'absolute',
        top: 520,
        left: 120,
        right: 80,
        display: 'flex',
        flexDirection: 'column',
        gap: 56,
      }}
    >
      {items.map((item, i) => {
        const pop = spring({
          frame: frame - 6 - i * 14,
          fps,
          config: {damping: 12, mass: 0.6},
          durationInFrames: 14,
        });
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 30,
              transform: `scale(${pop})`,
              transformOrigin: 'left center',
            }}
          >
            <div
              style={{
                minWidth: 90,
                height: 90,
                borderRadius: '50%',
                backgroundColor: BRAND.primary,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily,
                fontWeight: 900,
                fontSize: 54,
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: 70,
                color: BRAND.ink,
                lineHeight: 1.3,
                textShadow: outline('#ffffff'),
              }}
            >
              {item}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// LINE誘導カード(合言葉つき)
const LineCard: React.FC<{keyword: string}> = ({keyword}) => {
  const BRAND = useBrand();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - 6, fps, config: {damping: 12, mass: 0.7}, durationInFrames: 16});
  return (
    <div
      style={{
        position: 'absolute',
        top: 500,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 36,
        transform: `scale(${pop})`,
      }}
    >
      <div
        style={{
          backgroundColor: '#06C755',
          color: '#ffffff',
          fontFamily,
          fontWeight: 900,
          fontSize: 76,
          padding: '30px 80px',
          borderRadius: 40,
          border: `10px solid ${BRAND.ink}`,
          boxShadow: `0 14px 0 ${BRAND.ink}44`,
        }}
      >
        LINEで合言葉
      </div>
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 120,
          color: BRAND.ink,
          backgroundColor: BRAND.accent,
          padding: '16px 70px',
          borderRadius: 30,
          transform: 'rotate(-3deg)',
        }}
      >
        「{keyword}」
      </div>
    </div>
  );
};

// テロップ(ネイビー文字+黄マーカー。storyは少し大きめ行間で「語り」感)
const Telop: React.FC<{text: string; calm?: boolean}> = ({text, calm}) => {
  const BRAND = useBrand();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const appear = spring({frame: frame - 3, fps, config: {damping: 200}, durationInFrames: 14});
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: calm ? 880 : 1240,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 30}px)`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: calm ? 102 : 90,
          lineHeight: 1.65,
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

const SceneView: React.FC<{scene: StoryScene; index: number}> = ({scene, index}) => {
  const BRAND = useBrand();
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 16) * 8;
  const clips = scene.bgClips ?? (scene.bgVideo ? [scene.bgVideo] : []);
  return (
    <AbsoluteFill style={{backgroundColor: BRAND.base}}>
      <CutBg clips={clips} seed={index} washColor={BRAND.base} wash={scene.bgWash} />
      <NoteBg transparent={clips.length > 0} />
      {scene.role === 'day' && scene.day !== undefined ? <DayStamp day={scene.day} /> : null}
      {scene.role === 'big' && scene.big ? <BigValue big={scene.big} /> : null}
      {scene.role === 'rule' && scene.items ? <RuleList items={scene.items} /> : null}
      {scene.role === 'line' && scene.keyword ? <LineCard keyword={scene.keyword} /> : null}
      <Telop text={scene.telop} calm={scene.role === 'story'} />
      {/* 相棒のマスコット(左下で常に聞いている) */}
      <div style={{position: 'absolute', left: 60, top: 1600 + bob}}>
        <Mascot size={150} tilt={8} />
      </div>
      <Audio src={staticFile(scene.audio)} />
    </AbsoluteFill>
  );
};

export const StoryVideo: React.FC<StoryVideoProps> = ({account, brand, bgm, bgmVolume, scenes}) => {
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
