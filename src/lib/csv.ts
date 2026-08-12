/** 1セル分の値をCSVとしてエスケープする。 */
function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 量産した投稿を、予約投稿ツールに取り込める形のCSV文字列にする。
 * 投稿予定日は翌日から1日1件で埋めておき、あとから表計算ソフトで調整できるようにする。
 */
export function buildPostsCsv(posts: string[], typeLabel: string): string {
  const header = ["No", "投稿予定日", "本文", "文字数", "型"];
  const rows = posts.map((post, i) => {
    const scheduled = new Date();
    scheduled.setDate(scheduled.getDate() + i + 1);
    return [
      String(i + 1),
      formatDate(scheduled),
      post,
      String([...post].length),
      typeLabel,
    ];
  });

  return [header, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
}

/** Excelで文字化けしないよう、BOM付きUTF-8でCSVをダウンロードさせる。 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([`﻿${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
