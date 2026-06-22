import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type {
  AffiliateLink,
  AnalyticsSnapshot,
  Post,
  ResearchItem,
  ScheduledPost,
} from "./pipeline-types";

// MVP用のファイルベース永続化。単一インスタンス・低頻度アクセスを前提とした
// 簡易実装で、本番でサーバーレスや複数インスタンス運用に移る際はDBに置き換える。
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "pipeline-store.json");

interface StoreData {
  posts: Post[];
  scheduledPosts: ScheduledPost[];
  affiliateLinks: AffiliateLink[];
  analyticsSnapshots: AnalyticsSnapshot[];
  researchItems: ResearchItem[];
}

async function readStore(): Promise<StoreData> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    const data = JSON.parse(raw) as Partial<StoreData>;
    return {
      posts: data.posts ?? [],
      scheduledPosts: data.scheduledPosts ?? [],
      affiliateLinks: data.affiliateLinks ?? [],
      analyticsSnapshots: data.analyticsSnapshots ?? [],
      researchItems: data.researchItems ?? [],
    };
  } catch {
    return {
      posts: [],
      scheduledPosts: [],
      affiliateLinks: [],
      analyticsSnapshots: [],
      researchItems: [],
    };
  }
}

async function writeStore(data: StoreData): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function savePost(post: Post): Promise<void> {
  const data = await readStore();
  const index = data.posts.findIndex((p) => p.id === post.id);
  if (index >= 0) data.posts[index] = post;
  else data.posts.push(post);
  await writeStore(data);
}

export async function createScheduledPost(
  input: Pick<ScheduledPost, "postId" | "platform" | "scheduledAt">,
): Promise<ScheduledPost> {
  const data = await readStore();
  const scheduledPost: ScheduledPost = {
    id: crypto.randomUUID(),
    postId: input.postId,
    platform: input.platform,
    scheduledAt: input.scheduledAt,
    status: "pending_approval",
  };
  data.scheduledPosts.push(scheduledPost);
  await writeStore(data);
  return scheduledPost;
}

export async function listScheduledPosts(
  status?: ScheduledPost["status"],
): Promise<(ScheduledPost & { post?: Post })[]> {
  const data = await readStore();
  return data.scheduledPosts
    .filter((sp) => !status || sp.status === status)
    .map((sp) => ({ ...sp, post: data.posts.find((p) => p.id === sp.postId) }))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function approveScheduledPost(
  id: string,
  approvedBy?: string,
): Promise<ScheduledPost | undefined> {
  const data = await readStore();
  const scheduledPost = data.scheduledPosts.find((sp) => sp.id === id);
  if (!scheduledPost || scheduledPost.status !== "pending_approval") {
    return undefined;
  }
  scheduledPost.status = "scheduled";
  scheduledPost.approvedAt = new Date().toISOString();
  scheduledPost.approvedBy = approvedBy;
  await writeStore(data);
  return scheduledPost;
}

export async function getDueScheduledPosts(
  now: Date,
): Promise<(ScheduledPost & { post?: Post })[]> {
  const data = await readStore();
  return data.scheduledPosts
    .filter(
      (sp) => sp.status === "scheduled" && new Date(sp.scheduledAt) <= now,
    )
    .map((sp) => ({ ...sp, post: data.posts.find((p) => p.id === sp.postId) }));
}

export async function markScheduledPostResult(
  id: string,
  result: "posted" | "failed",
  platformPostId?: string,
): Promise<void> {
  const data = await readStore();
  const scheduledPost = data.scheduledPosts.find((sp) => sp.id === id);
  if (!scheduledPost) return;
  scheduledPost.status = result;
  if (platformPostId) scheduledPost.platformPostId = platformPostId;
  await writeStore(data);
}

export async function addAffiliateLink(
  input: Omit<AffiliateLink, "id">,
): Promise<AffiliateLink> {
  const data = await readStore();
  const affiliateLink: AffiliateLink = { id: crypto.randomUUID(), ...input };
  data.affiliateLinks.push(affiliateLink);
  await writeStore(data);
  return affiliateLink;
}

export async function listAffiliateLinks(): Promise<AffiliateLink[]> {
  const data = await readStore();
  return data.affiliateLinks;
}

export async function getAffiliateLink(
  id: string,
): Promise<AffiliateLink | undefined> {
  const data = await readStore();
  return data.affiliateLinks.find((link) => link.id === id);
}

// ① リサーチ: 競合・伸びてる投稿から収集したネタの永続化
export async function addResearchItem(
  input: Omit<ResearchItem, "id" | "capturedAt" | "status">,
): Promise<ResearchItem> {
  const data = await readStore();
  const researchItem: ResearchItem = {
    id: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    status: "new",
    ...input,
  };
  data.researchItems.push(researchItem);
  await writeStore(data);
  return researchItem;
}

export async function listResearchItems(
  status?: ResearchItem["status"],
): Promise<ResearchItem[]> {
  const data = await readStore();
  return data.researchItems
    .filter((item) => !status || item.status === status)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export async function getResearchItemsByIds(
  ids: string[],
): Promise<ResearchItem[]> {
  const data = await readStore();
  return data.researchItems.filter((item) => ids.includes(item.id));
}

export async function markResearchItemStatus(
  id: string,
  status: ResearchItem["status"],
): Promise<void> {
  const data = await readStore();
  const researchItem = data.researchItems.find((item) => item.id === id);
  if (!researchItem) return;
  researchItem.status = status;
  await writeStore(data);
}

// ⑧ 分析・改善: 投稿済みで分析取得対象になるもの一覧
export async function listPostedScheduledPosts(): Promise<
  (ScheduledPost & { post?: Post })[]
> {
  const data = await readStore();
  return data.scheduledPosts
    .filter((sp) => sp.status === "posted" && sp.platformPostId)
    .map((sp) => ({ ...sp, post: data.posts.find((p) => p.id === sp.postId) }));
}

export async function addAnalyticsSnapshot(
  input: Omit<AnalyticsSnapshot, "id" | "collectedAt">,
): Promise<AnalyticsSnapshot> {
  const data = await readStore();
  const snapshot: AnalyticsSnapshot = {
    id: crypto.randomUUID(),
    collectedAt: new Date().toISOString(),
    ...input,
  };
  data.analyticsSnapshots.push(snapshot);
  await writeStore(data);
  return snapshot;
}

export async function listAnalyticsSnapshots(): Promise<AnalyticsSnapshot[]> {
  const data = await readStore();
  return data.analyticsSnapshots;
}

export async function listPostedScheduledPostsWithLatestSnapshot(): Promise<
  (ScheduledPost & { post?: Post; latestSnapshot?: AnalyticsSnapshot })[]
> {
  const data = await readStore();
  const latestByScheduledPostId = new Map<string, AnalyticsSnapshot>();
  for (const snapshot of data.analyticsSnapshots) {
    const existing = latestByScheduledPostId.get(snapshot.scheduledPostId);
    if (!existing || existing.collectedAt < snapshot.collectedAt) {
      latestByScheduledPostId.set(snapshot.scheduledPostId, snapshot);
    }
  }
  return data.scheduledPosts
    .filter((sp) => sp.status === "posted")
    .map((sp) => ({
      ...sp,
      post: data.posts.find((p) => p.id === sp.postId),
      latestSnapshot: latestByScheduledPostId.get(sp.id),
    }))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}

interface PerformanceBreakdownRow {
  key: string;
  postCount: number;
  avgEngagementRate: number;
}

export interface PerformanceSummary {
  byPostType: PerformanceBreakdownRow[];
  byHookType: PerformanceBreakdownRow[];
  byStructure: PerformanceBreakdownRow[];
}

// 投稿ごとの最新スナップショットを使い、型(postType/hookType/structure)別の
// 平均エンゲージメント率(likes+comments+shares ÷ impressions)を集計する。
// ②③のテーマ・フック選定プロンプトに「過去データで伸びている型」を渡すための
// 簡易な改善ループ用ロジック。
export async function getPerformanceSummary(): Promise<PerformanceSummary> {
  const data = await readStore();

  const latestSnapshotByScheduledPostId = new Map<string, AnalyticsSnapshot>();
  for (const snapshot of data.analyticsSnapshots) {
    const existing = latestSnapshotByScheduledPostId.get(snapshot.scheduledPostId);
    if (!existing || existing.collectedAt < snapshot.collectedAt) {
      latestSnapshotByScheduledPostId.set(snapshot.scheduledPostId, snapshot);
    }
  }

  function aggregateBy(
    keyOf: (post: Post) => string | undefined,
  ): PerformanceBreakdownRow[] {
    const totals = new Map<string, { sum: number; count: number }>();
    for (const scheduledPost of data.scheduledPosts) {
      const snapshot = latestSnapshotByScheduledPostId.get(scheduledPost.id);
      if (!snapshot || snapshot.impressions <= 0) continue;
      const post = data.posts.find((p) => p.id === scheduledPost.postId);
      const key = post && keyOf(post);
      if (!key) continue;
      const engagementRate =
        (snapshot.likes + snapshot.comments + snapshot.shares) /
        snapshot.impressions;
      const current = totals.get(key) ?? { sum: 0, count: 0 };
      current.sum += engagementRate;
      current.count += 1;
      totals.set(key, current);
    }
    return Array.from(totals.entries())
      .map(([key, { sum, count }]) => ({
        key,
        postCount: count,
        avgEngagementRate: sum / count,
      }))
      .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
  }

  return {
    byPostType: aggregateBy((post) => post.postTypeId),
    byHookType: aggregateBy((post) => post.hookTypeId),
    byStructure: aggregateBy((post) => post.structureId),
  };
}
