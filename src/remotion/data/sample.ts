import type { ShortVideoProps } from "../schema";

/**
 * 各コンポジションの初期値。
 * Remotion Studio 右ペインの「Props」から編集でき、
 * 保存すればこのファイルに書き戻せる。
 */
export const sampleShortVideo: ShortVideoProps = {
  theme: "midnight",
  hook: {
    badge: "AI副業",
    title: "月5万円を\nAIで作る手順",
    subtitle: "特別なスキルは要りません。\n必要なのは3つの型だけ。",
  },
  points: [
    {
      label: "STEP 01",
      title: "売るものを\n決めない",
      body: "最初に商品を作るから止まる。\n先に「困っている人」を1人だけ決める。",
    },
    {
      label: "STEP 02",
      title: "AIに\n下書きさせる",
      body: "ゼロから書かない。\n骨組みをAIに出させて、体験談だけ自分で足す。",
    },
    {
      label: "STEP 03",
      title: "30日\n毎日出す",
      body: "質は後から付いてくる。\n先に量を出した人だけがデータを持てる。",
    },
  ],
  outro: {
    message: "今日の1投稿が\n30日後の収入になる",
    cta: "保存してやってみる",
    handle: "@your_account",
  },
  timing: {
    hookInSeconds: 3.5,
    pointInSeconds: 4,
    outroInSeconds: 3.5,
  },
};
