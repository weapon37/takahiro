"use client";

import { useState } from "react";
import type { Post, ScheduledPost } from "@/lib/pipeline-types";

type ScheduledPostWithPost = ScheduledPost & { post?: Post };

const STATUS_LABEL: Record<ScheduledPost["status"], string> = {
  pending_approval: "承認待ち",
  scheduled: "予約済み",
  posted: "投稿済み",
  failed: "失敗",
};

export default function ApprovalsBoard({
  initialScheduledPosts,
}: {
  initialScheduledPosts: ScheduledPostWithPost[];
}) {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPostWithPost[]>(
    initialScheduledPosts,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/scheduled-posts");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "一覧の取得に失敗しました。");
      setScheduledPosts(data.scheduledPosts as ScheduledPostWithPost[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "一覧の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setApprovingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/scheduled-posts/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "承認に失敗しました。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました。");
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="self-start rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "更新中..." : "再読み込み"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {scheduledPosts.length === 0 && !isLoading && (
        <p className="text-sm text-gray-500">予約投稿はまだありません。</p>
      )}

      <div className="flex flex-col gap-4">
        {scheduledPosts.map((sp) => (
          <div key={sp.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">
                {sp.platform} / {new Date(sp.scheduledAt).toLocaleString("ja-JP")}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  sp.status === "posted"
                    ? "bg-green-100 text-green-700"
                    : sp.status === "failed"
                      ? "bg-red-100 text-red-700"
                      : sp.status === "scheduled"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                }`}
              >
                {STATUS_LABEL[sp.status]}
              </span>
            </div>

            {sp.post && (
              <div className="text-sm text-gray-700">
                <p className="font-semibold text-gray-900">{sp.post.hook}</p>
                <p className="mt-1 whitespace-pre-wrap">{sp.post.body}</p>
              </div>
            )}

            {sp.status === "pending_approval" && (
              <button
                type="button"
                onClick={() => handleApprove(sp.id)}
                disabled={approvingId === sp.id}
                className="mt-2 self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {approvingId === sp.id ? "承認中..." : "承認して予約する"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
