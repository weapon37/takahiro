import SettingsStatus from "@/components/SettingsStatus";
import { getStatusSummary } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const initialStatus = await getStatusSummary();

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          設定・状態確認
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Vercelのプロジェクト設定画面で環境変数を追加したあと、ここで接続状態を確認できます。ターミナル操作は不要です。
        </p>
      </div>
      <SettingsStatus initialStatus={initialStatus} />
    </main>
  );
}
