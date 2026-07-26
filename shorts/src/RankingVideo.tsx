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
import {BRAND, fontFamily} from './brand';
import {AccountLabel, CutBg, EraserChar, outline, parseTelop, softBreaks} from './common';

// ---------- 🏆ランキング型テンプレ(明るい文具系・ブランド4色) ----------
// テロップ記法: **単語** → 黄色マーカー強調

export type RankScene = {
  audio: string;
  role: 'hook' | 'rank' | 'body' | 'save' | 'cta';
  telop: string;
  rank?: number; // role='rank' のとき順位札に出す数字
  headline?: string; // role='rank' のときのツール名(大きく表示)
  time?: {before: string; after: string; label?: string}; // 実測タイム(オレンジ特大)
  bgVideo?: string | null; // 単一の実写背景動画(bgClips未指定時のフォールバック)
  bgClips?: string[]; // 実写背景クリップ群(カット割りで巡回)
  bgSync?: boolean; // true=内容シンクロ(このシーン専用の映像をシーン内で表示)
  bgWash?: number; // 背景動画に被せるブランド色ウォッシュ(0=無し〜1)。既定0
  eraseIn: boolean; // シーン頭で消しゴムワイプ遷移
  playWhoosh: boolean;
  durationInFrames: number;
};

export type RankingVideoProps = {
  account: string;
  bgm: string;
  bgmVolume: number;
  whoosh: string;
  scenes: RankScene[];
};

// ---------- 紙背景(オフホワイト+ドット方眼+役割ごとの差し色) ----------

const PaperBg: React.FC<{role: RankScene['role']; transparent?: boolean}> = ({role, transparent}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 12;
  return (
    <AbsoluteFill style={{backgroundColor: transparent ? 'transparent' : BRAND.base}}>
      {/* ドット方眼(文具ノート感) */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${BRAND.ink}18 3px, transparent 3px)`,
          backgroundSize: '72px 72px',
          backgroundPosition: `${drift}px 0px`,
        }}
      />
      {/* 役割ごとの差し色ブロブ */}
      {role === 'hook' && (
        <div
          style={{
            position: 'absolute',
            left: -200,
            top: 300,
            width: 1480,
            height: 900,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${BRAND.accent}55 0%, transparent 70%)`,
          }}
        />
      )}
      {(role === 'rank' || role === 'body') && (
        <div
          style={{
            position: 'absolute',
            left: 90,
            top: 340,
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${BRAND.accent}40 0%, transparent 68%)`,
            transform: `translateY(${drift}px)`,
          }}
        />
      )}
      {role === 'save' && (
        <AbsoluteFill style={{backgroundColor: `${BRAND.accent}`, opacity: 0.32}} />
      )}
      {role === 'cta' && (
        <div
          style={{
            position: 'absolute',
            left: -150,
            top: 900,
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

// ---------- 消しゴムワイプ遷移(前の画面を消して登場) ----------

const ERASE_FRAMES = 14;

// linger=true: ワイプ後、キャラが画面右側に留まる(rankシーン用)
// linger=false: 従来どおり右へ通り抜ける(saveシーンは中央に別キャラが出るため)
const EraseWipe: React.FC<{linger?: boolean}> = ({linger = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({
    frame,
    fps,
    config: {damping: 22, mass: 0.7},
    durationInFrames: ERASE_FRAMES,
  });
  // 紙色カバーは常に画面外まで抜けきる(消し残しゼロ)
  const wipeX = interpolate(progress, [0, 1], [-350, 1250]);
  // キャラはlinger時のみ右端で停止し、そのまま留まる
  const REST_X = 810;
  const charX = linger ? Math.min(wipeX, REST_X) : wipeX;
  const settled = linger && wipeX >= REST_X;
  const bob = settled ? Math.sin(frame / 14) * 10 : 0;
  const wiping = frame <= ERASE_FRAMES + 4;
  if (!wiping && !linger) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {wiping ? (
        <>
          {/* まだ消えていない部分を紙色で覆う(消しゴムの右側) */}
          <div
            style={{
              position: 'absolute',
              left: wipeX + 60,
              top: 0,
              width: 1400,
              height: '100%',
              backgroundColor: BRAND.base,
            }}
          />
          {/* 消しカス */}
          {Array.from({length: 10}).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: wipeX - 40 - random(`cx${i}`) * 220,
                top: 860 + (random(`cy${i}`) - 0.5) * 700,
                width: 14 + random(`cs${i}`) * 18,
                height: 10 + random(`cs${i}`) * 12,
                borderRadius: 8,
                backgroundColor: BRAND.erase,
                opacity: interpolate(frame, [0, ERASE_FRAMES + 4], [0.9, 0]),
                transform: `rotate(${random(`cr${i}`) * 360}deg)`,
              }}
            />
          ))}
        </>
      ) : null}
      {/* キャラ本体 */}
      <div style={{position: 'absolute', left: charX - 130, top: 900 + bob}}>
        <EraserChar
          size={settled ? 200 : 260}
          tilt={interpolate(progress, [0, 1], [-24, settled ? 4 : 8])}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------- 順位札(青地×白文字・スプリング登場) ----------

const RankBadge: React.FC<{rank: number}> = ({rank}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({
    frame: frame - ERASE_FRAMES,
    fps,
    config: {damping: 11, mass: 0.6},
    durationInFrames: 18,
  });
  return (
    <div
      style={{
        position: 'absolute',
        top: 400,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        transform: `scale(${pop})`,
      }}
    >
      <div
        style={{
          backgroundColor: rank === 1 ? BRAND.spark : BRAND.primary,
          color: '#ffffff',
          fontFamily,
          fontWeight: 900,
          fontSize: 96,
          padding: '28px 88px',
          borderRadius: 40,
          border: `10px solid ${BRAND.ink}`,
          boxShadow: `0 14px 0 ${BRAND.ink}44`,
          letterSpacing: '0.04em',
        }}
      >
        第{rank}位
      </div>
    </div>
  );
};

// ---------- 実測タイム(グレー打ち消し → オレンジ特大) ----------

const TimeGap: React.FC<{time: NonNullable<RankScene['time']>}> = ({time}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const before = spring({frame: frame - 4, fps, config: {damping: 200}, durationInFrames: 10});
  const after = spring({frame: frame - 16, fps, config: {damping: 10, mass: 0.5}, durationInFrames: 16});
  const numStyle: React.CSSProperties = {
    fontFamily,
    fontWeight: 900,
    lineHeight: 1.1,
    textAlign: 'center',
  };
  return (
    <div style={{position: 'absolute', top: 480, left: 0, right: 0, textAlign: 'center'}}>
      {time.label ? (
        <div style={{...numStyle, fontSize: 66, color: BRAND.ink, opacity: before, textShadow: outline('#ffffff')}}>
          {time.label}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 40,
          marginTop: 20,
        }}
      >
        <div style={{...numStyle, fontSize: 118, color: BRAND.erase, opacity: before, position: 'relative', textShadow: outline('#ffffff')}}>
          {time.before}
          {/* 打ち消し線(消された感) */}
          <div
            style={{
              position: 'absolute',
              left: -8,
              right: -8,
              top: '52%',
              height: 14,
              borderRadius: 7,
              backgroundColor: BRAND.ink,
              transform: `scaleX(${before}) rotate(-4deg)`,
              transformOrigin: 'left',
            }}
          />
        </div>
        <div style={{...numStyle, fontSize: 104, color: BRAND.ink, opacity: after, textShadow: outline('#ffffff')}}>→</div>
        <div
          style={{
            ...numStyle,
            fontSize: 196,
            color: BRAND.spark,
            opacity: after,
            transform: `scale(${0.6 + after * 0.4})`,
            textShadow: outline('#ffffff'),
          }}
        >
          {time.after}
        </div>
      </div>
    </div>
  );
};

// ---------- テロップ(**強調**=黄色マーカー) ----------

const Telop: React.FC<{text: string; big?: boolean}> = ({text, big}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const appear = spring({
    frame: frame - ERASE_FRAMES / 2,
    fps,
    config: {damping: 200},
    durationInFrames: 12,
  });
  const fontSize = big ? 112 : 94;
  return (
    <div
      style={{
        position: 'absolute',
        left: 50,
        right: 50,
        top: big ? 780 : 1200,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 36}px)`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize,
          lineHeight: 1.5,
          color: BRAND.ink,
          whiteSpace: 'pre-wrap',
          wordBreak: 'keep-all',
          textWrap: 'balance',
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

// ---------- ツール名見出し(rankシーン) ----------

const Headline: React.FC<{text: string}> = ({text}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const appear = spring({
    frame: frame - ERASE_FRAMES - 6,
    fps,
    config: {damping: 200},
    durationInFrames: 12,
  });
  return (
    <div
      style={{
        position: 'absolute',
        top: 640,
        left: 40,
        right: 40,
        textAlign: 'center',
        opacity: appear,
        transform: `translateY(${(1 - appear) * 30}px)`,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          fontFamily,
          fontWeight: 900,
          fontSize: 110,
          color: BRAND.ink,
          backgroundColor: '#ffffff',
          border: `10px solid ${BRAND.ink}`,
          borderRadius: 34,
          padding: '20px 60px',
          boxShadow: `0 12px 0 ${BRAND.ink}33`,
          lineHeight: 1.2,
          wordBreak: 'keep-all',
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ---------- 保存誘導(saveシーン・キャラ登場) ----------

const SaveCue: React.FC = () => {
  const frame = useCurrentFrame();
  const bounce = Math.abs(Math.sin(frame / 12)) * 26;
  return (
    <div
      style={{
        position: 'absolute',
        top: 400,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 36,
      }}
    >
      <div style={{transform: `translateY(${-bounce}px)`}}>
        <EraserChar size={240} tilt={6} />
      </div>
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 88,
          color: '#ffffff',
          backgroundColor: BRAND.primary,
          border: `10px solid ${BRAND.ink}`,
          borderRadius: 40,
          padding: '22px 72px',
          boxShadow: `0 14px 0 ${BRAND.ink}44`,
        }}
      >
        🔖 保存
      </div>
    </div>
  );
};

// ---------- 1シーン ----------

const SceneView: React.FC<{scene: RankScene; index: number; startFrame: number; whoosh: string}> = ({scene, index, startFrame, whoosh}) => {
  const clips = scene.bgClips ?? (scene.bgVideo ? [scene.bgVideo] : []);
  return (
    <AbsoluteFill style={{backgroundColor: BRAND.base}}>
      <CutBg
        clips={clips}
        startFrame={startFrame}
        washColor={BRAND.base}
        wash={scene.bgWash}
        local={scene.bgSync}
        sceneDuration={scene.durationInFrames}
      />
      <PaperBg role={scene.role} transparent={clips.length > 0} />
      {scene.role === 'rank' && scene.rank ? <RankBadge rank={scene.rank} /> : null}
      {scene.role === 'rank' && scene.headline ? <Headline text={scene.headline} /> : null}
      {scene.time ? <TimeGap time={scene.time} /> : null}
      {scene.role === 'save' ? <SaveCue /> : null}
      <Telop text={scene.telop} big={scene.role === 'hook' && !scene.time} />
      {scene.eraseIn ? <EraseWipe linger={scene.role === 'rank'} /> : null}
      <Audio src={staticFile(scene.audio)} />
      {scene.playWhoosh ? <Audio src={staticFile(whoosh)} volume={0.3} /> : null}
    </AbsoluteFill>
  );
};

// ---------- 動画全体 ----------

export const RankingVideo: React.FC<RankingVideoProps> = ({
  account,
  bgm,
  bgmVolume,
  whoosh,
  scenes,
}) => {
  const total = scenes.reduce((a, s) => a + s.durationInFrames, 0);
  let from = 0;
  return (
    <AbsoluteFill style={{backgroundColor: BRAND.base}}>
      {scenes.map((scene, i) => {
        const seq = (
          <Sequence key={i} from={from} durationInFrames={scene.durationInFrames}>
            <SceneView scene={scene} index={i} startFrame={from} whoosh={whoosh} />
          </Sequence>
        );
        from += scene.durationInFrames;
        return seq;
      })}
      {/* アカウント名(常時・青文字＋白フチ) */}
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
