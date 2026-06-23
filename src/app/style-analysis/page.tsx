import type { Metadata } from "next";
import Link from "next/link";
import StyleProfileForm from "@/components/StyleProfileForm";

export const metadata: Metadata = {
  title: "文体プロファイル分析ツール",
  description:
    "過去のSNSポストを貼り付けると、AIが文体プロファイルを作成します。",
};

export default function StyleAnalysisPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          文体プロファイル分析ツール
        </h1>
        <p className="text-gray-600">
          過去のSNSポストを貼り付けると、別のAIがあなたの文体を再現できるように、
          トーン・文体・構成・表現のクセを言語化します。
        </p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          投稿の型を分析するツールはこちら
        </Link>
      </div>
      <StyleProfileForm />
    </main>
  );
}
