import { NextResponse } from "next/server";
import {
  DEFAULT_STICKER_COUNT,
  isValidStickerCount,
  STICKER_COUNT_OPTIONS,
} from "@/lib/line-sticker-spec";
import { generateStickerImage, type ReferenceImage } from "@/lib/gemini-image";
import {
  toMainPng,
  toStickerPng,
  toTabPng,
} from "@/lib/sticker-image-processing";
import { buildStickerZip } from "@/lib/sticker-zip";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const GENERATION_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await fn(items[current], current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );

  return results;
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

  const file = formData.get("referenceImage");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "参照画像が見つかりません。" },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error: "対応していない画像形式です。PNG / JPEG / WebP をご利用ください。",
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

  const countRaw = Number(formData.get("count") ?? DEFAULT_STICKER_COUNT);
  if (!isValidStickerCount(countRaw)) {
    return NextResponse.json(
      {
        error: `スタンプ枚数は ${STICKER_COUNT_OPTIONS.join(" / ")} のいずれかを指定してください。`,
      },
      { status: 400 },
    );
  }

  const captionsRaw = String(formData.get("captions") ?? "");
  const captions = captionsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (captions.length < countRaw) {
    return NextResponse.json(
      {
        error: `セリフ・キャプションを${countRaw}個以上入力してください（現在${captions.length}個）。`,
      },
      { status: 400 },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が設定されていません。" },
      { status: 500 },
    );
  }

  const selectedCaptions = captions.slice(0, countRaw);

  const buffer = Buffer.from(await file.arrayBuffer());
  const reference: ReferenceImage = {
    base64: buffer.toString("base64"),
    mimeType: file.type,
  };

  let rawStickerBuffers: Buffer[];
  try {
    rawStickerBuffers = await mapWithConcurrency(
      selectedCaptions,
      GENERATION_CONCURRENCY,
      (caption) => generateStickerImage(reference, caption),
    );
  } catch (error) {
    console.error("Sticker generation failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "スタンプ画像の生成に失敗しました。",
      },
      { status: 502 },
    );
  }

  try {
    const [stickers, main, tab] = await Promise.all([
      Promise.all(rawStickerBuffers.map((buf) => toStickerPng(buf))),
      toMainPng(rawStickerBuffers[0]),
      toTabPng(rawStickerBuffers[0]),
    ]);

    const zip = await buildStickerZip({ main, tab, stickers });

    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="line-stickers.zip"',
      },
    });
  } catch (error) {
    console.error("Sticker packaging failed", error);
    return NextResponse.json(
      { error: "スタンプ画像の加工・パッケージングに失敗しました。" },
      { status: 500 },
    );
  }
}
