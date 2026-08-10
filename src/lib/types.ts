export type QueueStatus = "draft" | "approved" | "posted" | "failed" | "skipped";
export type PlanScope = "long" | "mid";
export type PostPurpose =
  | "value"
  | "engagement"
  | "relatability"
  | "story"
  | "proof";

export const PURPOSE_IDS: [PostPurpose, ...PostPurpose[]] = [
  "value",
  "engagement",
  "relatability",
  "story",
  "proof",
];

export const PURPOSE_LABELS: Record<PostPurpose, string> = {
  value: "ノウハウ・価値提供",
  engagement: "質問・アンケートで絡みを作る",
  relatability: "共感・あるある",
  story: "体験談・ストーリー",
  proof: "実績・成果報告",
};

export interface PlanTheme {
  id: number;
  scope: PlanScope;
  periodStart: string;
  periodEnd: string;
  theme: string;
  notes: string | null;
  createdAt: string;
}

export interface QueueItem {
  id: number;
  scheduledDate: string;
  typeId: string;
  purpose: PostPurpose;
  content: string;
  status: QueueStatus;
  xPostId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetricEntry {
  id: number;
  recordedDate: string;
  impressions: number | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  followerCount: number | null;
  notes: string | null;
  createdAt: string;
}
