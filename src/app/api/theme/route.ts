import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildAnthropicClient, getModel } from "@/lib/anthropic-client";
import { POST_TYPES, POST_TYPE_IDS, getPostTypeById } from "@/lib/post-types";
import { getPerformanceSummary, listAffiliateLinks } from "@/lib/store";
import type { Theme } from "@/lib/pipeline-types";

export const runtime = "nodejs";

const THEME_TOOL_NAME = "submit_theme";
const NO_AFFILIATE_LINK_ID = "none";

export async function POST(request: Request) {
  let body: {
    researchNotes?: unknown;
    recentPostSummaries?: unknown;
    useAffiliate?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const researchNotes = Array.isArray(body.researchNotes)
    ? body.researchNotes.filter((n): n is string => typeof n === "string" && n.trim() !== "")
    : [];
  const recentPostSummaries = Array.isArray(body.recentPostSummaries)
    ? body.recentPostSummaries.filter(
        (n): n is string => typeof n === "string" && n.trim() !== "",
      )
    : [];
  const useAffiliate = body.useAffiliate === true;

  if (researchNotes.length === 0) {
    return NextResponse.json(
      { error: "ネタ候補を1件以上入力してください。" },
      { status: 400 },
    );
  }

  const affiliateLinks = useAffiliate ? await listAffiliateLinks() : [];
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

  const typeList = POST_TYPES.map(
    (t) => `- ${t.id}: ${t.label} — ${t.description}`,
  ).join("\n");
  const notesList = researchNotes
    .map((n, i) => `${i}: ${n}`)
    .join("\n");
  const recentList =
    recentPostSummaries.length > 0
      ? recentPostSummaries.map((n, i) => `${i}: ${n}`).join("\n")
      : "(直近の投稿情報なし)";
  const affiliateLinkIds = affiliateLinks.map((link) => link.id);
  const affiliateSection =
    affiliateLinks.length > 0
      ? `\n\n# 紹介可能なアフィリエイト商品\n${affiliateLinks
          .map(
            (link) =>
              `- ${link.id}: [${link.platform}] ${link.productName}${
                link.description ? ` — ${link.description}` : ""
              }`,
          )
          .join(
            "\n",
          )}\n\nテーマの切り口にこれらの商品を自然に紹介できそうな場合は affiliate_link_id にそのIDを入れてください。無理にこじつける必要はなく、合わなければ \"${NO_AFFILIATE_LINK_ID}\" にしてください。`
      : "";

  // ⑧分析・改善ループ: 過去投稿のエンゲージメント率が高い型を参考情報として渡す。
  // データがまだ無い間は空になり、通常の選定基準のみで判断される。
  const topPostTypePerformance = performanceSummary.byPostType
    .filter((row) => row.postCount > 0)
    .slice(0, 3)
    .map((row) => {
      const label = getPostTypeById(row.key)?.label ?? row.key;
      return `- ${label}: 平均エンゲージメント率 ${(row.avgEngagementRate * 100).toFixed(1)}%(${row.postCount}件の実績)`;
    });
  const performanceSection =
    topPostTypePerformance.length > 0
      ? `\n\n# 過去の投稿で反応が良かった型(参考情報、最優先はネタとの適合性)\n${topPostTypePerformance.join("\n")}`
      : "";

  try {
    const message = await client.messages.create({
      model: getModel(),
      max_tokens: 1000,
      system:
        "あなたはSNS運用のテーマ選定の専門家です。複数のネタ候補から本日投稿するテーマを1つ選び、直近の投稿とテーマが被っていないかを確認し、最も合う投稿の型と切り口を決定します。必ず submit_theme ツールを呼び出してください。",
      messages: [
        {
          role: "user",
          content: `# ネタ候補\n${notesList}\n\n# 直近の投稿\n${recentList}\n\n# 投稿の型リスト\n${typeList}${performanceSection}${affiliateSection}\n\n上記のネタ候補から本日のテーマを1つ選んでください。直近の投稿と内容が被る場合は、被らない切り口を選ぶか duplicate_check_note で被りをどう避けたかを説明してください。`,
        },
      ],
      tools: [
        {
          name: THEME_TOOL_NAME,
          description: "選定したテーマを構造化データとして提出する。",
          input_schema: {
            type: "object",
            properties: {
              selected_note_index: {
                type: "integer",
                description: "採用したネタ候補のインデックス番号",
              },
              title: {
                type: "string",
                description: "本日投稿するテーマのタイトル",
              },
              angle: {
                type: "string",
                description: "どの切り口で書くかの説明",
              },
              post_type_id: {
                type: "string",
                enum: POST_TYPE_IDS,
                description: "このテーマに最も合う投稿の型ID",
              },
              duplicate_check_note: {
                type: "string",
                description: "直近の投稿と被っていないかの確認結果と理由",
              },
              ...(affiliateLinkIds.length > 0
                ? {
                    affiliate_link_id: {
                      type: "string",
                      enum: [...affiliateLinkIds, NO_AFFILIATE_LINK_ID],
                      description:
                        "このテーマで自然に紹介できるアフィリエイト商品のID。合わなければ none。",
                    },
                  }
                : {}),
            },
            required: [
              "selected_note_index",
              "title",
              "angle",
              "post_type_id",
              "duplicate_check_note",
            ],
          },
        },
      ],
      tool_choice: { type: "tool", name: THEME_TOOL_NAME },
    });

    const toolUseBlock = message.content.find(
      (block) => block.type === "tool_use" && block.name === THEME_TOOL_NAME,
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      return NextResponse.json(
        { error: "テーマ選定結果の取得に失敗しました。もう一度お試しください。" },
        { status: 502 },
      );
    }

    const input = toolUseBlock.input as {
      selected_note_index: number;
      title: string;
      angle: string;
      post_type_id: string;
      duplicate_check_note: string;
      affiliate_link_id?: string;
    };

    const postType = getPostTypeById(input.post_type_id);
    if (!postType) {
      return NextResponse.json(
        { error: "未知の型が返却されました。" },
        { status: 502 },
      );
    }

    const affiliateLinkId =
      input.affiliate_link_id && input.affiliate_link_id !== NO_AFFILIATE_LINK_ID
        ? input.affiliate_link_id
        : undefined;

    const theme: Theme = {
      id: crypto.randomUUID(),
      researchItemId:
        input.selected_note_index >= 0 &&
        input.selected_note_index < researchNotes.length
          ? `note-${input.selected_note_index}`
          : undefined,
      title: input.title,
      angle: input.angle,
      postTypeId: postType.id,
      affiliateLinkId,
      selectedAt: new Date().toISOString(),
      duplicateCheckNote: input.duplicate_check_note,
    };

    const affiliateLink = affiliateLinkId
      ? affiliateLinks.find((link) => link.id === affiliateLinkId)
      : undefined;

    return NextResponse.json({ theme, postType, affiliateLink });
  } catch (error) {
    console.error("Theme selection failed", error);
    const message =
      error instanceof Anthropic.APIError
        ? `Claude APIエラー: ${error.message}`
        : "テーマ選定中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
