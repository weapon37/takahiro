import ReceiptForm from "@/components/ReceiptForm";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          領収書 → freee 自動入力ツール
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          領収書・レシートの画像をアップロードすると、AIが日付・支払先・金額・勘定科目・税区分を読み取り、
          freeeの取引入力にそのまま取り込めるCSVを作成します。内容は表で確認・修正できます。
        </p>
      </div>
      <ReceiptForm />
    </main>
  );
}
