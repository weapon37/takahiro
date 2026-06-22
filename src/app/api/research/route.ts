import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildAnthropicClient, getModel } from "@/lib/anthropic-client";
import { POST_TYPE_IDS } from "@/lib/post-types";
import { addResearchItem, listResearchItems } from "@/lib/store";
import type { Platform, ResearchItem } from "@/lib/pipeline-types";

export const runtime = "nodejs";

const RESEARCH_TOOL_NAME = "submit_research_items";
const PLATFORMS: Platform[] = ["x", "threads", "instagram", "youtube"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const researchItems = await listResearchItems(
    status === "new" || status === "used" || status === "archived"
      ? status
      : undefined,
  );
  return NextResponse.json({ researchItems });
}

export async function POST(request: Request) {
  let body: { topic?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) {
    return NextResponse.json(
      { error: "リサーチするテーマ・ジャンルを入力してください。" },
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

  try {
    const message = await client.messages.create({
      model: getModel(),
      max_tokens: 1500,
      system:
        "あなたはSNSマーケティングのリサーチ専門家です。web_searchツールを使って、指定されたジャンルで直近伸びている競合・関連投稿を調査し、ネタになりそうな事例を集めます。調査が終わったら必ず submit_research_items ツールを呼び出してください。",
      messages: [
        {
          role: "user",
          content: `# ジャンル・テーマ\n${topic}\n\n上記のジャンルについて、X(旧Twitter)・Threads・Instagram・YouTubeで直近伸びている投稿や話題を3〜5件調査し、SNS投稿のネタとして使えそうな形で要約してください。出典のURL・投稿者名がわかる場合はそれも含めてください。`,
        },
      ],
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: 3 },
        {
          name: RESEARCH_TOOL_NAME,
          description: "調査結果のネタ一覧を構造化データとして提出する。",
          input_schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    platform: { type: "string", enum: PLATFORMS },
                    source_url: { type: "string", description: "出典URL。不明な場合は空文字。" },
                    source_author: {
                      type: "string",
                      description: "投稿者・発信元の名称。不明な場合は空文字。",
                    },
                    summary: {
                      type: "string",
                      description: "ネタとして使える形に要約した内容。",
                    },
                    post_type_id: {
                      type: "string",
                      enum: POST_TYPE_IDS,
                      description: "この投稿に合う型(推測できる場合のみ指定)",
                    },
                    likes: { type: "integer", description: "いいね数(不明な場合は0)" },
                    comments: { type: "integer", description: "コメント数(不明な場合は0)" },
                    shares: { type: "integer", description: "シェア・リポスト数(不明な場合は0)" },
                  },
                  required: ["platform", "source_url", "source_author", "summary"],
                },
              },
            },
            required: ["items"],
          },
        },
      ],
      tool_choice: { type: "auto" },
    });

    const toolUseBlock = message.content.find(
      (block) => block.type === "tool_use" && block.name === RESEARCH_TOOL_NAME,
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      return NextResponse.json(
        { error: "リサーチ結果の取得に失敗しました。もう一度お試しください。" },
        { status: 502 },
      );
    }

    const input = toolUseBlock.input as {
      items: {
        platform: string;
        source_url: string;
        source_author: string;
        summary: string;
        post_type_id?: string;
        likes?: number;
        comments?: number;
        shares?: number;
      }[];
    };

    const researchItems: ResearchItem[] = [];
    for (const item of input.items) {
      if (!PLATFORMS.includes(item.platform as Platform) || !item.summary) continue;
      const researchItem = await addResearchItem({
        platform: item.platform as Platform,
        sourceUrl: item.source_url || "",
        sourceAuthor: item.source_author || "",
        summary: item.summary,
        postTypeId: POST_TYPE_IDS.includes(item.post_type_id as never)
          ? (item.post_type_id as ResearchItem["postTypeId"])
          : undefined,
        engagement: {
          likes: item.likes ?? 0,
          comments: item.comments ?? 0,
          shares: item.shares ?? 0,
        },
      });
      researchItems.push(researchItem);
    }

    if (researchItems.length === 0) {
      return NextResponse.json(
        { error: "ネタが見つかりませんでした。テーマを変えてもう一度お試しください。" },
        { status: 502 },
      );
    }

    return NextResponse.json({ researchItems });
  } catch (error) {
    console.error("Research failed", error);
    const message =
      error instanceof Anthropic.APIError
        ? `Claude APIエラー: ${error.message}`
        : "リサーチ中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
