import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildAnthropicClient, getModel } from "@/lib/anthropic-client";
import { getAffiliateLink } from "@/lib/store";
import { buildAffiliateFooter, stripAffiliateFooter } from "@/lib/affiliate-disclosure";
import type { Post, QualityCheckResult } from "@/lib/pipeline-types";

export const runtime = "nodejs";

const QUALITY_CHECK_TOOL_NAME = "submit_quality_check";
const PASS_THRESHOLD = 70;

export async function POST(request: Request) {
  let body: { post?: Post };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const post = body.post;
  if (!post || !post.hook || !post.body) {
    return NextResponse.json(
      { error: "投稿データが不足しています。" },
      { status: 400 },
    );
  }

  let client: Anthropic;
  try {
    client = buildAnthropicClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "サーバー設定エラーです。" },
      { status: 500 },
    );
  }

  // アフィリエイトURL・#PR表記は品質採点の対象外とする(広告表示自体の
  // 有無でフックの強さ・内容の深さが不当に下がらないようにするため)。
  const affiliateLink = post.affiliateLinkId
    ? await getAffiliateLink(post.affiliateLinkId)
    : undefined;
  const affiliateFooter = buildAffiliateFooter(affiliateLink);
  const bodyForCheck = stripAffiliateFooter(post.body, affiliateFooter);

  try {
    const message = await client.messages.create({
      model: getModel(),
      max_tokens: 800,
      system:
        "あなたはSNS投稿の品質を採点する厳しい編集者です。フックの強さ・語尾の単調さ・内容の深さの3観点をそれぞれ0〜100点で採点し、改善すべき点を具体的に指摘します。必ず submit_quality_check ツールを呼び出してください。",
      messages: [
        {
          role: "user",
          content: `# フック\n${post.hook}\n\n# 本文\n${bodyForCheck}\n\n上記の投稿を採点してください。`,
        },
      ],
      tools: [
        {
          name: QUALITY_CHECK_TOOL_NAME,
          description: "品質チェックの採点結果を構造化データとして提出する。",
          input_schema: {
            type: "object",
            properties: {
              hook_strength: { type: "integer", description: "フックの強さ(0〜100)" },
              sentence_variety: {
                type: "integer",
                description: "語尾・文末表現の多様さ(0〜100、単調なほど低い)",
              },
              depth: { type: "integer", description: "内容の深さ・具体性(0〜100)" },
              feedback: {
                type: "string",
                description: "改善すべき点の具体的な指摘。問題がなければその旨を書く。",
              },
            },
            required: ["hook_strength", "sentence_variety", "depth", "feedback"],
          },
        },
      ],
      tool_choice: { type: "tool", name: QUALITY_CHECK_TOOL_NAME },
    });

    const toolUseBlock = message.content.find(
      (block) =>
        block.type === "tool_use" && block.name === QUALITY_CHECK_TOOL_NAME,
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      return NextResponse.json(
        { error: "品質チェック結果の取得に失敗しました。もう一度お試しください。" },
        { status: 502 },
      );
    }

    const input = toolUseBlock.input as {
      hook_strength: number;
      sentence_variety: number;
      depth: number;
      feedback: string;
    };

    const score = Math.round(
      (input.hook_strength + input.sentence_variety + input.depth) / 3,
    );
    const passed = score >= PASS_THRESHOLD;

    const qualityCheckResult: QualityCheckResult = {
      id: crypto.randomUUID(),
      postId: post.id,
      score,
      passed,
      criteria: {
        hookStrength: input.hook_strength,
        sentenceVariety: input.sentence_variety,
        depth: input.depth,
      },
      feedback: input.feedback,
      checkedAt: new Date().toISOString(),
    };

    return NextResponse.json({ qualityCheckResult });
  } catch (error) {
    console.error("Quality check failed", error);
    const message =
      error instanceof Anthropic.APIError
        ? `Claude APIエラー: ${error.message}`
        : "品質チェック中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
