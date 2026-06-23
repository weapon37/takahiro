import Link from "next/link";
import AnalyzerForm from "@/components/AnalyzerForm";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          X投稿スクショ型分析ツール
        </h1>
        <p className="text-gray-600">
          バズったX(旧Twitter)投稿のスクリーンショットをアップロードすると、
          投稿の「型」をAIが分析します。
        </p>
        <Link href="/style-analysis" className="text-sm text-blue-600 hover:underline">
          文体プロファイルを分析するツールはこちら
        </Link>
      </div>
      <AnalyzerForm />
    </main>
  );
}
