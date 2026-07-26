import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {CutBg, parseTelop, softBreaks} from './common';

// ---------- 実写ミニマル型テンプレ ----------
// 思想: 作り込みを捨てて「現地で撮ってきた感」で成立させる。
//   ・背景は自作の実写素材を主役にする(ズーム演出は控えめ)
//   ・テロップは白文字＋半透明の帯のみ(極太フォント/白フチ/マーカー/紙背景/順位札なし)
//   ・順位は数字を小さく添えるだけ。装飾で情報を足さない
// RankingVideo と同じ props 形状を受けるので、同じ台本・音声をそのまま流用できる。

export type MinimalScene = {
  audio: string;
  role: 'hook' | 'rank' | 'body' | 'save' | 'cta' | 'point' | 'flip' | 'vs';
  telop: string;
  rank?: number;
  num?: number;
  headline?: string;
  bgVideo?: string | null;
  bgClips?: string[];
  bgSync?: boolean;
  bgWash?: number;
  durationInFrames: number;
};

export type MinimalVideoProps = {
  account: string;
  bgm: string;
  bgmVolume: number;
  scenes: MinimalScene[];
};

// 帯の色: 撮ってきた映像に馴染む、彩度を落としたカーキ(黒帯より柔らかく、白文字が読める)
const BAND = 'rgba(122, 112, 62, 0.72)';
// このマシンに実在するフォントを使う(未インストールのフォント名を書くと太さ指定が効かない)。
// ミニマル型は丸ゴシック(Zen Maru)より素のゴシックが似合うので IPAPGothic を主に、
// 強調の極太だけ Zen Maru Gothic Black に任せる。
const MINIMAL_FONT = "'IPAPGothic', 'IPAGothic', sans-serif";
const MINIMAL_FONT_BOLD = "'Zen Maru Gothic Black', 'Zen Maru Gothic', 'IPAPGothic', sans-serif";

// テロップ: 画面上部・3行想定。強調も色を変えず太さだけ変える(装飾を足さない)
const MinimalTelop: React.FC<{text: string; small?: boolean}> = ({text, small}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        top: 300,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div
        style={{
          backgroundColor: BAND,
          padding: '26px 40px',
          maxWidth: 940,
          textAlign: 'center',
          fontFamily: MINIMAL_FONT,
          fontWeight: 400,
          fontSize: small ? 62 : 72,
          lineHeight: 1.45,
          color: '#ffffff',
          whiteSpace: 'pre-wrap',
          wordBreak: 'keep-all',
          textWrap: 'balance',
        }}
      >
        {parseTelop(text).map((seg, i) =>
          seg.hl ? (
            <span
              key={i}
              style={{fontFamily: MINIMAL_FONT_BOLD, fontWeight: 900, whiteSpace: 'nowrap'}}
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

// 順位/番号: 帯の上に小さく添えるだけ(札やバッジは作らない)
const MinimalIndex: React.FC<{label: string}> = ({label}) => (
  <div
    style={{
      position: 'absolute',
      top: 216,
      left: 0,
      right: 0,
      textAlign: 'center',
      fontFamily: MINIMAL_FONT_BOLD,
      fontWeight: 900,
      fontSize: 56,
      letterSpacing: '0.08em',
      color: '#ffffff',
      // 明るい背景(空・花)でも沈まないよう影を重ねる
      textShadow:
        '0 0 8px rgba(0,0,0,0.9), 0 2px 5px rgba(0,0,0,0.95), 0 0 22px rgba(0,0,0,0.65)',
    }}
  >
    {label}
  </div>
);

// アカウント名: 下部に小さく、控えめに置く(上部の主張は避ける)
const MinimalAccount: React.FC<{name: string}> = ({name}) =>
  name ? (
    <div
      style={{
        position: 'absolute',
        bottom: 132,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: MINIMAL_FONT_BOLD,
        fontWeight: 900,
        fontSize: 36,
        letterSpacing: '0.10em',
        color: '#ffffff',
        // 明るい背景でも飛ばないよう、影を二重に重ねる(装飾感は出さない)
        textShadow:
          '0 0 6px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.9), 0 0 18px rgba(0,0,0,0.6)',
      }}
    >
      {name}
    </div>
  ) : null;

const SceneView: React.FC<{scene: MinimalScene; startFrame: number}> = ({scene, startFrame}) => {
  const clips = scene.bgClips ?? (scene.bgVideo ? [scene.bgVideo] : []);
  const index =
    scene.role === 'rank' && scene.rank
      ? `第${scene.rank}位`
      : scene.role === 'point' && scene.num
        ? `${scene.num}`
        : null;
  return (
    <AbsoluteFill style={{backgroundColor: '#101010'}}>
      <CutBg
        clips={clips}
        startFrame={startFrame}
        washColor="#000000"
        wash={scene.bgWash ?? 0.12}
        local={scene.bgSync}
        sceneDuration={scene.durationInFrames}
      />
      {index ? <MinimalIndex label={index} /> : null}
      {scene.headline ? <MinimalTelop text={`**${scene.headline}**`} small /> : null}
      {!scene.headline ? <MinimalTelop text={scene.telop} /> : null}
      <Audio src={staticFile(scene.audio)} />
    </AbsoluteFill>
  );
};

export const MinimalVideo: React.FC<MinimalVideoProps> = ({account, bgm, bgmVolume, scenes}) => {
  const total = scenes.reduce((a, s) => a + s.durationInFrames, 0);
  let from = 0;
  return (
    <AbsoluteFill style={{backgroundColor: '#101010'}}>
      {scenes.map((scene, i) => {
        const seq = (
          <Sequence key={i} from={from} durationInFrames={scene.durationInFrames}>
            <SceneView scene={scene} startFrame={from} />
          </Sequence>
        );
        from += scene.durationInFrames;
        return seq;
      })}
      <MinimalAccount name={account} />
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
