/**
 * 動画全体で共有するデザイントークン。
 * 色やフォントを変えたいときは基本的にこのファイルだけを触れば済むようにしている。
 */

export type Theme = {
  /** 背景グラデーションの2色 */
  backdrop: [string, string];
  /** 背景で動くブロブ(ぼかした光)の色 */
  blobs: [string, string];
  /** 主役のアクセントカラー */
  accent: string;
  /** 補助のアクセントカラー */
  accentAlt: string;
  /** 本文テキスト */
  text: string;
  /** 補足テキスト */
  muted: string;
  /** カードの背景 */
  surface: string;
  /** カードの枠線 */
  border: string;
};

export const themes = {
  midnight: {
    backdrop: ["#070B18", "#141B3D"],
    blobs: ["#4C1D95", "#0E7490"],
    accent: "#7DD3FC",
    accentAlt: "#C4B5FD",
    text: "#F8FAFC",
    muted: "#9AA7BD",
    surface: "rgba(255, 255, 255, 0.07)",
    border: "rgba(255, 255, 255, 0.14)",
  },
  sunrise: {
    backdrop: ["#1A0B12", "#3B1220"],
    blobs: ["#BE123C", "#B45309"],
    accent: "#FDBA74",
    accentAlt: "#FDA4AF",
    text: "#FFF7ED",
    muted: "#D6BBA8",
    surface: "rgba(255, 255, 255, 0.08)",
    border: "rgba(255, 255, 255, 0.16)",
  },
  forest: {
    backdrop: ["#04140F", "#0B2A22"],
    blobs: ["#047857", "#0F766E"],
    accent: "#6EE7B7",
    accentAlt: "#A7F3D0",
    text: "#ECFDF5",
    muted: "#93B8AB",
    surface: "rgba(255, 255, 255, 0.07)",
    border: "rgba(255, 255, 255, 0.15)",
  },
} as const satisfies Record<string, Theme>;

export type ThemeName = keyof typeof themes;

export const themeNames = Object.keys(themes) as [ThemeName, ...ThemeName[]];

export const getTheme = (name: ThemeName): Theme => themes[name];
