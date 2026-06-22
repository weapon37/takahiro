import type { AffiliateLink } from "./pipeline-types";

// ⑦ステマ規制対応の広告表示。投稿本文末尾に機械的に付与・除去するための
// 共通フォーマット。生成(generate-post)・ファクトチェック・品質チェックの
// 3箇所で同じ形式を使うため、ここに一本化している。
export function buildAffiliateFooter(
  affiliateLink: AffiliateLink | undefined,
): string {
  return affiliateLink ? `\n\n${affiliateLink.url}\n#PR` : "";
}

export function stripAffiliateFooter(body: string, footer: string): string {
  return footer && body.endsWith(footer) ? body.slice(0, -footer.length) : body;
}
