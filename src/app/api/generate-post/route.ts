import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildAnthropicClient, getModel } from "@/lib/anthropic-client";
import { getPostTypeById } from "@/lib/post-types";
import { HOOK_TYPES, HOOK_TYPE_IDS, getHookTypeById } from "@/lib/hook-types";
import {
  POST_STRUCTURES,
  POST_STRUCTURE_IDS,
  getPostStructureById,
} from "@/lib/post-structures";
import { getAccountProfileById } from "@/lib/account-profiles";
import { getAffiliateLink, getPerformanceSummary } from "@/lib/store";
import type { Theme, Post } from "@/lib/pipeline-types";

export const runtime = "nodejs";

const HOOK_TOOL_NAME = "submit_hook";
const BODY_TOOL_NAME = "submit_body";

export async function POST(request: Request) {
  let body: {
    theme?: Theme;
    accountId?: string;
    feedback?: string;
    revision?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const theme = body.theme;
  if (!theme || !theme.title || !theme.angle || !theme.postTypeId) {
    return NextResponse.json(
      { error: "テーマ情報が不足しています。" },
      { status: 400 },
    );
  }

  const postType = getPostTypeById(theme.postTypeId);
  if (!postType) {
    return NextResponse.json(
      { error: "未知の投稿の型です。" },
      { status: 400 },
    );
  }

  const accountProfile = getAccountProfileById(body.accountId || "default");
  if (!accountProfile) {
    return NextResponse.json(
      { error: "未知のアカウントです。" },
      { status: 400 },
    );
  }

  const affiliateLink = theme.affiliateLinkId
    ? await getAffiliateLink(theme.affiliateLinkId)
    : undefined;
  const performanceSummary = await getPerformanceSummary();

  let client: Anthropic;
  try {
    client = buildAnthropicClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "サーバー設定エラーです。" },
      { status: 500 },
    );
  }

  const feedbackNote = body.feedback
    ? `\n\n# 前回の品質チェックでの指摘事項(必ず反映すること)\n${body.feedback}`
    : "";

  try {
    const hookList = HOOK_TYPES.map(
      (h) => `- ${h.id}: ${h.label} — ${h.description}`,
    ).join("\n");

    // ⑧分析・改善ループ: 過去投稿で反応が良かったフックの型を参考情報として渡す。
    const topHookPerformance = performanceSummary.byHookType
      .filter((row) => row.postCount > 0)
      .slice(0, 3)
      .map((row) => {
        const label = getHookTypeById(row.key)?.label ?? row.key;
        return `- ${label}: 平均エンゲージメント率 ${(row.avgEngagementRate * 100).toFixed(1)}%(${row.postCount}件の実績)`;
      });
    const hookPerformanceNote =
      topHookPerformance.length > 0
        ? `\n\n# 過去の投稿で反応が良かったフックの型(参考情報、最優先はテーマとの適合性)\n${topHookPerformance.join("\n")}`
        : "";

    const hookMessage = await client.messages.create({
      model: getModel(),
      max_tokens: 600,
      system:
        "あなたはSNS投稿のフック(冒頭一文)を作る専門家です。アカウントの口調を守り、フックの型ナレッジから最も合うものを選んで、続きを読みたくなる一文を作ります。必ず submit_hook ツールを呼び出してください。",
      messages: [
        {
          role: "user",
          content: `# アカウントの口調\n${accountProfile.toneDescription}\n\n# 口調のサンプル\n${accountProfile.sampleHooks.map((s) => `- ${s}`).join("\n")}\n\n# テーマ\nタイトル: ${theme.title}\n切り口: ${theme.angle}\n投稿の型: ${postType.label} — ${postType.description}\n\n# フックの型リスト\n${hookList}${hookPerformanceNote}${feedbackNote}\n\n上記を踏まえて、このテーマに最も合うフックの型を1つ選び、口調に沿った1〜2文のフックを作ってください。`,
        },
      ],
      tools: [
        {
          name: HOOK_TOOL_NAME,
          description: "生成したフックを構造化データとして提出する。",
          input_schema: {
            type: "object",
            properties: {
              hook_type_id: { type: "string", enum: HOOK_TYPE_IDS },
              hook: { type: "string", description: "生成したフック本文" },
            },
            required: ["hook_type_id", "hook"],
          },
        },
      ],
      tool_choice: { type: "tool", name: HOOK_TOOL_NAME },
    });

    const hookToolUse = hookMessage.content.find(
      (block) => block.type === "tool_use" && block.name === HOOK_TOOL_NAME,
    );
    if (!hookToolUse || hookToolUse.type !== "tool_use") {
      return NextResponse.json(
        { error: "フック生成に失敗しました。もう一度お試しください。" },
        { status: 502 },
      );
    }
    const hookInput = hookToolUse.input as {
      hook_type_id: string;
      hook: string;
    };
    const hookType = getHookTypeById(hookInput.hook_type_id);

    const structureList = POST_STRUCTURES.map(
      (s) => `- ${s.id}: ${s.label} — ${s.description}`,
    ).join("\n");

    const affiliateNote = affiliateLink
      ? `\n\n# 紹介する商品(自然な文脈で触れること。商品URLや「#PR」は本文に書かなくてよい。後でシステムが自動付与する)\n${affiliateLink.productName}${
          affiliateLink.description ? ` — ${affiliateLink.description}` : ""
        }`
      : "";

    // ⑧分析・改善ループ: 過去投稿で反応が良かった構成の型を参考情報として渡す。
    const topStructurePerformance = performanceSummary.byStructure
      .filter((row) => row.postCount > 0)
      .slice(0, 3)
      .map((row) => {
        const label = getPostStructureById(row.key)?.label ?? row.key;
        return `- ${label}: 平均エンゲージメント率 ${(row.avgEngagementRate * 100).toFixed(1)}%(${row.postCount}件の実績)`;
      });
    const structurePerformanceNote =
      topStructurePerformance.length > 0
        ? `\n\n# 過去の投稿で反応が良かった構成の型(参考情報、最優先はテーマ・フックとの適合性)\n${topStructurePerformance.join("\n")}`
        : "";

    const bodyMessage = await client.messages.create({
      model: getModel(),
      max_tokens: 1200,
      system:
        "あなたはSNS投稿の本文を書く専門家です。アカウントの口調を守り、与えられたフックに適合する本文を、ポスト構成の型ナレッジに沿って書きます。必ず submit_body ツールを呼び出してください。",
      messages: [
        {
          role: "user",
          content: `# アカウントの口調\n${accountProfile.toneDescription}\n\n# テーマ\nタイトル: ${theme.title}\n切り口: ${theme.angle}\n投稿の型: ${postType.label} — ${postType.description}\n\n# フック(この続きを書く)\n${hookInput.hook}\n\n# ポスト構成の型リスト\n${structureList}${structurePerformanceNote}${affiliateNote}${feedbackNote}\n\nフックに続く本文を、最も合う構成の型を1つ選んで書いてください。フック自体は繰り返さず、フックの直後から続く文章にしてください。`,
        },
      ],
      tools: [
        {
          name: BODY_TOOL_NAME,
          description: "生成した本文を構造化データとして提出する。",
          input_schema: {
            type: "object",
            properties: {
              structure_id: { type: "string", enum: POST_STRUCTURE_IDS },
              body: { type: "string", description: "フックに続く本文" },
            },
            required: ["structure_id", "body"],
          },
        },
      ],
      tool_choice: { type: "tool", name: BODY_TOOL_NAME },
    });

    const bodyToolUse = bodyMessage.content.find(
      (block) => block.type === "tool_use" && block.name === BODY_TOOL_NAME,
    );
    if (!bodyToolUse || bodyToolUse.type !== "tool_use") {
      return NextResponse.json(
        { error: "本文生成に失敗しました。もう一度お試しください。" },
        { status: 502 },
      );
    }
    const bodyInput = bodyToolUse.input as {
      structure_id: string;
      body: string;
    };

    // ステマ規制対応: アフィリエイトリンクを含む投稿には広告である旨と
    // リンクを必ず本文末尾に機械的に付与し、AIの生成揺れに依存しない。
    const finalBody = affiliateLink
      ? `${bodyInput.body}\n\n${affiliateLink.url}\n#PR`
      : bodyInput.body;

    const post: Post = {
      id: crypto.randomUUID(),
      themeId: theme.id,
      accountId: accountProfile.id,
      hook: hookInput.hook,
      body: finalBody,
      postTypeId: postType.id,
      hookTypeId: hookType?.id,
      structureId: bodyInput.structure_id,
      affiliateLinkId: affiliateLink?.id,
      revision: body.revision !== undefined ? body.revision + 1 : 0,
      status: "draft",
    };

    return NextResponse.json({
      post,
      hookType: hookType ?? null,
      structureId: bodyInput.structure_id,
    });
  } catch (error) {
    console.error("Post generation failed", error);
    const message =
      error instanceof Anthropic.APIError
        ? `Claude APIエラー: ${error.message}`
        : "投稿生成中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
