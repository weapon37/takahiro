"use client";

import { useState } from "react";
import type { MetricEntry } from "@/lib/types";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const FIELD_LABELS: Record<
  "impressions" | "likes" | "reposts" | "replies" | "followerCount",
  string
> = {
  impressions: "インプレッション",
  likes: "いいね",
  reposts: "リポスト",
  replies: "リプライ",
  followerCount: "フォロワー数(累計)",
};

interface MetricsFormProps {
  initialEntries: MetricEntry[];
}

export default function MetricsForm({ initialEntries }: MetricsFormProps) {
  const [recordedDate, setRecordedDate] = useState(todayStr());
  const [impressions, setImpressions] = useState("");
  const [likes, setLikes] = useState("");
  const [reposts, setReposts] = useState("");
  const [replies, setReplies] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entries, setEntries] = useState<MetricEntry[]>(initialEntries);
  const [isLoading, setIsLoading] = useState(false);

  async function loadEntries() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/metrics");
      const data = await res.json();
      if (res.ok) setEntries(data.items as MetricEntry[]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordedDate,
          impressions,
          likes,
          reposts,
          replies,
          followerCount,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存に失敗しました。");
      setImpressions("");
      setLikes("");
      setReposts("");
      setReplies("");
      setFollowerCount("");
      setNotes("");
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
          記録日
          <input
            type="date"
            value={recordedDate}
            onChange={(e) => setRecordedDate(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
          />
        </label>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {(
            [
              ["impressions", impressions, setImpressions],
              ["likes", likes, setLikes],
              ["reposts", reposts, setReposts],
              ["replies", replies, setReplies],
              ["followerCount", followerCount, setFollowerCount],
            ] as const
          ).map(([key, value, setter]) => (
            <label key={key} className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
              {FIELD_LABELS[key]}
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
              />
            </label>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
          メモ
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
            placeholder="気づいたことがあれば"
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="self-start rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
        >
          {isSaving ? "保存中..." : "記録する"}
        </button>

        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          記録履歴 {isLoading && <span className="text-xs text-gray-400">(読み込み中...)</span>}
        </h2>
        {entries.length === 0 && !isLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">まだ記録がありません。</p>
        )}
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2">日付</th>
                <th className="px-3 py-2">Imp</th>
                <th className="px-3 py-2">いいね</th>
                <th className="px-3 py-2">RP</th>
                <th className="px-3 py-2">返信</th>
                <th className="px-3 py-2">フォロワー</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{e.recordedDate}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.impressions ?? "-"}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.likes ?? "-"}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.reposts ?? "-"}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.replies ?? "-"}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.followerCount ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
