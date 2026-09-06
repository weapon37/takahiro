// 横型ポートフォリオ(営業用)のデザイントークン
// 参考: 本人HP https://www.trailmotion.jp/ (OUTDOOR MOVIE CAMERAMAN / 上杉 隆寛)
// 自然風景の実写を主役にするため、UIは黒×白×朝焼けオレンジの3色に絞る。
export const PF = {
  base: '#0C1310', // 深い森の黒。レターボックス・下地
  text: '#FFFFFF', // 見出し
  sub: '#C7D0CA', // 補足テキスト
  accent: '#E8763A', // 朝焼けのオレンジ。数字・強調・罫
  line: 'rgba(255,255,255,0.28)', // 細い区切り線
} as const;

// Noto Sans JP(public/fonts に同梱)。ゴシックの直線的な字面で業務用トーンに寄せる
export const pfFont = "'Noto Sans JP', 'Zen Maru Gothic', 'IPAPGothic', sans-serif";
