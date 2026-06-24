import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-2.5-flash-image";

let cachedClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY が設定されていません。");
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

export interface ReferenceImage {
  base64: string;
  mimeType: string;
}

function buildPrompt(caption: string): string {
  return [
    "添付した参照画像のキャラクターのデザイン・配色・画風を厳密に保ったまま、",
    `「${caption}」という気持ちや場面を表すLINEスタンプ用のイラストを1枚生成してください。`,
    "条件:",
    "- 背景は完全に透明な透過PNGにしてください。",
    "- キャラクター単体を画像の中央に大きく配置してください。",
    "- 文字やセリフのテキストは描き込まないでください。",
    "- キャラクターの輪郭が画像の端に接触しないよう、周囲に余白を残してください。",
  ].join("\n");
}

export async function generateStickerImage(
  reference: ReferenceImage,
  caption: string,
): Promise<Buffer> {
  const ai = getClient();
  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(caption) },
          {
            inlineData: {
              mimeType: reference.mimeType,
              data: reference.base64,
            },
          },
        ],
      },
    ],
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error(`「${caption}」の画像生成に失敗しました。`);
  }

  return Buffer.from(imagePart.inlineData.data, "base64");
}
