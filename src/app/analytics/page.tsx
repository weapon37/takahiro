import AnalyticsBoard from "@/components/AnalyticsBoard";
import {
  getPerformanceSummary,
  listPostedScheduledPostsWithLatestSnapshot,
} from "@/lib/store";

export default async function AnalyticsPage() {
  const [summary, postedScheduledPosts] = await Promise.all([
    getPerformanceSummary(),
    listPostedScheduledPostsWithLatestSnapshot(),
  ]);

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900">分析・改善(⑧)</h1>
        <p className="text-gray-600">
          投稿済みのエンゲージメントを集計し、反応が良い型を②テーマ選定・③ポスト生成の
          プロンプトに自動で反映します。
        </p>
      </div>
      <AnalyticsBoard
        initialSummary={summary}
        initialPostedScheduledPosts={postedScheduledPosts}
      />
    </main>
  );
}
