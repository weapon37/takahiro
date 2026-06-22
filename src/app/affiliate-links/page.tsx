import AffiliateLinksManager from "@/components/AffiliateLinksManager";
import { listAffiliateLinks } from "@/lib/store";

export default async function AffiliateLinksPage() {
  const affiliateLinks = await listAffiliateLinks();

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900">アフィリエイトリンク管理(⑦)</h1>
        <p className="text-gray-600">
          登録した商品リンクは、テーマ選定時に切り口へ自然に紐づけられ、投稿生成時に本文末尾へ
          「#PR」表記とともに自動で追記されます。
        </p>
      </div>
      <AffiliateLinksManager initialAffiliateLinks={affiliateLinks} />
    </main>
  );
}
