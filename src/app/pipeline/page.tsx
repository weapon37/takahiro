import PipelineForm from "@/components/PipelineForm";

export default function PipelinePage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          投稿生成パイプライン(①〜⑤)
        </h1>
        <p className="text-gray-600">
          リサーチでのネタ収集からテーマ選定・投稿生成・ファクトチェック・品質チェックまでを
          1ページで実行できます。
        </p>
      </div>
      <PipelineForm />
    </main>
  );
}
