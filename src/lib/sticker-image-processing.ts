import sharp from "sharp";
import {
  MAIN_IMAGE_SIZE,
  STICKER_IMAGE_SIZE,
  STICKER_MARGIN_PX,
  TAB_IMAGE_SIZE,
} from "./line-sticker-spec";

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function fitToFrame(
  source: Buffer,
  frame: { width: number; height: number },
  marginPx: number,
): Promise<Buffer> {
  const innerWidth = frame.width - marginPx * 2;
  const innerHeight = frame.height - marginPx * 2;

  const resized = await sharp(source)
    .resize(innerWidth, innerHeight, {
      fit: "contain",
      background: TRANSPARENT,
    })
    .png()
    .toBuffer();

  return sharp(resized)
    .extend({
      top: marginPx,
      bottom: marginPx,
      left: marginPx,
      right: marginPx,
      background: TRANSPARENT,
    })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// LINE スタンプ画像は、トリミングで欠けないよう端から余白を空ける必要がある。
export function toStickerPng(source: Buffer): Promise<Buffer> {
  return fitToFrame(source, STICKER_IMAGE_SIZE, STICKER_MARGIN_PX);
}

export function toMainPng(source: Buffer): Promise<Buffer> {
  return fitToFrame(source, MAIN_IMAGE_SIZE, 0);
}

export function toTabPng(source: Buffer): Promise<Buffer> {
  return fitToFrame(source, TAB_IMAGE_SIZE, 0);
}
