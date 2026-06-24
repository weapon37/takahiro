"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  DEFAULT_STICKER_COUNT,
  STICKER_COUNT_OPTIONS,
  type StickerCount,
} from "@/lib/line-sticker-spec";

export default function StickerGeneratorForm() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [captionsText, setCaptionsText] = useState("");
  const [count, setCount] = useState<StickerCount>(DEFAULT_STICKER_COUNT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const captionCount = useMemo(
    () =>
      captionsText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0).length,
    [captionsText],
  );

  const canGenerate = Boolean(file) && captionCount >= count && !isLoading;

  function selectFile(selected: File | null) {
    setError(null);
    setDoneMessage(null);
    setFile(selected);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) selectFile(dropped);
  }

  async function handleGenerate() {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setDoneMessage(null);

    try {
      const formData = new FormData();
      formData.append("referenceImage", file);
      formData.append("captions", captionsText);
      formData.append("count", String(count));

      const response = await fetch("/api/stickers/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "スタンプの生成に失敗しました。");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "line-stickers.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setDoneMessage(`${count}枚のスタンプ画像を生成し、ZIPをダウンロードしました。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "スタンプの生成に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
        />
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="アップロードした参照画像のプレビュー"
            className="max-h-60 rounded-lg object-contain shadow-sm"
          />
        ) : (
          <>
            <p className="font-medium text-gray-700">
              キャラクターの参照画像をドラッグ&ドロップ
            </p>
            <p className="text-sm text-gray-500">
              またはクリックして選択 (PNG / JPEG / WebP, 10MBまで)
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="captions" className="font-medium text-gray-700">
          セリフ・キャプション一覧（1行に1つ）
        </label>
        <textarea
          id="captions"
          value={captionsText}
          onChange={(e) => setCaptionsText(e.target.value)}
          placeholder={"ありがとう\nおつかれさま\nおはよう\nごめんね\n了解！"}
          rows={8}
          className="rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
        />
        <p
          className={`text-sm ${
            captionCount >= count ? "text-gray-500" : "text-red-600"
          }`}
        >
          入力済み {captionCount} / 必要 {count} 個
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="count" className="font-medium text-gray-700">
          スタンプ枚数
        </label>
        <select
          id="count"
          value={count}
          onChange={(e) => setCount(Number(e.target.value) as StickerCount)}
          className="rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
        >
          {STICKER_COUNT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}枚
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {isLoading
          ? "生成中... (枚数によって数分かかります)"
          : `${count}枚のスタンプを生成してZIPをダウンロード`}
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {doneMessage && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          {doneMessage}
        </p>
      )}
    </div>
  );
}
