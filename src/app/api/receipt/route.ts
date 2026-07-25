import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  ACCOUNT_ITEMS,
  ACCOUNT_ITEM_NAMES,
  TAX_CATEGORIES,
  TAX_CATEGORY_VALUES,
} from "@/lib/expense-categories";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const EXTRACTION_TOOL_NAME = "submit_expense";

type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

interface ExtractedExpense {
  date: string;
  vendor: string;
  account_item: string;
  tax_category: string;
  amount: number;
  item: string;
  memo: string;
  confidence: number;
}

function buildAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません。");
  }
  return new Anthropic({ apiKey });
}

const accountItemList = ACCOUNT_ITEMS.map(
  (a) => `- ${a.name}: ${a.description}`,
).join("\n");

const instructionText =
  `この画像は経費精算に使う領収書・レシートです。記載内容を正確に読み取り、` +
  `freee(会計freee)の取引入力に必要な項目を推定して submit_expense ツールで返してください。\n\n` +
  `ルール:\n` +
  `1. date(発生日)は領収書の日付を YYYY-MM-DD 形式で。和暦や「令和」表記も西暦に直す。年が不明なら現在の年を仮定する。\n` +
  `2. vendor(支払先)は店名・会社名。読み取れなければ空文字。\n` +
  `3. amount(税込金額)は合計金額(支払総額)を数値のみで(カンマや円記号なし)。\n` +
  `4. account_item(勘定科目)は下記リストから、購入内容に最も合うものを1つ選ぶ。判断できなければ「雑費」。\n` +
  `5. tax_category(税区分)は、飲食料品など軽減税率対象なら「課対仕入(軽)8%」、通常の課税仕入は「課税仕入10%」、` +
  `   非課税(印紙・保険等)なら「非課税仕入」、それ以外は「対象外」。\n` +
  `6. item(品目)は購入した主な品物・サービスを短く。複数あれば代表的なものをまとめる。\n` +
  `7. memo(備考)には但し書きや用途、読み取り時に注意した点があれば書く。なければ空文字。\n` +
  `8. confidence は読み取り全体の確信度(0〜100の整数)。文字がかすれて読めない等あれば低めにする。\n\n` +
  `勘定科目リスト:\n${accountItemList}`;

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

  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "領収書の画像を選択してください。" },
      { status: 400 },
    );
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `一度にアップロードできるのは${MAX_FILES}枚までです。` },
      { status: 400 },
    );
  }

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error:
            "対応していない画像形式が含まれています。PNG / JPEG / WebP / GIF をご利用ください。",
        },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズが大きすぎます。1枚10MB以下の画像にしてください。" },
        { status: 400 },
      );
    }
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

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const todayIso = new Date().toISOString().slice(0, 10);

  const extractOne = async (file: File): Promise<ExtractedExpense> => {
    const buffer = Buffer.from(await file.arrayBuffer());
    const imageBase64 = buffer.toString("base64");
    const mediaType = file.type as ImageMediaType;

    const message = await client.messages.create({
      model,
      max_tokens: 1024,
      system:
        `あなたは日本の経理担当者です。領収書・レシートの画像を正確に読み取り、` +
        `会計freeeへ登録するための項目を推定します。今日の日付は ${todayIso} です。` +
        `必ず submit_expense ツールを呼び出して結果を返してください。`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: mediaType,
                data: imageBase64,
              },
            },
            { type: "text" as const, text: instructionText },
          ],
        },
      ],
      tools: [
        {
          name: EXTRACTION_TOOL_NAME,
          description:
            "領収書から読み取った、freee取引入力用の経費項目を提出する。",
          input_schema: {
            type: "object",
            properties: {
              date: {
                type: "string",
                description: "発生日 (YYYY-MM-DD)",
              },
              vendor: { type: "string", description: "支払先(店名・会社名)" },
              account_item: {
                type: "string",
                enum: ACCOUNT_ITEM_NAMES,
                description: "勘定科目",
              },
              tax_category: {
                type: "string",
                enum: TAX_CATEGORY_VALUES,
                description: "税区分",
              },
              amount: {
                type: "number",
                description: "税込の合計金額(数値のみ)",
              },
              item: { type: "string", description: "品目(購入した主な内容)" },
              memo: { type: "string", description: "備考・但し書き" },
              confidence: {
                type: "number",
                description: "読み取りの確信度(0〜100)",
              },
            },
            required: [
              "date",
              "vendor",
              "account_item",
              "tax_category",
              "amount",
              "item",
              "memo",
              "confidence",
            ],
          },
        },
      ],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
    });

    const toolUseBlock = message.content.find(
      (block) => block.type === "tool_use" && block.name === EXTRACTION_TOOL_NAME,
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("読み取り結果の取得に失敗しました。");
    }

    const input = toolUseBlock.input as Partial<ExtractedExpense>;

    return {
      date: typeof input.date === "string" ? input.date : "",
      vendor: typeof input.vendor === "string" ? input.vendor : "",
      account_item:
        typeof input.account_item === "string" ? input.account_item : "雑費",
      tax_category:
        typeof input.tax_category === "string"
          ? input.tax_category
          : TAX_CATEGORIES[0],
      amount: Number.isFinite(input.amount) ? Number(input.amount) : 0,
      item: typeof input.item === "string" ? input.item : "",
      memo: typeof input.memo === "string" ? input.memo : "",
      confidence: Number.isFinite(input.confidence)
        ? Number(input.confidence)
        : 0,
    };
  };

  try {
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const expense = await extractOne(file);
          return { fileName: file.name, expense, error: null as string | null };
        } catch (error) {
          return {
            fileName: file.name,
            expense: null,
            error:
              error instanceof Anthropic.APIError
                ? `Claude APIエラー: ${error.message}`
                : error instanceof Error
                  ? error.message
                  : "読み取りに失敗しました。",
          };
        }
      }),
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Receipt extraction failed", error);
    const message =
      error instanceof Anthropic.APIError
        ? `Claude APIエラー: ${error.message}`
        : "読み取り中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
