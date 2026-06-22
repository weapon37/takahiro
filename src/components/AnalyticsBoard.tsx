"use client";

import { useState } from "react";
import type { PerformanceSummary } from "@/lib/store";
import { POST_TYPES } from "@/lib/post-types";
import { HOOK_TYPES } from "@/lib/hook-types";
import { POST_STRUCTURES } from "@/lib/post-structures";
import type { AnalyticsSnapshot, Post, ScheduledPost } from "@/lib/pipeline-types";

type PostedScheduledPost = ScheduledPost & {
  post?: Post;
  latestSnapshot?: AnalyticsSnapshot;
};

function buildLabelMap(defs: { id: string; label: string }[]): Map<string, string> {
  return new Map(defs.map((d) => [d.id, d.label]));
}

const POST_TYPE_LABELS = buildLabelMap(POST_TYPES);
const HOOK_TYPE_LABELS = buildLabelMap(HOOK_TYPES);
const STRUCTURE_LABELS = buildLabelMap(POST_STRUCTURES);

function BreakdownTable({
  title,
  rows,
  labels,
}: {
  title: string;
  rows: PerformanceSummary["byPostType"];
  labels: Map<string, string>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold text-gray-800">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">まだ分析データがありません。</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1">型</th>
              <th className="py-1">平均エンゲージメント率</th>
              <th className="py-1">実績件数</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-gray-100">
                <td className="py-1.5 text-gray-900">{labels.get(row.key) ?? row.key}</td>
                <td className="py-1.5 text-gray-700">
                  {(row.avgEngagementRate * 100).toFixed(1)}%
                </td>
                <td className="py-1.5 text-gray-500">{row.postCount}件</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AnalyticsBoard({
  initialSummary,
  initialPostedScheduledPosts,
}: {
  initialSummary: PerformanceSummary;
  initialPostedScheduledPosts: PostedScheduledPost[];
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [postedScheduledPosts, setPostedScheduledPosts] = useState(
    initialPostedScheduledPosts,
  );
  const [isCollecting, setIsCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCollect() {
    setIsCollecting(true);
    setError(null);
    setMessage(null);
    try {
      const collectResponse = await fetch("/api/cron/collect-analytics", {
        method: "POST",
      });
      const collectData = await collectResponse.json();
      if (!collectResponse.ok) {
        throw new Error(collectData.error || "分析データの取得に失敗しました。");
      }
      setMessage(
        `${collectData.collected.length}件のデータを取得しました(失敗: ${collectData.failed.length}件)。`,
      );

      const analyticsResponse = await fetch("/api/analytics");
      const analyticsData = await analyticsResponse.json();
      if (analyticsResponse.ok) {
        setSummary(analyticsData.summary);
        setPostedScheduledPosts(
          analyticsData.postedScheduledPosts as PostedScheduledPost[],
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析データの取得に失敗しました。");
    } finally {
      setIsCollecting(false);
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleCollect}
          disabled={isCollecting}
          className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isCollecting ? "取得中..." : "今すぐ分析データを取得する(Threads)"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      {message && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>
      )}

      <div className="flex flex-col gap-6 rounded-xl border border-gray-200 p-6 shadow-sm">
        <BreakdownTable
          title="投稿の型別パフォーマンス"
          rows={summary.byPostType}
          labels={POST_TYPE_LABELS}
        />
        <BreakdownTable
          title="フックの型別パフォーマンス"
          rows={summary.byHookType}
          labels={HOOK_TYPE_LABELS}
        />
        <BreakdownTable
          title="構成の型別パフォーマンス"
          rows={summary.byStructure}
          labels={STRUCTURE_LABELS}
        />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-semibold text-gray-800">投稿済み一覧</h2>
        {postedScheduledPosts.length === 0 && (
          <p className="text-sm text-gray-500">投稿済みの投稿はまだありません。</p>
        )}
        {postedScheduledPosts.map((sp) => (
          <div key={sp.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-5 shadow-sm">
            <span className="text-sm font-medium text-gray-500">
              {sp.platform} / {new Date(sp.scheduledAt).toLocaleString("ja-JP")}
            </span>
            {sp.post && (
              <p className="text-sm font-semibold text-gray-900">{sp.post.hook}</p>
            )}
            {sp.latestSnapshot ? (
              <p className="text-sm text-gray-600">
                インプレッション {sp.latestSnapshot.impressions} / いいね{" "}
                {sp.latestSnapshot.likes} / コメント {sp.latestSnapshot.comments} / シェア{" "}
                {sp.latestSnapshot.shares}
              </p>
            ) : (
              <p className="text-sm text-gray-400">分析データ未取得</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
