"use client";

import { useState } from "react";
import type { PostSnapshot } from "@/lib/types";

interface AnalyticsViewProps {
  initialItems: PostSnapshot[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AnalyticsView({ initialItems }: AnalyticsViewProps) {
  const [items, setItems] = useState<PostSnapshot[]>(initialItems);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadItems() {
    const res = await fetch("/api/analytics");
    const data = await res.json();
    if (res.ok) setItems(data.items as PostSnapshot[]);
  }

  async function handleSync() {
    setIsSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/analytics/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "取得に失敗しました。");
      setMessage(`最新の投稿${data.fetched}件を取得しました。`);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          毎日自動で更新されます。今すぐ最新化したい場合はこちら。
        </p>
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
        >
          {isSyncing ? "取得中..." : "今すぐ取得"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {message}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          まだデータがありません。「今すぐ取得」を押すか、翌日の自動更新をお待ちください。
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{formatDate(item.postedAt)}</span>
                <span>更新: {formatDate(item.fetchedAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-100">
                {item.content}
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
                <span>表示 {item.impressions ?? "-"}</span>
                <span>いいね {item.likes ?? "-"}</span>
                <span>RP {item.reposts ?? "-"}</span>
                <span>返信 {item.replies ?? "-"}</span>
                <span>引用 {item.quotes ?? "-"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
