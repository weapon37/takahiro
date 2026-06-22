"use client";

import { useRef, useState, type DragEvent } from "react";
import type { PostTypeDefinition } from "@/lib/post-types";

type InputMode = "text" | "image";

interface GenerationResult {
  detectedType: PostTypeDefinition;
  confidence: number;
  reasoning: string;
  viralFactors: string[];
  sourceText: string;
  posts: string[];
}

const COUNT_OPTIONS = [5, 10, 15, 20];

export default function PostGeneratorForm() {
  const [mode, setMode] = useState<InputMode>("text");
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [count, setCount] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function switchMode(next: InputMode) {
    setMode(next);
    setError(null);
  }

  function selectFile(selected: File | null) {
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
    if (mode === "text" && pastedText.trim().length === 0) return;
    if (mode === "image" && !file) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("mode", mode);
      formData.append("count", String(count));
      if (mode === "text") {
        formData.append("text", pastedText);
      } else if (file) {
        formData.append("image", file);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "生成に失敗しました。");
      }
      setResult(data as GenerationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }

  function flashCopied(setter: (v: boolean) => void) {
    setter(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setter(false), 1500);
  }

  async function copyPost(text: string, index: number) {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedIndex(null), 1500);
  }

  async function copyAll() {
    if (!result) return;
    await navigator.clipboard.writeText(result.posts.join("\n\n"));
    flashCopied(setCopiedAll);
  }

  const canSubmit =
    !isLoading && (mode === "text" ? pastedText.trim().length > 0 : !!file);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex gap-2 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => switchMode("text")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            mode === "text"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          テキストを貼り付け
        </button>
        <button
          type="button"
          onClick={() => switchMode("image")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            mode === "image"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          スクショをアップロード
        </button>
      </div>

      {mode === "text" ? (
        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder="バズった投稿の本文をここに貼り付けてください"
          rows={6}
          className="w-full resize-none rounded-xl border border-gray-300 p-4 text-sm text-gray-900 outline-none focus:border-blue-500"
        />
      ) : (
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
              <p className="font-medium text-gray-700">
                X投稿のスクリーンショットをドラッグ&ドロップ
              </p>
              <p className="text-sm text-gray-500">
                またはクリックして選択 (PNG / JPEG / WebP / GIF, 10MBまで)
              </p>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <label className="text-sm font-medium text-gray-700">生成する数</label>
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
        >
          {COUNT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}個
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={!canSubmit}
        className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {isLoading ? "量産中..." : "投稿を量産する"}
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 p-6 shadow-sm">
            <div>
              <span className="text-sm text-gray-500">判定された型</span>
              <div className="flex items-baseline gap-3">
                <h2 className="text-xl font-bold text-gray-900">
                  {result.detectedType.label}
                </h2>
                <span className="text-sm font-medium text-blue-600">
                  確信度 {result.confidence}%
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {result.detectedType.description}
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800">バズった要因</h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-gray-700">
                {result.viralFactors.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">
              量産された投稿 ({result.posts.length}個)
            </h3>
            <button
              type="button"
              onClick={copyAll}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {copiedAll ? "コピーしました!" : "全てコピー"}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {result.posts.map((post, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 shadow-sm"
              >
                <p className="whitespace-pre-wrap text-sm text-gray-800">
                  {post}
                </p>
                <button
                  type="button"
                  onClick={() => copyPost(post, i)}
                  className="self-end rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {copiedIndex === i ? "コピーしました!" : "コピー"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
