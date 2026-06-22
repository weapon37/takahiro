import type { PostTypeId } from "./post-types";

export type Platform = "x" | "threads" | "instagram" | "youtube";

// ① リサーチ: 競合・伸びてる投稿から収集したネタ
export type ResearchItem = {
  id: string;
  platform: Platform;
  sourceUrl: string;
  sourceAuthor: string;
  summary: string;
  postTypeId?: PostTypeId;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
  capturedAt: string;
  status: "new" | "used" | "archived";
};

// ② テーマ選定: ネタ・型・切り口をまとめて決定した結果
export type Theme = {
  id: string;
  researchItemId?: string;
  title: string;
  angle: string;
  postTypeId: PostTypeId;
  affiliateLinkId?: string;
  selectedAt: string;
  duplicateCheckNote?: string;
};

// 口調・トーンのアカウント固有ナレッジ
export type AccountProfile = {
  id: string;
  name: string;
  toneDescription: string;
  sampleHooks: string[];
};

export type PostStatus =
  | "draft"
  | "fact_checked"
  | "quality_checked"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "posted"
  | "rejected";

// ③ ポスト生成: フック→本文の順で組み立てた投稿
export type Post = {
  id: string;
  themeId: string;
  accountId: string;
  hook: string;
  body: string;
  postTypeId: PostTypeId;
  revision: number;
  status: PostStatus;
};

// ④ ファクトチェック: 数字・固有名詞の修正結果
export type FactCheckResult = {
  id: string;
  postId: string;
  issues: { original: string; corrected: string; reason: string }[];
  checkedAt: string;
};

// ⑤ 品質チェック: 基準未達なら書き直しに戻す採点結果
export type QualityCheckResult = {
  id: string;
  postId: string;
  score: number;
  passed: boolean;
  criteria: {
    hookStrength: number;
    sentenceVariety: number;
    depth: number;
  };
  feedback: string;
  checkedAt: string;
};

// ⑥ 自動投稿: 人の承認を経て予約されたポスト
export type ScheduledPost = {
  id: string;
  postId: string;
  platform: Platform;
  scheduledAt: string;
  approvedBy?: string;
  approvedAt?: string;
  status: "pending_approval" | "scheduled" | "posted" | "failed";
};

// ⑦ 自動で販売: テーマに紐づけるアフィリエイトリンク
export type AffiliateLink = {
  id: string;
  productName: string;
  platform: "rakuten";
  url: string;
  tags: string[];
};

// ⑧ 分析・改善: 投稿ごとのエンゲージメント結果
export type AnalyticsSnapshot = {
  id: string;
  scheduledPostId: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks?: number;
  collectedAt: string;
};
