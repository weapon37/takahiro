import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { POST_TYPES, POST_TYPE_IDS, getPostTypeById } from "@/lib/post-types";
import { buildAnthropicClient, getModel } from "@/lib/anthropic-client";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const ANALYSIS_TOOL_NAME = "submit_analysis";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "画像ファイルが見つかりません。" },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "対応していない画像形式です。PNG / JPEG / WebP / GIF をご利用ください。" },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "ファイルサイズが大きすぎます。10MB以下の画像を選択してください。" },
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64Image = buffer.toString("base64");

  const typeList = POST_TYPES.map(
    (t) => `- ${t.id}: ${t.label} — ${t.description}`,
  ).join("\n");

  try {
    const message = await client.messages.create({
      model: getModel(),
      max_tokens: 1500,
      system:
        "あなたはSNSマーケティングとバイラルコンテンツ分析の専門家です。X(旧Twitter)のバズった投稿のスクリーンショットを見て、投稿の「型」を分析します。必ず submit_analysis ツールを呼び出して結果を返してください。",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.type as
                  | "image/png"
                  | "image/jpeg"
                  | "image/webp"
                  | "image/gif",
                data: base64Image,
              },
            },
            {
              type: "text",
              text: `この画像はX(旧Twitter)でバズった投稿のスクリーンショットです。以下の型リストの中から最も当てはまる型(detected_type_id)を1つ選び、次に当てはまる型があれば secondary_type_id に入れてください(なければ null)。\n\n型リスト:\n${typeList}\n\n画像から読み取れる投稿本文をできるだけ正確に extracted_text に書き出し、いいね数・リポスト数・表示回数など見える数値があれば engagement_signals にまとめてください。なぜこの型に分類したのかを reasoning に説明し、この投稿がバズった要因を viral_factors に2〜4個の箇条書きで挙げてください。`,
            },
          ],
        },
      ],
      tools: [
        {
          name: ANALYSIS_TOOL_NAME,
          description: "X投稿スクリーンショットの分析結果を構造化データとして提出する。",
          input_schema: {
            type: "object",
            properties: {
              detected_type_id: {
                type: "string",
                enum: POST_TYPE_IDS,
                description: "最も当てはまる投稿の型ID",
              },
              secondary_type_id: {
                type: ["string", "null"],
                enum: [...POST_TYPE_IDS, null],
                description: "次に当てはまる投稿の型ID。なければnull",
              },
              confidence: {
                type: "number",
                description: "分類の確信度(0〜100の整数)",
              },
              extracted_text: {
                type: "string",
                description: "画像から読み取った投稿本文",
              },
              engagement_signals: {
                type: "string",
                description: "画像から読み取れるいいね数・リポスト数・表示回数などのまとめ。読み取れない場合は空文字。",
              },
              reasoning: {
                type: "string",
                description: "この型に分類した理由の説明",
              },
              viral_factors: {
                type: "array",
                items: { type: "string" },
                description: "バズった要因の箇条書き(2〜4個)",
              },
            },
            required: [
              "detected_type_id",
              "confidence",
              "extracted_text",
              "reasoning",
              "viral_factors",
            ],
          },
        },
      ],
      tool_choice: { type: "tool", name: ANALYSIS_TOOL_NAME },
    });

    const toolUseBlock = message.content.find(
      (block) => block.type === "tool_use" && block.name === ANALYSIS_TOOL_NAME,
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      return NextResponse.json(
        { error: "分析結果の取得に失敗しました。もう一度お試しください。" },
        { status: 502 },
      );
    }

    const input = toolUseBlock.input as {
      detected_type_id: string;
      secondary_type_id?: string | null;
      confidence: number;
      extracted_text: string;
      engagement_signals?: string;
      reasoning: string;
      viral_factors: string[];
    };

    const detectedType = getPostTypeById(input.detected_type_id);
    const secondaryType = input.secondary_type_id
      ? getPostTypeById(input.secondary_type_id)
      : undefined;

    if (!detectedType) {
      return NextResponse.json(
        { error: "未知の型が返却されました。" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      detectedType,
      secondaryType: secondaryType ?? null,
      confidence: input.confidence,
      extractedText: input.extracted_text,
      engagementSignals: input.engagement_signals || "",
      reasoning: input.reasoning,
      viralFactors: input.viral_factors,
    });
  } catch (error) {
    console.error("Analysis failed", error);
    const message =
      error instanceof Anthropic.APIError
        ? `Claude APIエラー: ${error.message}`
        : "分析中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
