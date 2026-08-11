"use client";

import { useState } from "react";
import type { StatusSummary } from "@/lib/status";

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        ok
          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green-500" : "bg-gray-400"}`} />
      {label}
    </span>
  );
}

interface SettingsStatusProps {
  initialStatus: StatusSummary;
}

export default function SettingsStatus({ initialStatus }: SettingsStatusProps) {
  const [status, setStatus] = useState<StatusSummary | null>(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initMessage, setInitMessage] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      if (res.ok) setStatus(data as StatusSummary);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInitDb() {
    setIsInitializing(true);
    setInitError(null);
    setInitMessage(null);
    try {
      const res = await fetch("/api/db/init", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "初期化に失敗しました。");
      setInitMessage("テーブルを作成(または確認)しました。");
      await load();
    } catch (err) {
      setInitError(err instanceof Error ? err.message : "初期化に失敗しました。");
    } finally {
      setIsInitializing(false);
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">接続状態</h2>
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
          >
            再読み込み
          </button>
        </div>

        {status && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-200">Anthropic API(投稿生成)</span>
              <Badge ok={status.anthropic.configured} label={status.anthropic.configured ? "設定済み" : "未設定"} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-200">データベース</span>
              <Badge
                ok={status.database.configured && status.database.connected}
                label={
                  !status.database.configured
                    ? "未設定"
                    : status.database.connected
                      ? "接続OK"
                      : "接続エラー"
                }
              />
            </div>
            {status.database.error && (
              <p className="text-xs text-red-600 dark:text-red-400">{status.database.error}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-200">X API(自動投稿)</span>
              <Badge ok={status.x.configured} label={status.x.configured ? "設定済み" : "未設定"} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-200">CRON_SECRET</span>
              <Badge ok={status.cron.secretConfigured} label={status.cron.secretConfigured ? "設定済み" : "未設定"} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
          <button
            type="button"
            onClick={handleInitDb}
            disabled={isInitializing || !status?.database.configured}
            className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
          >
            {isInitializing ? "初期化中..." : "DBテーブルを作成/確認する"}
          </button>
          {initMessage && (
            <p className="text-sm text-green-700 dark:text-green-400">{initMessage}</p>
          )}
          {initError && (
            <p className="text-sm text-red-600 dark:text-red-400">{initError}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm text-sm text-gray-700 dark:text-gray-200">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          環境変数の設定場所(Vercelダッシュボード)
        </h2>
        <p>
          Vercelのプロジェクト → Settings → Environment Variables から、以下をブラウザだけで追加できます。追加後は再デプロイすると反映されます。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li><code>ANTHROPIC_API_KEY</code> — Claudeで投稿・計画を生成するためのキー</li>
          <li><code>DATABASE_URL</code> — Vercel PostgresまたはSupabaseの接続文字列</li>
          <li><code>X_API_KEY</code> / <code>X_API_SECRET</code> — X Developer PortalのアプリKey/Secret</li>
          <li><code>X_ACCESS_TOKEN</code> / <code>X_ACCESS_SECRET</code> — 投稿する自分のXアカウントのAccess Token/Secret</li>
          <li><code>CRON_SECRET</code> — 自動投稿バッチを保護する任意の文字列(自分で決めてOK)</li>
        </ul>
      </div>
    </div>
  );
}
