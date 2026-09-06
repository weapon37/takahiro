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
import {CutBg, parseTelop} from './common';
import {PF, pfFont} from './portfolio_brand';

// ---------- 🎥横型ポートフォリオ(1920x1080・営業用) ----------
// 用途: 個人HP/商談で流す撮影実績の紹介。SNS投稿用の縦型3テンプレとは別系統。
// 構成: title(名乗り) → caption(領域紹介) → works(実績リスト) → spec(対応内容)
//       → stat(数字) → quote(信条) → contact(連絡先)
// テロップの **単語** はオレンジ強調になる(マーカーではなく文字色)。

// 書体は Noto Sans JP。public/fonts/NotoSansJP-*.ttf をシステムにインストールして使う
// (縦型テンプレの Zen Maru Gothic と同じ運用。@remotion/fonts での読み込みは
//  5MB×2のTTFがレンダリング中にロード完了せずタイムアウトしたため使わない)

export type PortfolioScene = {
  role: 'title' | 'caption' | 'works' | 'spec' | 'stat' | 'quote' | 'contact';
  headline?: string; // title/caption の大見出し
  sub?: string; // 見出しの上に置く小さいラベル
  telop?: string; // 画面下部の補足テロップ
  items?: string[]; // role='works' の実績リスト
  specs?: {label: string; desc: string; price?: string}[]; // role='spec' の対応領域カード
  stat?: {value: string; label: string}; // role='stat' の数字
  quote?: string; // role='quote' の一文
  contact?: {
    name: string;
    role?: string;
    url?: string;
    mail?: string;
    tel?: string;
    line?: string;
  };
  bgVideo?: string | null; // 単一背景(bgClips未指定時)
  bgClips?: string[]; // 背景クリップ群(カット割りで巡回)
  bgWash?: number; // 背景に被せる黒ウォッシュ(0〜1)
  audio?: string | null; // ナレーション。無音運用ならnull
  durationInFrames: number;
};

export type PortfolioVideoProps = {
  account: string; // 左上に出す屋号
  subtitle: string; // 屋号の下の肩書き
  bgm: string;
  bgmVolume: number;
  scenes: PortfolioScene[];
};

// 下から浮き上がるフェードイン。delayはフレーム数
const useRise = (delay: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 200}});
  return {
    opacity: s,
    transform: `translateY(${interpolate(s, [0, 1], [34, 0])}px)`,
  };
};

// 実写の上に文字を載せるための暗幕(左下から効かせる)
const Scrim: React.FC<{strength?: number}> = ({strength = 1}) => (
  <>
    <AbsoluteFill
      style={{
        background: `linear-gradient(100deg, rgba(8,14,11,${0.82 * strength}) 0%, rgba(8,14,11,${
          0.5 * strength
        }) 46%, rgba(8,14,11,${0.12 * strength}) 100%)`,
      }}
    />
    <AbsoluteFill
      style={{
        background: `linear-gradient(0deg, rgba(8,14,11,${0.78 * strength}) 0%, rgba(8,14,11,0) 42%)`,
      }}
    />
  </>
);

// **単語** をオレンジにするテキスト
const Rich: React.FC<{text: string}> = ({text}) => (
  <>
    {parseTelop(text).map((seg, i) =>
      seg.hl ? (
        <span key={i} style={{color: PF.accent}}>
          {seg.t}
        </span>
      ) : (
        <span key={i}>{seg.t}</span>
      )
    )}
  </>
);

// 見出しの上に置く小ラベル(オレンジの短い罫つき)
const Eyebrow: React.FC<{text: string; delay?: number}> = ({text, delay = 0}) => {
  const rise = useRise(delay);
  return (
    <div
      style={{
        ...rise,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        fontSize: 26,
        fontWeight: 500,
        letterSpacing: '0.28em',
        color: PF.sub,
      }}
    >
      <span style={{width: 56, height: 3, backgroundColor: PF.accent}} />
      {text}
    </div>
  );
};

// 左寄せの本体ブロック(全roleで共通の余白)
const Block: React.FC<{children: React.ReactNode; center?: boolean; wide?: boolean}> = ({
  children,
  center,
  wide,
}) => (
  <AbsoluteFill
    style={{
      padding: '0 140px',
      justifyContent: 'center',
      alignItems: center ? 'center' : 'flex-start',
      textAlign: center ? 'center' : 'left',
    }}
  >
    <div style={{maxWidth: wide ? 1640 : center ? 1500 : 1150, width: '100%'}}>{children}</div>
  </AbsoluteFill>
);

const Headline: React.FC<{text: string; delay?: number; size?: number}> = ({
  text,
  delay = 8,
  size = 92,
}) => {
  const rise = useRise(delay);
  return (
    <div
      style={{
        ...rise,
        marginTop: 26,
        fontSize: size,
        fontWeight: 900,
        lineHeight: 1.22,
        letterSpacing: '0.01em',
        color: PF.text,
        whiteSpace: 'pre-wrap',
        textShadow: '0 6px 28px rgba(0,0,0,0.55)',
      }}
    >
      <Rich text={text} />
    </div>
  );
};

// 画面下部の補足テロップ(全roleで共通)
const Telop: React.FC<{text: string; center?: boolean}> = ({text, center}) => {
  const rise = useRise(16);
  return (
    <div
      style={{
        ...rise,
        position: 'absolute',
        left: 140,
        right: 140,
        bottom: 92,
        textAlign: center ? 'center' : 'left',
        fontSize: 38,
        fontWeight: 500,
        lineHeight: 1.5,
        color: PF.sub,
        whiteSpace: 'pre-wrap',
        textShadow: '0 4px 18px rgba(0,0,0,0.6)',
      }}
    >
      <Rich text={text} />
    </div>
  );
};

// role='works': 実績を1行ずつ立ち上げる
const WorksList: React.FC<{items: string[]}> = ({items}) => (
  <div style={{display: 'flex', flexDirection: 'column', gap: 22, marginTop: 40}}>
    {items.map((item, i) => (
      <WorkRow key={item} text={item} delay={14 + i * 7} />
    ))}
  </div>
);

const WorkRow: React.FC<{text: string; delay: number}> = ({text, delay}) => {
  const rise = useRise(delay);
  return (
    <div style={{...rise, display: 'flex', alignItems: 'center', gap: 26}}>
      <span style={{width: 14, height: 14, backgroundColor: PF.accent, transform: 'rotate(45deg)'}} />
      <span
        style={{
          fontSize: 54,
          fontWeight: 900,
          color: PF.text,
          textShadow: '0 4px 18px rgba(0,0,0,0.6)',
        }}
      >
        {text}
      </span>
    </div>
  );
};

// role='spec': 対応領域を3カード横並び
const SpecCards: React.FC<{specs: NonNullable<PortfolioScene['specs']>}> = ({specs}) => (
  <div style={{display: 'flex', alignItems: 'stretch', gap: 28, marginTop: 44}}>
    {specs.map((s, i) => (
      <SpecCard key={s.label} spec={s} delay={14 + i * 9} />
    ))}
  </div>
);

const SpecCard: React.FC<{spec: {label: string; desc: string; price?: string}; delay: number}> = ({
  spec,
  delay,
}) => {
  const rise = useRise(delay);
  return (
    <div
      style={{
        ...rise,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 330,
        padding: '36px 34px',
        backgroundColor: 'rgba(10,17,14,0.62)',
        border: `1px solid ${PF.line}`,
        borderTopWidth: 4,
        borderTopColor: PF.accent,
      }}
    >
      <div style={{fontSize: 40, fontWeight: 900, color: PF.text, lineHeight: 1.25}}>{spec.label}</div>
      <div
        style={{
          flex: 1,
          marginTop: 16,
          fontSize: 27,
          fontWeight: 500,
          lineHeight: 1.5,
          color: PF.sub,
        }}
      >
        {spec.desc}
      </div>
      {spec.price ? (
        <div style={{marginTop: 24, fontSize: 32, fontWeight: 900, color: PF.accent}}>
          {spec.price}
        </div>
      ) : null}
    </div>
  );
};

// role='stat': 数字ドン
const Stat: React.FC<{stat: {value: string; label: string}}> = ({stat}) => {
  const rise = useRise(8);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - 8, fps, config: {damping: 14, mass: 0.7}});
  return (
    <div style={{...rise, marginTop: 24}}>
      <div
        style={{
          fontSize: 210,
          fontWeight: 900,
          lineHeight: 1,
          color: PF.accent,
          transform: `scale(${interpolate(pop, [0, 1], [0.86, 1])})`,
          transformOrigin: 'left center',
          textShadow: '0 8px 34px rgba(0,0,0,0.5)',
        }}
      >
        {stat.value}
      </div>
      <div style={{marginTop: 18, fontSize: 40, fontWeight: 500, color: PF.text}}>{stat.label}</div>
    </div>
  );
};

// role='quote': 信条を1文で
const Quote: React.FC<{text: string}> = ({text}) => {
  const rise = useRise(8);
  return (
    <div style={{...rise, textAlign: 'center'}}>
      <div style={{width: 90, height: 3, backgroundColor: PF.accent, margin: '0 auto 42px'}} />
      <div
        style={{
          fontSize: 76,
          fontWeight: 900,
          lineHeight: 1.5,
          color: PF.text,
          whiteSpace: 'pre-wrap',
          textShadow: '0 6px 28px rgba(0,0,0,0.6)',
        }}
      >
        <Rich text={text} />
      </div>
      <div style={{width: 90, height: 3, backgroundColor: PF.accent, margin: '42px auto 0'}} />
    </div>
  );
};

// role='contact': 締めの連絡先
const Contact: React.FC<{contact: NonNullable<PortfolioScene['contact']>}> = ({contact}) => {
  const rise = useRise(8);
  const rows = [contact.url, contact.mail, contact.tel, contact.line].filter(Boolean) as string[];
  return (
    <div style={{...rise, textAlign: 'center'}}>
      {contact.role ? (
        <div style={{fontSize: 30, fontWeight: 500, letterSpacing: '0.3em', color: PF.sub}}>
          {contact.role}
        </div>
      ) : null}
      <div style={{marginTop: 22, fontSize: 104, fontWeight: 900, color: PF.text}}>{contact.name}</div>
      <div style={{width: 120, height: 3, backgroundColor: PF.accent, margin: '40px auto'}} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        {rows.map((row) => (
          <div key={row} style={{fontSize: 40, fontWeight: 500, color: PF.sub}}>
            {row}
          </div>
        ))}
      </div>
    </div>
  );
};

// 左上の屋号(常時表示)
const BrandMark: React.FC<{account: string; subtitle: string}> = ({account, subtitle}) =>
  account ? (
    <div style={{position: 'absolute', left: 140, top: 96}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <span style={{width: 5, height: 42, backgroundColor: PF.accent}} />
        <span
          style={{
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: '0.16em',
            color: PF.text,
            textShadow: '0 4px 16px rgba(0,0,0,0.6)',
          }}
        >
          {account}
        </span>
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 10,
            marginLeft: 21,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '0.22em',
            color: PF.sub,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  ) : null;

const SceneView: React.FC<{scene: PortfolioScene; index: number}> = ({scene, index}) => {
  const clips = scene.bgClips ?? (scene.bgVideo ? [scene.bgVideo] : []);
  const centered = scene.role === 'quote' || scene.role === 'contact';
  const wide = scene.role === 'spec';
  return (
    <AbsoluteFill style={{backgroundColor: PF.base, fontFamily: pfFont}}>
      <CutBg clips={clips} seed={index} washColor={PF.base} wash={scene.bgWash} />
      <Scrim strength={centered ? 1.15 : 1} />
      <Block center={centered} wide={wide}>
        {scene.sub ? <Eyebrow text={scene.sub} /> : null}
        {scene.headline ? (
          <Headline text={scene.headline} size={scene.role === 'title' ? 116 : 92} />
        ) : null}
        {scene.role === 'works' && scene.items ? <WorksList items={scene.items} /> : null}
        {scene.role === 'spec' && scene.specs ? <SpecCards specs={scene.specs} /> : null}
        {scene.role === 'stat' && scene.stat ? <Stat stat={scene.stat} /> : null}
        {scene.role === 'quote' && scene.quote ? <Quote text={scene.quote} /> : null}
        {scene.role === 'contact' && scene.contact ? <Contact contact={scene.contact} /> : null}
      </Block>
      {scene.telop ? <Telop text={scene.telop} center={centered} /> : null}
      {scene.audio ? <Audio src={staticFile(scene.audio)} /> : null}
    </AbsoluteFill>
  );
};

export const PortfolioVideo: React.FC<PortfolioVideoProps> = ({
  account,
  subtitle,
  bgm,
  bgmVolume,
  scenes,
}) => {
  const total = scenes.reduce((a, s) => a + s.durationInFrames, 0);
  let from = 0;
  return (
    <AbsoluteFill style={{backgroundColor: PF.base, fontFamily: pfFont}}>
      {scenes.map((scene, i) => {
        const seq = (
          <Sequence key={i} from={from} durationInFrames={scene.durationInFrames}>
            <SceneView scene={scene} index={i} />
          </Sequence>
        );
        from += scene.durationInFrames;
        return seq;
      })}
      <BrandMark account={account} subtitle={subtitle} />
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
