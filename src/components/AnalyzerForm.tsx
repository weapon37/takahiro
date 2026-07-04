"use client";

import { useRef, useState, type DragEvent } from "react";
import type { PostTypeDefinition } from "@/lib/post-types";

interface AnalysisResult {
  detectedType: PostTypeDefinition;
  secondaryType: PostTypeDefinition | null;
  confidence: number;
  extractedText: string;
  engagementSignals: string;
  reasoning: string;
  viralFactors: string[];
}

export default function AnalyzerForm() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function selectFile(selected: File | null) {
    setResult(null);
    setError(null);
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

  async function handleAnalyze() {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "分析に失敗しました。");
      }
      setResult(data as AnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析に失敗しました。");
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
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
        />
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="アップロードしたスクリーンショットのプレビュー"
            className="max-h-80 rounded-lg object-contain shadow-sm"
          />
        ) : (
          <>
            <p className="font-medium text-gray-800 dark:text-gray-100">
              X投稿のスクリーンショットをドラッグ&ドロップ
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">またはクリックして選択 (PNG / JPEG / WebP / GIF, 10MBまで)</p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handleAnalyze}
        disabled={!file || isLoading}
        className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
      >
        {isLoading ? "分析中..." : "投稿の型を分析する"}
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 p-6 shadow-sm dark:border-gray-700">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">判定された型</span>
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {result.detectedType.label}
              </h2>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                確信度 {result.confidence}%
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {result.detectedType.description}
            </p>
          </div>

          {result.secondaryType && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              次に近い型: {result.secondaryType.label}
            </p>
          )}

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">分類の理由</h3>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
              {result.reasoning}
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">バズった要因</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-gray-700 dark:text-gray-200">
              {result.viralFactors.map((factor, i) => (
                <li key={i}>{factor}</li>
              ))}
            </ul>
          </div>

          {result.engagementSignals && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">読み取れた反応数</h3>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                {result.engagementSignals}
              </p>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">読み取った投稿本文</h3>
            <p className="mt-1 rounded-lg bg-gray-50 p-3 text-sm whitespace-pre-wrap text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {result.extractedText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
