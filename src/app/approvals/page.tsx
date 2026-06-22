import ApprovalsBoard from "@/components/ApprovalsBoard";
import { listScheduledPosts } from "@/lib/store";

export default async function ApprovalsPage() {
  const scheduledPosts = await listScheduledPosts();

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900">承認・予約投稿(⑥)</h1>
        <p className="text-gray-600">
          パイプラインで品質チェックに合格した投稿を承認すると、予約時刻に自動投稿されます。
        </p>
      </div>
      <ApprovalsBoard initialScheduledPosts={scheduledPosts} />
    </main>
  );
}
