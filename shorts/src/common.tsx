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

// 背景カット: 動画全体を約2秒ごとに切り替え(1本40秒で約20カット)。
// カット番号は動画通し(startFrame=シーン開始位置)で数えるので、クリップ本数 ≥ 総カット数 なら
// 動画内で同じ映像が2回出ない。ズームはカットごとにリセットして"編集感"を出す。
const CUT_FRAMES = 60;

export const CutBg: React.FC<{
  clips: string[];
  seed?: number; // 後方互換(未使用)
  startFrame?: number; // このシーンの動画内での開始フレーム
  washColor: string;
  wash?: number; // 0=素の映像
  local?: boolean; // true=内容シンクロ(このシーンの clips をシーン内で順に表示)
  sceneDuration?: number; // local時: シーン尺(フレーム)を clips 本数で均等割り
}> = ({clips, startFrame = 0, washColor, wash = 0, local = false, sceneDuration}) => {
  const frame = useCurrentFrame();
  if (clips.length === 0) return null;

  let idx: number;
  let cutKey: number;
  let scale: number;

  if (local) {
    // 内容シンクロ背景: このシーンの尺を clips 本数で均等割りし、割り当てた映像を順に表示。
    // 1本なら丸ごと1カット、複数なら区間で切替。プール巡回(通しカット)ではないので
    // 「話している内容に合う映像」を文ごとに固定できる。ズームは区間内で滑らかに継続。
    const dur =
      sceneDuration && sceneDuration > 0 ? sceneDuration : CUT_FRAMES * clips.length;
    const seg = dur / clips.length;
    const i = Math.min(clips.length - 1, Math.floor(frame / seg));
    const t = seg > 0 ? (frame - i * seg) / seg : 0; // 区間内進行度 0..1
    idx = i;
    cutKey = i;
    scale = i % 2 === 0 ? 1 + 0.08 * t : 1.08 - 0.08 * t;
  } else {
    // 従来: 動画通しで約2秒ごとにプールを巡回(本数 ≥ 総カット数なら重複なし)
    const g = startFrame + frame;
    const cut = Math.floor(g / CUT_FRAMES);
    const localF = g - cut * CUT_FRAMES;
    idx = cut % clips.length;
    cutKey = cut;
    const zoomIn = cut % 2 === 0;
    scale = interpolate(localF, [0, CUT_FRAMES], zoomIn ? [1, 1.09] : [1.09, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  return (
    <>
      <AbsoluteFill style={{transform: `scale(${scale})`}}>
        <OffthreadVideo
          key={cutKey}
          src={staticFile(clips[idx])}
          muted
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </AbsoluteFill>
      {wash ? <AbsoluteFill style={{backgroundColor: washColor, opacity: wash}} /> : null}
    </>
  );
};

// 2文字以上でひとかたまりの語(接続助詞など)。この内部で改行させると
// 「任せる。で / も丸投げはNG」のように不自然に割れるため、候補を取り消す。
const NO_SPLIT = [
  'でも', 'ても', 'では', 'でし', 'ては', 'とは', 'とも', 'にも', 'には', 'にて',
  'かも', 'から', 'ので', 'のに', 'けど', 'まで', 'より', 'など', 'だけ', 'ながら',
  'ながり', 'とき', 'とこ', 'とし', 'とっ', 'でき', 'でる', 'とる', 'はず', 'はじ',
  'がち', 'がら', 'もの', 'もう', 'もし', 'よう', 'よく', 'ような', 'かし', 'かっ',
];

// 日本語テロップの改行位置調整: 助詞・記号の直後にだけ改行候補(ゼロ幅スペース)を挿入。
// これと word-break:keep-all を併用すると、単語の途中では改行されなくなる。
export const softBreaks = (t: string): string => {
  // 長音符「ー」は入れない(カタカナ語の内部なので「エー|ジェント」と割れてしまう)
  let s = t.replace(/([をはがにへとでもやかねよ、。・！？＋／」』）】〜])/g, '$1​');
  // ひとかたまりの語の内部に入ってしまった改行候補を取り消す
  for (const w of NO_SPLIT) {
    s = s.split(`${w[0]}​${w[1]}`).join(w);
  }
  return s;
};

// テロップの折り返し安全策。
// ハイライト(whiteSpace:nowrap)と地の文の境目には改行候補が無く、日本語は keep-all のため
// 「**無料版で十分**な人の特徴」が一続きの塊になり画面外へはみ出す。
// → 描画側で区切りにゼロ幅スペースを挟む(TELOP_SEP)ことで、ハイライトの直後で改行できる。
export const TELOP_SEP = '​';

// 全角1文字あたりの実測幅は約0.97em(9文字×112px が 980px にちょうど収まる)
const runWidth = (s: string): number =>
  [...s].reduce((a, c) => a + (/[\x20-\x7e]/.test(c) ? 0.55 : 0.97), 0);

const maxRun = (runs: string[]): number => Math.max(0, ...runs.map(runWidth));

// 境目を繋いだままの改行候補(=区切りを入れない場合の折り返し挙動)
const runsJoined = (text: string): string[] =>
  parseTelop(text)
    .map((seg) => (seg.hl ? seg.t : softBreaks(seg.t)))
    .join('')
    .split(TELOP_SEP);

// 境目でも切れる場合の改行候補
const runsSplit = (text: string): string[] =>
  parseTelop(text).flatMap((seg) => (seg.hl ? [seg.t] : softBreaks(seg.t).split(TELOP_SEP)));

// テロップの折り返し方針を決める。
// (1) そのままで収まるなら何もしない(既存の見た目を変えない)
// (2) 収まらないなら境目に改行候補を入れて折り返す
// (3) それでも収まらないなら文字サイズを落とす
export const telopLayout = (
  text: string,
  base: number,
  boxWidth: number
): {sep: boolean; fontSize: number} => {
  if (maxRun(runsJoined(text)) * base <= boxWidth) return {sep: false, fontSize: base};
  const split = maxRun(runsSplit(text));
  if (split * base <= boxWidth) return {sep: true, fontSize: base};
  return {sep: true, fontSize: Math.floor(boxWidth / Math.max(0.1, split))};
};

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
