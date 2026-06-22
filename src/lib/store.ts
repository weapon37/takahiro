import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { Post, ScheduledPost } from "./pipeline-types";

// MVP用のファイルベース永続化。単一インスタンス・低頻度アクセスを前提とした
// 簡易実装で、本番でサーバーレスや複数インスタンス運用に移る際はDBに置き換える。
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "pipeline-store.json");

interface StoreData {
  posts: Post[];
  scheduledPosts: ScheduledPost[];
}

async function readStore(): Promise<StoreData> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as StoreData;
  } catch {
    return { posts: [], scheduledPosts: [] };
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
): Promise<void> {
  const data = await readStore();
  const scheduledPost = data.scheduledPosts.find((sp) => sp.id === id);
  if (!scheduledPost) return;
  scheduledPost.status = result;
  await writeStore(data);
}
