import PostGeneratorForm from "@/components/PostGeneratorForm";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          バズったX投稿 量産ツール
        </h1>
        <p className="text-gray-600">
          バズったX(旧Twitter)投稿のテキストやスクリーンショットを入れると、
          AIがその「型」を分析し、同じ構成・フックを使った新しい投稿を何パターンも自動生成します。
        </p>
      </div>
      <PostGeneratorForm />
    </main>
  );
}
