import AnalyticsView from "@/components/AnalyticsView";
import { isDatabaseConfigured, listPostSnapshots } from "@/lib/db";
import type { PostSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const initialItems: PostSnapshot[] = isDatabaseConfigured()
    ? await listPostSnapshots().catch(() => [])
    : [];

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          投稿分析
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Xに実際に投稿したものの数字(インプレッション・いいね等)を自動取得します。毎日1回自動更新されるほか、いつでも手動で最新化できます。
        </p>
      </div>
      <AnalyticsView initialItems={initialItems} />
    </main>
  );
}
