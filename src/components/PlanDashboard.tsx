"use client";

import { useCallback, useState } from "react";
import { POST_TYPES } from "@/lib/post-types";
import { PURPOSE_LABELS } from "@/lib/types";
import { MIN_WEEKS, MAX_WEEKS } from "@/lib/plan-constants";
import type { PlanTheme, QueueItem, QueueStatus } from "@/lib/types";

const STATUS_LABELS: Record<QueueStatus, string> = {
  draft: "下書き",
  approved: "承認済み",
  posted: "投稿済み",
  failed: "投稿失敗",
  skipped: "見送り",
};

const STATUS_COLORS: Record<QueueStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  posted: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  skipped: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function typeLabel(typeId: string): string {
  return POST_TYPES.find((t) => t.id === typeId)?.label ?? typeId;
}

interface PlanDashboardProps {
  initialThemes: PlanTheme[];
  initialItems: QueueItem[];
  initialError: string | null;
  rangeFrom: string;
  rangeTo: string;
}

export default function PlanDashboard({
  initialThemes,
  initialItems,
  initialError,
  rangeFrom,
  rangeTo,
}: PlanDashboardProps) {
  const [startDate, setStartDate] = useState(todayStr());
  const [weeks, setWeeks] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genSummary, setGenSummary] = useState<string | null>(null);

  const [themes, setThemes] = useState<PlanTheme[]>(initialThemes);
  const [items, setItems] = useState<QueueItem[]>(initialItems);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(initialError);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadList = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const [themesRes, queueRes] = await Promise.all([
        fetch(`/api/plan/themes?from=${rangeFrom}&to=${rangeTo}`),
        fetch(`/api/queue?from=${rangeFrom}&to=${rangeTo}`),
      ]);
      const themesData = await themesRes.json();
      const queueData = await queueRes.json();
      if (!themesRes.ok) throw new Error(themesData.error || "テーマの取得に失敗しました。");
      if (!queueRes.ok) throw new Error(queueData.error || "投稿一覧の取得に失敗しました。");
      setThemes(themesData.items as PlanTheme[]);
      setItems(queueData.items as QueueItem[]);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "取得に失敗しました。");
    } finally {
      setIsLoadingList(false);
    }
  }, [rangeFrom, rangeTo]);

  async function handleGenerate() {
    setIsGenerating(true);
    setGenError(null);
    setGenSummary(null);
    try {
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, weeks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "計画の生成に失敗しました。");
      setGenSummary(
        `「${data.longTermTheme}」というテーマで${data.weeks}週間分を生成しました。新規追加 ${data.dailyDrafts.inserted}件 / 既存のため保持 ${data.dailyDrafts.skipped}件`,
      );
      await loadList();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "計画の生成に失敗しました。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function updateItem(id: number, patch: { content?: string; status?: QueueStatus }) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/queue/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新に失敗しました。");
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } as QueueItem : it)),
      );
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新に失敗しました。");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(id: number) {
    if (!confirm("この投稿予定を削除しますか?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/queue/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "削除に失敗しました。");
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "削除に失敗しました。");
    } finally {
      setBusyId(null);
    }
  }

  const longThemes = themes.filter((t) => t.scope === "long");
  const midThemes = themes.filter((t) => t.scope === "mid");

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      {/* 生成フォーム */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">計画を生成する</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            開始日
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            期間(週数)
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
            >
              {Array.from({ length: MAX_WEEKS - MIN_WEEKS + 1 }, (_, i) => MIN_WEEKS + i).map(
                (w) => (
                  <option key={w} value={w}>
                    {w}週間
                  </option>
                ),
              )}
            </select>
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
          >
            {isGenerating ? "生成中..." : "計画を生成する"}
          </button>
        </div>
        {genError && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {genError}
          </p>
        )}
        {genSummary && (
          <p className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            {genSummary}
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          すでに下書き・承認済みの日は上書きされません。新しい期間だけ追加したいときは開始日をずらして生成してください。
        </p>
      </div>

      {listError && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {listError}
        </p>
      )}

      {/* 長期・中期テーマ */}
      {longThemes.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">長期テーマ</h2>
          {longThemes.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t.periodStart} 〜 {t.periodEnd}
              </p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-white">{t.theme}</p>
              {t.notes && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {midThemes.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">週テーマ</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {midThemes.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm"
              >
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t.periodStart} 〜 {t.periodEnd}
                </p>
                <p className="mt-1 font-medium text-gray-900 dark:text-white">{t.theme}</p>
                {t.notes && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{t.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 日次投稿一覧 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">日次の下書き・予定</h2>
          {isLoadingList && (
            <span className="text-xs text-gray-400">読み込み中...</span>
          )}
        </div>
        {items.length === 0 && !isLoadingList && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            まだ計画がありません。上のフォームから計画を生成してください。
          </p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-gray-800 dark:text-gray-100">
                  {item.scheduledDate}
                </span>
                <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-gray-600 dark:text-gray-300">
                  {typeLabel(item.typeId)}
                </span>
                <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-gray-600 dark:text-gray-300">
                  {PURPOSE_LABELS[item.purpose]}
                </span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[item.status]}`}>
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
            </div>

            {editingId === item.id ? (
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-100">
                {item.content}
              </p>
            )}

            {item.errorMessage && (
              <p className="text-xs text-red-600 dark:text-red-400">エラー: {item.errorMessage}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {editingId === item.id ? (
                <>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => updateItem(item.id, { content: editingContent })}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200"
                  >
                    キャンセル
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditingContent(item.content);
                  }}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  編集
                </button>
              )}
              {item.status !== "approved" && (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => updateItem(item.id, { status: "approved" })}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
                >
                  承認する
                </button>
              )}
              {item.status !== "draft" && item.status !== "posted" && (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => updateItem(item.id, { status: "draft" })}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50"
                >
                  下書きに戻す
                </button>
              )}
              {item.status !== "posted" && (
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => deleteItem(item.id)}
                  className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 disabled:opacity-50"
                >
                  削除
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
