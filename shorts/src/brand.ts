// ブランドトークン(チャンネルごとの色とマスコット)
// テンプレは全チャンネル共通。見た目の違いはこのファイルの定義だけで切り替わる。
//
// 使い方: 台本JSONに "brand": "home" を書くと、build_props_generic.mjs が
// propsへ引き継ぎ、テンプレが BrandContext 経由でその色を使う。
// 未指定なら "ai"(既定)。
import React from 'react';

export type Mascot = 'eraser' | 'house';

export type Brand = {
  primary: string; // 主役の面。順位札・パネル・箇条書きの番号
  accent: string; // マーカー強調・背景帯(明るい色を推奨)
  spark: string; // 実測数字・CTA・スタンプ(最も目を引く色)
  ink: string; // 本文・アウトライン・⚡テンプレの地色(暗い色)
  base: string; // 紙背景(明るい色)
  erase: string; // 打ち消し・消えかけ表現のグレー
  mascot: Mascot; // 画面に出るキャラ
  wipeCrumbs: boolean; // ワイプ遷移で消しカスを飛ばすか(消しゴム以外はfalse)
};

export const BRANDS = {
  // 「仕事が消えるAI帳」— 明るい文具系。アイコン(消しゴムキャラ8番)と同一パレット
  ai: {
    primary: '#2E6BD6', // キャラの青。順位札・枠
    accent: '#F7CE46', // 黄。マーカー強調・背景帯
    spark: '#F0862E', // オレンジ。実測数字・CTA
    ink: '#1E3A8A', // ネイビー。本文・アウトライン
    base: '#F7F4EE', // オフホワイト。紙背景
    erase: '#B8B8B8', // 消えかけ表現のグレー
    mascot: 'eraser',
    wipeCrumbs: true,
  },
  // 引っ越し・住宅系(部屋探し/内見)— 深緑×テラコッタ×生成り。不動産・インテリアの定番トーン
  home: {
    primary: '#2F7A63', // 深いグリーン。順位札・枠
    accent: '#F6D48C', // サンド。マーカー強調・背景帯
    spark: '#E2603C', // テラコッタ。金額・CTA
    ink: '#24463C', // 深緑インク。本文・アウトライン
    base: '#FAF5EC', // 生成りの壁色。紙背景
    erase: '#B9B3A8', // 温かみのあるグレー
    mascot: 'house',
    wipeCrumbs: false, // お家キャラは「消す」キャラではないのでカスを出さない
  },
} as const satisfies Record<string, Brand>;

export type BrandKey = keyof typeof BRANDS;

export const DEFAULT_BRAND: BrandKey = 'ai';

// props の brand 文字列を実体に解決する(未知のキーは既定へフォールバック)
export const resolveBrand = (key?: string): Brand =>
  (key && key in BRANDS ? BRANDS[key as BrandKey] : BRANDS[DEFAULT_BRAND]) as Brand;

// 後方互換: brand未指定の既存propsやレガシーテンプレ(ShortVideo)はこれを見る
export const BRAND: Brand = BRANDS[DEFAULT_BRAND];

export const BrandContext = React.createContext<Brand>(BRAND);

// テンプレ内の各部品はこれで色を取る(BRAND直参照はしない)
export const useBrand = (): Brand => React.useContext(BrandContext);

export const fontFamily =
  "'Zen Maru Gothic', 'Zen Maru Gothic Black', 'IPAPGothic', sans-serif";
