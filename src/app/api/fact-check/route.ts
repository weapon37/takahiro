import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildAnthropicClient, getModel } from "@/lib/anthropic-client";
import type { Post, FactCheckResult } from "@/lib/pipeline-types";

export const runtime = "nodejs";

const FACT_CHECK_TOOL_NAME = "submit_fact_check";

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
  if (!post || !post.body) {
    return NextResponse.json(
      { error: "投稿本文が不足しています。" },
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
        "あなたはファクトチェック専門のリサーチエージェントです。投稿文中の数字・固有名詞・統計などに誤りがないか、必要であればweb_searchツールで最新情報を確認してください。誤りがあれば修正し、抽象的な表現があればより具体的な情報への書き換えも行ってください。確認が終わったら必ず submit_fact_check ツールを呼び出してください。",
      messages: [
        {
          role: "user",
          content: `以下の投稿本文をファクトチェックしてください。\n\n${post.body}`,
        },
      ],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
        },
        {
          name: FACT_CHECK_TOOL_NAME,
          description: "ファクトチェックの結果を構造化データとして提出する。",
          input_schema: {
            type: "object",
            properties: {
              corrected_body: {
                type: "string",
                description: "修正後の投稿本文(誤りがなければ元の本文と同じ)",
              },
              issues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    original: { type: "string" },
                    corrected: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["original", "corrected", "reason"],
                },
                description: "修正した箇所のリスト。修正がなければ空配列。",
              },
            },
            required: ["corrected_body", "issues"],
          },
        },
      ],
      tool_choice: { type: "auto" },
    });

    const toolUseBlock = message.content.find(
      (block) =>
        block.type === "tool_use" && block.name === FACT_CHECK_TOOL_NAME,
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      return NextResponse.json(
        { error: "ファクトチェック結果の取得に失敗しました。もう一度お試しください。" },
        { status: 502 },
      );
    }

    const input = toolUseBlock.input as {
      corrected_body: string;
      issues: { original: string; corrected: string; reason: string }[];
    };

    const factCheckResult: FactCheckResult = {
      id: crypto.randomUUID(),
      postId: post.id,
      issues: input.issues,
      checkedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      factCheckResult,
      correctedBody: input.corrected_body,
    });
  } catch (error) {
    console.error("Fact check failed", error);
    const message =
      error instanceof Anthropic.APIError
        ? `Claude APIエラー: ${error.message}`
        : "ファクトチェック中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
