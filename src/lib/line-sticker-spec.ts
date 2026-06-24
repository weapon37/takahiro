export const STICKER_COUNT_OPTIONS = [8, 16, 24, 32, 40] as const;
export type StickerCount = (typeof STICKER_COUNT_OPTIONS)[number];

export const DEFAULT_STICKER_COUNT: StickerCount = 16;

export const MAIN_IMAGE_SIZE = { width: 240, height: 240 } as const;
export const TAB_IMAGE_SIZE = { width: 96, height: 74 } as const;
export const STICKER_IMAGE_SIZE = { width: 370, height: 320 } as const;

// LINE requires sticker artwork to keep a margin from the trimmed edge so it
// isn't clipped by the rounded sticker mask.
export const STICKER_MARGIN_PX = 10;

export const MAX_IMAGE_BYTES = 1024 * 1024; // 1MB per image, per LINE guidelines

export function isValidStickerCount(value: number): value is StickerCount {
  return (STICKER_COUNT_OPTIONS as readonly number[]).includes(value);
}

export function stickerFileName(index: number): string {
  return `${String(index).padStart(2, "0")}.png`;
}
