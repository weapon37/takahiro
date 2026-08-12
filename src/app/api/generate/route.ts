import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { POST_TYPES, POST_TYPE_IDS, getPostTypeById } from "@/lib/post-types";
import { DEFAULT_PERSONA, MAX_PERSONA_FIELD_LENGTH } from "@/lib/personas";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_TEXT_LENGTH = 5000;
const MIN_COUNT = 3;
const MAX_COUNT = 20;
const DEFAULT_COUNT = 10;

const GENERATION_TOOL_NAME = "submit_generation";

type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

function buildAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません。");
  }
  return new Anthropic({ apiKey });
}

function clampCount(raw: FormDataEntryValue | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(n)));
}

/**
 * ターゲット・ジャンルの自由入力を取り出す。
 * 未指定や空文字のときは既定のペルソナにフォールバックする。
 */
function readPersonaField(
  raw: FormDataEntryValue | null,
  fallback: string,
): string | { error: string } {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallback;
  if (trimmed.length > MAX_PERSONA_FIELD_LENGTH) {
    return {
      error: `ターゲット・ジャンルは${MAX_PERSONA_FIELD_LENGTH}文字以下で入力してください。`,
    };
  }
  return trimmed;
}

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

  const mode = formData.get("mode");
  if (mode !== "text" && mode !== "image") {
    return NextResponse.json(
      { error: "mode は text または image を指定してください。" },
      { status: 400 },
    );
  }

  const count = clampCount(formData.get("count"));

  const audienceResult = readPersonaField(
    formData.get("audience"),
    DEFAULT_PERSONA.audience,
  );
  if (typeof audienceResult !== "string") {
    return NextResponse.json({ error: audienceResult.error }, { status: 400 });
  }
  const genreResult = readPersonaField(
    formData.get("genre"),
    DEFAULT_PERSONA.genre,
  );
  if (typeof genreResult !== "string") {
    return NextResponse.json({ error: genreResult.error }, { status: 400 });
  }
  const targetAudience = audienceResult;
  const genre = genreResult;

  let imageBase64: string | null = null;
  let imageMediaType: ImageMediaType | null = null;
  let pastedText = "";

  if (mode === "image") {
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "画像ファイルが見つかりません。" },
        { status: 400 },
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error:
            "対応していない画像形式です。PNG / JPEG / WebP / GIF をご利用ください。",
        },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズが大きすぎます。10MB以下の画像を選択してください。" },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    imageBase64 = buffer.toString("base64");
    imageMediaType = file.type as ImageMediaType;
  } else {
    const text = formData.get("text");
    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "投稿テキストを入力してください。" },
        { status: 400 },
      );
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `テキストが長すぎます。${MAX_TEXT_LENGTH}文字以下にしてください。` },
        { status: 400 },
      );
    }
    pastedText = text.trim();
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

  const typeList = POST_TYPES.map(
    (t) => `- ${t.id}: ${t.label} — ${t.description}`,
  ).join("\n");

  const sharedInstructions =
    `1. 型リストの中から最も当てはまる型(detected_type_id)を1つ選んでください。\n` +
    `2. なぜこの投稿がバズったのか、viral_factors に2〜4個の箇条書きで挙げ、reasoning で説明してください。\n` +
    `3. この投稿と同じ「型」「構成」「フック(惹きの作り方)」「文体・テンポ」を踏襲した新しいX投稿を、ちょうど${count}個 generated_posts に作成してください。\n` +
    `   - 内容(トピック・具体例)は、元の投稿のテーマに関わらず、必ず以下のターゲット・ジャンルに合わせて作成してください。\n` +
    `     - ターゲット: ${targetAudience}\n` +
    `     - ジャンル: ${genre}\n` +
    `   - このターゲットが「これは自分のことだ」と感じる悩み・あるある・言葉選びを使い、上記ジャンルの内容に落とし込んでください。\n` +
    `   - 元の投稿の文章をそのまま使ったり、単語を少し変えただけの言い換えにすることは禁止です。型だけを再利用したオリジナルの投稿にしてください。\n` +
    `   - それぞれ独立して、そのままX(旧Twitter)にコピペして投稿できる完成形の日本語の文章にしてください(説明や見出しを付けない)。\n` +
    `   - 1投稿はX投稿として読みやすい長さ(目安300字以内)にしてください。\n` +
    `   - ${count}個が互いに似通わないよう、切り口・具体例・扱うトピックを分散させてください。\n\n` +
    `次の表現は、景品表示法・薬機法に触れるおそれがあるため使わないでください:\n` +
    `   - 「必ず」「絶対に」「誰でも」など、成果や効果を断定・保証する表現\n` +
    `   - 食品・サプリメント・器具について、疾病の治療や予防、身体の機能の改善を示す表現\n` +
    `   - 医学的・科学的な裏付けのない数値や断定的な健康効果の主張\n\n` +
    `型リスト:\n${typeList}`;

  const instructionText =
    mode === "image"
      ? `この画像はX(旧Twitter)でバズった投稿のスクリーンショットです。画像から読み取れる投稿本文を extracted_text に書き出してください。\n\n${sharedInstructions}`
      : `以下はバズったX(旧Twitter)投稿の本文です。\n\n"""\n${pastedText}\n"""\n\n${sharedInstructions}`;

  const content =
    imageBase64 && imageMediaType
      ? [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: imageMediaType,
              data: imageBase64,
            },
          },
          { type: "text" as const, text: instructionText },
        ]
      : [{ type: "text" as const, text: instructionText }];

  try {
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 4096,
      system:
        "あなたはSNSマーケティングとバイラルコンテンツ分析の専門家です。バズったX(旧Twitter)投稿の「型」を分析し、その型を使って新しい投稿を量産します。生成する投稿は元の投稿の文言をそのまま使わず、型・構成・テンポを再現したオリジナルの内容にしてください。必ず submit_generation ツールを呼び出して結果を返してください。",
      messages: [{ role: "user", content }],
      tools: [
        {
          name: GENERATION_TOOL_NAME,
          description:
            "X投稿の型分析結果と、その型に基づいて量産した新規投稿を提出する。",
          input_schema: {
            type: "object",
            properties: {
              detected_type_id: {
                type: "string",
                enum: POST_TYPE_IDS,
                description: "最も当てはまる投稿の型ID",
              },
              confidence: {
                type: "number",
                description: "分類の確信度(0〜100の整数)",
              },
              extracted_text: {
                type: "string",
                description:
                  "画像から読み取った投稿本文。テキスト入力の場合は入力された本文をそのまま書く。",
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
              generated_posts: {
                type: "array",
                items: { type: "string" },
                minItems: count,
                maxItems: count,
                description: `元の投稿と同じ型・構成を踏襲した、新規生成のX投稿。ちょうど${count}個。`,
              },
            },
            required: [
              "detected_type_id",
              "confidence",
              "extracted_text",
              "reasoning",
              "viral_factors",
              "generated_posts",
            ],
          },
        },
      ],
      tool_choice: { type: "tool", name: GENERATION_TOOL_NAME },
    });

    const toolUseBlock = message.content.find(
      (block) => block.type === "tool_use" && block.name === GENERATION_TOOL_NAME,
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      return NextResponse.json(
        { error: "生成結果の取得に失敗しました。もう一度お試しください。" },
        { status: 502 },
      );
    }

    const input = toolUseBlock.input as {
      detected_type_id: string;
      confidence: number;
      extracted_text: string;
      reasoning: string;
      viral_factors: string[];
      generated_posts: string[];
    };

    const detectedType = getPostTypeById(input.detected_type_id);
    if (!detectedType) {
      return NextResponse.json(
        { error: "未知の型が返却されました。" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      detectedType,
      confidence: input.confidence,
      reasoning: input.reasoning,
      viralFactors: input.viral_factors,
      sourceText: mode === "image" ? input.extracted_text : pastedText,
      posts: input.generated_posts,
    });
  } catch (error) {
    console.error("Generation failed", error);
    const message =
      error instanceof Anthropic.APIError
        ? `Claude APIエラー: ${error.message}`
        : "生成中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
