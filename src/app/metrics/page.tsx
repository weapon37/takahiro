import MetricsForm from "@/components/MetricsForm";
import { isDatabaseConfigured, listMetrics } from "@/lib/db";
import type { MetricEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const initialEntries: MetricEntry[] = isDatabaseConfigured()
    ? await listMetrics().catch(() => [])
    : [];

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          実績記録
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Xアプリの分析画面で確認した数字を週1回程度で手入力してください。API課金を増やさず、傾向を振り返るための簡易記録です。
        </p>
      </div>
      <MetricsForm initialEntries={initialEntries} />
    </main>
  );
}
