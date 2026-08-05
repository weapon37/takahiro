import { loadFont } from "@remotion/google-fonts/NotoSansJP";

/**
 * 日本語フォントの読み込み。
 * Remotion 側で delayRender が自動的に張られるので、レンダリングは
 * フォントの読み込みが終わるまで待ってくれる。
 *
 * 別のフォントに差し替えたい場合は import 元を
 * `@remotion/google-fonts/<FontName>` に変えるだけでよい。
 */
const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "900"],
  subsets: ["japanese", "latin"],
  // 日本語フォントは Google 側で 100 以上のチャンクに分割配信されているため
  // リクエスト数が多いのは正常。警告だけ黙らせる。
  ignoreTooManyRequestsWarning: true,
});

/** Google Fonts が読めない環境でも日本語が豆腐にならないようフォールバックを足す */
export const FONT_FAMILY = [
  fontFamily,
  '"Hiragino Sans"',
  '"Hiragino Kaku Gothic ProN"',
  '"Yu Gothic"',
  '"IPAGothic"',
  '"Noto Sans CJK JP"',
  "sans-serif",
].join(", ");
