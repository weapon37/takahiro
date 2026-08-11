import type { RoutePoint } from "./types";

export function parseGpx(xmlText: string): { name?: string; points: RoutePoint[] } {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");

  if (doc.querySelector("parsererror")) {
    throw new Error(
      "GPXファイルの解析に失敗しました。ファイルが破損している可能性があります。"
    );
  }

  let nodes = Array.from(doc.querySelectorAll("trkpt"));
  if (nodes.length === 0) nodes = Array.from(doc.querySelectorAll("rtept"));
  if (nodes.length === 0) nodes = Array.from(doc.querySelectorAll("wpt"));

  const points: RoutePoint[] = nodes
    .map((node) => {
      const lat = parseFloat(node.getAttribute("lat") ?? "");
      const lon = parseFloat(node.getAttribute("lon") ?? "");
      const eleText = node.querySelector("ele")?.textContent;
      const ele = eleText ? parseFloat(eleText) : undefined;
      return {
        lat,
        lon,
        ele: ele !== undefined && !Number.isNaN(ele) ? ele : undefined,
      };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  if (points.length < 2) {
    throw new Error("GPXファイルからコースの座標が見つかりませんでした。");
  }

  const name =
    doc.querySelector("trk > name")?.textContent?.trim() ||
    doc.querySelector("metadata > name")?.textContent?.trim() ||
    undefined;

  return { name: name || undefined, points };
}
