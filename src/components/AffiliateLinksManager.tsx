"use client";

import { useState } from "react";
import type { AffiliateLink, AffiliateNetwork } from "@/lib/pipeline-types";

const PLATFORM_LABEL: Record<AffiliateNetwork, string> = {
  rakuten: "楽天アフィリエイト",
  a8net: "A8.net",
  afb: "afb",
};

const PLATFORMS: AffiliateNetwork[] = ["rakuten", "a8net", "afb"];

export default function AffiliateLinksManager({
  initialAffiliateLinks,
}: {
  initialAffiliateLinks: AffiliateLink[];
}) {
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLink[]>(
    initialAffiliateLinks,
  );
  const [productName, setProductName] = useState("");
  const [platform, setPlatform] = useState<AffiliateNetwork>("rakuten");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/affiliate-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          platform,
          url,
          description,
          tags: tagsText
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t !== ""),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "登録に失敗しました。");
      setAffiliateLinks((prev) => [...prev, data.affiliateLink as AffiliateLink]);
      setProductName("");
      setUrl("");
      setDescription("");
      setTagsText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-gray-200 p-6 shadow-sm"
      >
        <h2 className="font-semibold text-gray-800">商品リンクを登録する</h2>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          商品名
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
            className="rounded-lg border border-gray-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          ASP
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as AffiliateNetwork)}
            className="rounded-lg border border-gray-300 p-2 text-sm"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          アフィリエイトURL(発行された計測用リンク)
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://..."
            className="rounded-lg border border-gray-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          商品説明(任意、テーマ選定・投稿生成の参考に使われます)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded-lg border border-gray-300 p-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          タグ(任意、カンマ区切り)
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="例: 育児, 時短家電"
            className="rounded-lg border border-gray-300 p-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="self-start rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isSubmitting ? "登録中..." : "登録する"}
        </button>
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
      </form>

      <div className="flex flex-col gap-4">
        <h2 className="font-semibold text-gray-800">登録済みリンク</h2>
        {affiliateLinks.length === 0 && (
          <p className="text-sm text-gray-500">まだ登録されていません。</p>
        )}
        {affiliateLinks.map((link) => (
          <div
            key={link.id}
            className="flex flex-col gap-1 rounded-xl border border-gray-200 p-4 text-sm shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900">{link.productName}</span>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                {PLATFORM_LABEL[link.platform]}
              </span>
            </div>
            {link.description && <p className="text-gray-600">{link.description}</p>}
            <p className="truncate text-gray-500">{link.url}</p>
            {link.tags.length > 0 && (
              <p className="text-xs text-gray-400">タグ: {link.tags.join(", ")}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
