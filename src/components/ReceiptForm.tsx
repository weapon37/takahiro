"use client";

import { useRef, useState, type DragEvent } from "react";
import {
  ACCOUNT_ITEM_NAMES,
  TAX_CATEGORIES,
} from "@/lib/expense-categories";

interface ExpenseRow {
  date: string;
  vendor: string;
  account_item: string;
  tax_category: string;
  amount: number;
  item: string;
  memo: string;
  confidence: number;
  fileName: string;
}

interface ApiResult {
  fileName: string;
  expense: Omit<ExpenseRow, "fileName"> | null;
  error: string | null;
}

const MAX_FILES = 10;

const CSV_HEADERS = [
  "発生日",
  "支払先",
  "勘定科目",
  "税区分",
  "金額(税込)",
  "品目",
  "備考",
];

function toCsv(rows: ExpenseRow[]): string {
  const escape = (value: string | number) => {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.vendor,
        r.account_item,
        r.tax_category,
        r.amount,
        r.item,
        r.memo,
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

export default function ReceiptForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [failed, setFailed] = useState<ApiResult[]>([]);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function addFiles(selected: FileList | null) {
    if (!selected) return;
    const incoming = Array.from(selected);
    setFiles((prev) => {
      const merged = [...prev, ...incoming].slice(0, MAX_FILES);
      return merged;
    });
    setPreviews((prev) => {
      const urls = incoming.map((f) => URL.createObjectURL(f));
      return [...prev, ...urls].slice(0, MAX_FILES);
    });
    setError(null);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  async function handleExtract() {
    if (files.length === 0) return;
    setIsLoading(true);
    setError(null);
    setRows([]);
    setFailed([]);

    try {
      const formData = new FormData();
      for (const file of files) formData.append("images", file);

      const response = await fetch("/api/receipt", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "読み取りに失敗しました。");
      }

      const results = data.results as ApiResult[];
      const ok: ExpenseRow[] = [];
      const ng: ApiResult[] = [];
      for (const r of results) {
        if (r.expense) ok.push({ ...r.expense, fileName: r.fileName });
        else ng.push(r);
      }
      setRows(ok);
      setFailed(ng);
      if (ok.length === 0) {
        setError("領収書を読み取れませんでした。画像が鮮明かご確認ください。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み取りに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }

  function updateRow(index: number, patch: Partial<ExpenseRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function downloadCsv() {
    // freeeの取引インポートは Shift_JIS を想定しているため BOM 付き UTF-8 でExcel互換にする
    const csv = toCsv(rows);
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `freee_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyCsv() {
    await navigator.clipboard.writeText(toCsv(rows));
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500);
  }

  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      {/* アップロード領域 */}
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
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <p className="font-medium text-gray-700 dark:text-gray-200">
          領収書・レシートの画像をドラッグ&ドロップ
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          またはクリックして選択 (PNG / JPEG / WebP / GIF, 1枚10MBまで, 最大
          {MAX_FILES}枚)
        </p>
      </div>

      {/* 選択済み画像のプレビュー */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {files.map((file, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[i]}
                alt={file.name}
                className="h-24 w-24 rounded-lg border border-gray-200 dark:border-gray-700 object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-xs text-white shadow hover:bg-gray-700"
                aria-label="削除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleExtract}
        disabled={isLoading || files.length === 0}
        className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
      >
        {isLoading
          ? "読み取り中..."
          : `領収書を読み取る (${files.length}枚)`}
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {failed.length > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">読み取れなかった画像:</p>
          <ul className="mt-1 list-disc pl-5">
            {failed.map((f, i) => (
              <li key={i}>
                {f.fileName} — {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">
              読み取り結果 ({rows.length}件) ・ 合計 ¥{total.toLocaleString()}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyCsv}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {copied ? "コピーしました!" : "CSVをコピー"}
              </button>
              <button
                type="button"
                onClick={downloadCsv}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-green-500"
              >
                freee用CSVをダウンロード
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            各項目はセルをクリックして修正できます。確認・修正のうえ、CSVを
            freeeの「取引の一括登録(インポート)」に取り込んでください。
          </p>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-left text-gray-600 dark:text-gray-300">
                  <th className="p-2 font-medium">発生日</th>
                  <th className="p-2 font-medium">支払先</th>
                  <th className="p-2 font-medium">勘定科目</th>
                  <th className="p-2 font-medium">税区分</th>
                  <th className="p-2 font-medium text-right">金額(税込)</th>
                  <th className="p-2 font-medium">品目</th>
                  <th className="p-2 font-medium">備考</th>
                  <th className="p-2 font-medium text-center">確信度</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-200 dark:border-gray-700 align-top"
                  >
                    <td className="p-1">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateRow(i, { date: e.target.value })}
                        className="w-36 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.vendor}
                        onChange={(e) =>
                          updateRow(i, { vendor: e.target.value })
                        }
                        className="w-32 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="p-1">
                      <select
                        value={row.account_item}
                        onChange={(e) =>
                          updateRow(i, { account_item: e.target.value })
                        }
                        className="w-32 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                      >
                        {ACCOUNT_ITEM_NAMES.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1">
                      <select
                        value={row.tax_category}
                        onChange={(e) =>
                          updateRow(i, { tax_category: e.target.value })
                        }
                        className="w-32 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                      >
                        {TAX_CATEGORIES.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={row.amount}
                        onChange={(e) =>
                          updateRow(i, { amount: Number(e.target.value) })
                        }
                        className="w-24 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-right text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.item}
                        onChange={(e) => updateRow(i, { item: e.target.value })}
                        className="w-36 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.memo}
                        onChange={(e) => updateRow(i, { memo: e.target.value })}
                        className="w-36 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.confidence >= 80
                            ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                            : row.confidence >= 50
                              ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                              : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                        }`}
                        title="AIの読み取り確信度"
                      >
                        {row.confidence}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
