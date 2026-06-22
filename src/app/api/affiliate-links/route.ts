import { NextResponse } from "next/server";
import { addAffiliateLink, listAffiliateLinks } from "@/lib/store";
import type { AffiliateNetwork } from "@/lib/pipeline-types";

export const runtime = "nodejs";

const AFFILIATE_NETWORKS: AffiliateNetwork[] = ["rakuten", "a8net", "afb"];

export async function GET() {
  const affiliateLinks = await listAffiliateLinks();
  return NextResponse.json({ affiliateLinks });
}

export async function POST(request: Request) {
  let body: {
    productName?: unknown;
    platform?: unknown;
    url?: unknown;
    tags?: unknown;
    description?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const productName =
    typeof body.productName === "string" ? body.productName.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const platform =
    typeof body.platform === "string" &&
    AFFILIATE_NETWORKS.includes(body.platform as AffiliateNetwork)
      ? (body.platform as AffiliateNetwork)
      : undefined;
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string" && t.trim() !== "")
    : [];
  const description =
    typeof body.description === "string" ? body.description.trim() : undefined;

  if (!productName || !url || !platform) {
    return NextResponse.json(
      { error: "商品名・ASP・URLは必須です。" },
      { status: 400 },
    );
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: "URLの形式が不正です。" },
      { status: 400 },
    );
  }

  const affiliateLink = await addAffiliateLink({
    productName,
    platform,
    url,
    tags,
    description,
  });

  return NextResponse.json({ affiliateLink });
}
