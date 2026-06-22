"use client";

import { useState } from "react";
import type { PostTypeDefinition } from "@/lib/post-types";
import type { HookTypeDefinition } from "@/lib/hook-types";
import Link from "next/link";
import type {
  Theme,
  Post,
  FactCheckResult,
  QualityCheckResult,
  ScheduledPost,
  AffiliateLink,
} from "@/lib/pipeline-types";

interface ThemeResponse {
  theme: Theme;
  postType: PostTypeDefinition;
  affiliateLink?: AffiliateLink;
}

interface PostResponse {
  post: Post;
  hookType: HookTypeDefinition | null;
  structureId: string;
}

interface FactCheckResponse {
  factCheckResult: FactCheckResult;
  correctedBody: string;
}

interface QualityResponse {
  qualityCheckResult: QualityCheckResult;
}

type Stage = "theme" | "post" | "fact-check" | "quality-check" | "schedule" | null;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "リクエストに失敗しました。");
  }
  return data as T;
}

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export default function PipelineForm() {
  const [researchNotesText, setResearchNotesText] = useState("");
  const [recentPostsText, setRecentPostsText] = useState("");
  const [useAffiliate, setUseAffiliate] = useState(false);
  const [loadingStage, setLoadingStage] = useState<Stage>(null);
  const [error, setError] = useState<string | null>(null);

  const [themeResult, setThemeResult] = useState<ThemeResponse | null>(null);
  const [postResult, setPostResult] = useState<PostResponse | null>(null);
  const [factCheckResult, setFactCheckResult] =
    useState<FactCheckResponse | null>(null);
  const [qualityResult, setQualityResult] = useState<QualityResponse | null>(
    null,
  );
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledPost, setScheduledPost] = useState<ScheduledPost | null>(null);

  async function handleSelectTheme() {
    setError(null);
    setThemeResult(null);
    setPostResult(null);
    setFactCheckResult(null);
    setQualityResult(null);

    const researchNotes = linesToArray(researchNotesText);
    if (researchNotes.length === 0) {
      setError("ネタ候補を1件以上入力してください。");
      return;
    }

    setLoadingStage("theme");
    try {
      const data = await postJson<ThemeResponse>("/api/theme", {
        researchNotes,
        recentPostSummaries: linesToArray(recentPostsText),
        useAffiliate,
      });
      setThemeResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "テーマ選定に失敗しました。");
    } finally {
      setLoadingStage(null);
    }
  }

  async function handleGeneratePost(feedback?: string) {
    if (!themeResult) return;
    setError(null);
    setFactCheckResult(null);
    setQualityResult(null);

    setLoadingStage("post");
    try {
      const data = await postJson<PostResponse>("/api/generate-post", {
        theme: themeResult.theme,
        accountId: "default",
        feedback,
        revision: postResult?.post.revision,
      });
      setPostResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿生成に失敗しました。");
    } finally {
      setLoadingStage(null);
    }
  }

  async function handleFactCheck() {
    if (!postResult) return;
    setError(null);
    setLoadingStage("fact-check");
    try {
      const data = await postJson<FactCheckResponse>("/api/fact-check", {
        post: postResult.post,
      });
      setFactCheckResult(data);
      setPostResult({
        ...postResult,
        post: { ...postResult.post, body: data.correctedBody },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ファクトチェックに失敗しました。");
    } finally {
      setLoadingStage(null);
    }
  }

  async function handleQualityCheck() {
    if (!postResult) return;
    setError(null);
    setLoadingStage("quality-check");
    try {
      const data = await postJson<QualityResponse>("/api/quality-check", {
        post: postResult.post,
      });
      setQualityResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "品質チェックに失敗しました。");
    } finally {
      setLoadingStage(null);
    }
  }

  async function handleSchedule() {
    if (!postResult || !scheduledAt) return;
    setError(null);
    setLoadingStage("schedule");
    try {
      const data = await postJson<{ scheduledPost: ScheduledPost }>(
        "/api/scheduled-posts",
        {
          post: postResult.post,
          platform: "threads",
          scheduledAt: new Date(scheduledAt).toISOString(),
        },
      );
      setScheduledPost(data.scheduledPost);
    } catch (err) {
      setError(err instanceof Error ? err.message : "予約登録に失敗しました。");
    } finally {
      setLoadingStage(null);
    }
  }

  const isLoading = loadingStage !== null;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800">① ネタ候補 → ② テーマ選定</h2>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          ネタ候補(1行に1件)
          <textarea
            value={researchNotesText}
            onChange={(e) => setResearchNotesText(e.target.value)}
            rows={4}
            placeholder={"例: 競合Aが「朝活ルーティン」の投稿で5万いいね\n例: Threadsで「初任給の使い方」が伸びている"}
            className="rounded-lg border border-gray-300 p-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          直近の投稿(任意、1行に1件、テーマの重複チェック用)
          <textarea
            value={recentPostsText}
            onChange={(e) => setRecentPostsText(e.target.value)}
            rows={3}
            className="rounded-lg border border-gray-300 p-3 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={useAffiliate}
            onChange={(e) => setUseAffiliate(e.target.checked)}
          />
          ⑦ アフィリエイト商品を紐づける(合う商品があれば自動で選定)
          <Link href="/affiliate-links" className="text-blue-600 hover:underline">
            リンクを管理する →
          </Link>
        </label>
        <button
          type="button"
          onClick={handleSelectTheme}
          disabled={isLoading}
          className="self-start rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loadingStage === "theme" ? "選定中..." : "テーマを選定する"}
        </button>

        {themeResult && (
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">{themeResult.theme.title}</p>
            <p className="mt-1">切り口: {themeResult.theme.angle}</p>
            <p className="mt-1">
              型: {themeResult.postType.label} — {themeResult.postType.description}
            </p>
            <p className="mt-1 text-gray-500">
              重複チェック: {themeResult.theme.duplicateCheckNote}
            </p>
            {themeResult.affiliateLink && (
              <p className="mt-1 text-amber-700">
                紐づけ商品: {themeResult.affiliateLink.productName}(
                {themeResult.affiliateLink.platform})
              </p>
            )}
          </div>
        )}
      </section>

      {themeResult && (
        <section className="flex flex-col gap-4 rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800">③ ポスト生成</h2>
          <button
            type="button"
            onClick={() => handleGeneratePost()}
            disabled={isLoading}
            className="self-start rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loadingStage === "post" ? "生成中..." : "投稿を生成する"}
          </button>

          {postResult && (
            <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
              <div>
                <span className="text-gray-500">
                  フック {postResult.hookType ? `(${postResult.hookType.label})` : ""}
                </span>
                <p className="font-semibold text-gray-900">{postResult.post.hook}</p>
              </div>
              <div>
                <span className="text-gray-500">本文</span>
                <p className="whitespace-pre-wrap">{postResult.post.body}</p>
              </div>
              <p className="text-xs text-gray-400">改訂回数: {postResult.post.revision}</p>
            </div>
          )}
        </section>
      )}

      {postResult && (
        <section className="flex flex-col gap-4 rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800">④ ファクトチェック</h2>
          <button
            type="button"
            onClick={handleFactCheck}
            disabled={isLoading}
            className="self-start rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loadingStage === "fact-check" ? "確認中..." : "ファクトチェックする"}
          </button>

          {factCheckResult && (
            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
              {factCheckResult.factCheckResult.issues.length === 0 ? (
                <p>修正点は見つかりませんでした。</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {factCheckResult.factCheckResult.issues.map((issue, i) => (
                    <li key={i}>
                      <span className="line-through text-gray-500">{issue.original}</span>
                      {" → "}
                      <span className="font-medium text-gray-900">{issue.corrected}</span>
                      <p className="text-xs text-gray-500">{issue.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {postResult && (
        <section className="flex flex-col gap-4 rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800">⑤ 品質チェック</h2>
          <button
            type="button"
            onClick={handleQualityCheck}
            disabled={isLoading}
            className="self-start rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loadingStage === "quality-check" ? "採点中..." : "品質チェックする"}
          </button>

          {qualityResult && (
            <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">
                総合スコア: {qualityResult.qualityCheckResult.score}点{" "}
                <span
                  className={
                    qualityResult.qualityCheckResult.passed
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {qualityResult.qualityCheckResult.passed ? "合格" : "不合格"}
                </span>
              </p>
              <p>フックの強さ: {qualityResult.qualityCheckResult.criteria.hookStrength}点</p>
              <p>語尾の多様さ: {qualityResult.qualityCheckResult.criteria.sentenceVariety}点</p>
              <p>内容の深さ: {qualityResult.qualityCheckResult.criteria.depth}点</p>
              <p className="text-gray-600">{qualityResult.qualityCheckResult.feedback}</p>

              {!qualityResult.qualityCheckResult.passed && (
                <button
                  type="button"
                  onClick={() =>
                    handleGeneratePost(qualityResult.qualityCheckResult.feedback)
                  }
                  disabled={isLoading}
                  className="self-start rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {loadingStage === "post" ? "書き直し中..." : "フィードバックを反映して書き直す"}
                </button>
              )}

              {qualityResult.qualityCheckResult.passed && (
                <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
                  <p className="font-semibold text-gray-800">⑥ 承認待ちに登録</p>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    予約投稿日時(Threads)
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="rounded-lg border border-gray-300 p-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleSchedule}
                    disabled={isLoading || !scheduledAt}
                    className="self-start rounded-lg bg-green-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {loadingStage === "schedule" ? "登録中..." : "承認待ちに登録する"}
                  </button>

                  {scheduledPost && (
                    <p className="text-sm text-gray-600">
                      承認待ちに登録しました。
                      <Link href="/approvals" className="ml-1 text-blue-600 hover:underline">
                        承認ページで確認する →
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
