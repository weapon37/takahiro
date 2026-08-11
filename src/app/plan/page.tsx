import PlanDashboard from "@/components/PlanDashboard";
import { isDatabaseConfigured, listThemes, listQueueItems } from "@/lib/db";
import { todayJST, addDays } from "@/lib/date";
import type { PlanTheme, QueueItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const rangeFrom = addDays(todayJST(), -7);
  const rangeTo = addDays(todayJST(), 60);

  let initialThemes: PlanTheme[] = [];
  let initialItems: QueueItem[] = [];
  let initialError: string | null = null;

  if (!isDatabaseConfigured()) {
    initialError = "DATABASE_URL が設定されていません。設定画面の手順に従ってDBを準備してください。";
  } else {
    try {
      [initialThemes, initialItems] = await Promise.all([
        listThemes(rangeFrom, rangeTo),
        listQueueItems(rangeFrom, rangeTo),
      ]);
    } catch (error) {
      initialError = error instanceof Error ? error.message : "取得に失敗しました。";
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-3xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          投稿計画カレンダー
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          長期テーマ・週テーマ・日次の下書きをAIが自動生成します。内容を確認して「承認」した投稿だけが、設定した時刻に自動でXへ投稿されます。
        </p>
      </div>
      <PlanDashboard
        initialThemes={initialThemes}
        initialItems={initialItems}
        initialError={initialError}
        rangeFrom={rangeFrom}
        rangeTo={rangeTo}
      />
    </main>
  );
}
