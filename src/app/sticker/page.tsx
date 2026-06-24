import StickerGeneratorForm from "@/components/StickerGeneratorForm";

export default function StickerPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          LINEスタンプ量産ツール
        </h1>
        <p className="text-gray-600">
          キャラクターの参照画像とセリフ一覧をアップロードすると、AIが画風を保ったまま複数のスタンプ画像を生成し、
          LINEクリエイターズスタンプの規格(main.png / tab.png / 01.png〜)に沿ったZIPを作成します。
        </p>
      </div>
      <StickerGeneratorForm />
    </main>
  );
}
