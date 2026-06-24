import JSZip from "jszip";
import { stickerFileName } from "./line-sticker-spec";

export async function buildStickerZip(params: {
  main: Buffer;
  tab: Buffer;
  stickers: Buffer[];
}): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("main.png", params.main);
  zip.file("tab.png", params.tab);
  params.stickers.forEach((buffer, i) => {
    zip.file(stickerFileName(i + 1), buffer);
  });

  return zip.generateAsync({ type: "nodebuffer" });
}
