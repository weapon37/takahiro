"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseGpx } from "@/lib/marathon/gpx";
import { buildCourse } from "@/lib/marathon/course";
import type { RoutePoint } from "@/lib/marathon/types";
import StreetViewPanel from "./StreetViewPanel";
import MiniMap from "./MiniMap";

const INTERVAL_OPTIONS = [
  { label: "100m ごと(詳細)", value: 100 },
  { label: "200m ごと(標準)", value: 200 },
  { label: "500m ごと(ざっくり)", value: 500 },
];

const ENV_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const API_KEY_STORAGE_KEY = "marathon-gmaps-key";

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

function formatHeading(heading: number): string {
  const dirs = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
  return dirs[Math.round(heading / 45) % 8];
}

export default function CourseSimulator() {
  const [apiKey, setApiKey] = useState(() => {
    if (ENV_API_KEY) return ENV_API_KEY;
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
  });
  const [intervalM, setIntervalM] = useState(200);
  const [rawCourseData, setRawCourseData] = useState<{
    points: RoutePoint[];
    name?: string;
  } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleApiKeyChange(value: string) {
    setApiKey(value);
    if (!ENV_API_KEY) window.sessionStorage.setItem(API_KEY_STORAGE_KEY, value);
  }

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const { name, points } = parseGpx(text);
      setRawCourseData({ points, name });
      setCurrentIndex(0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "GPXファイルの読み込みに失敗しました。"
      );
      setRawCourseData(null);
    }
  }

  const course = useMemo(() => {
    if (!rawCourseData) return null;
    return buildCourse(rawCourseData.points, intervalM, rawCourseData.name);
  }, [rawCourseData, intervalM]);

  const clampedIndex = course ? Math.min(currentIndex, course.steps.length - 1) : 0;
  const step = course?.steps[clampedIndex] ?? null;

  const goPrev = useCallback(() => setCurrentIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () =>
      setCurrentIndex((i) => (course ? Math.min(course.steps.length - 1, i + 1) : i)),
    [course]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev]);

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          マラソンコース 事前シミュレーター
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          GPXファイルを読み込むと、コースに沿ってストリートビューを順番に確認できます。ロケ前の下見・予習用の試作版です。
        </p>
      </div>

      {!ENV_API_KEY && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
          <label className="font-medium" htmlFor="gmaps-key">
            Google Maps APIキー(Maps JavaScript API / Street View を有効化したもの)
          </label>
          <input
            id="gmaps-key"
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder="AIza..."
            className="rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          />
          <p className="text-xs text-gray-500">
            このブラウザのセッション内にのみ保存されます。本番運用では環境変数
            <code className="mx-1 rounded bg-gray-200 px-1 dark:bg-gray-800">
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            </code>
            の設定を推奨します。
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900">
          GPXファイルを選択
          <input
            type="file"
            accept=".gpx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>
        {fileName && <span className="text-sm text-gray-500">{fileName}</span>}

        <label className="ml-auto flex items-center gap-2 text-sm">
          区間の間隔
          <select
            value={intervalM}
            onChange={(e) => setIntervalM(Number(e.target.value))}
            className="rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
          >
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {course && step && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="h-[420px]">
              {apiKey ? (
                <StreetViewPanel apiKey={apiKey} step={step} />
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500 dark:bg-gray-900">
                  Google Maps APIキーを入力してください
                </div>
              )}
            </div>
            <div className="flex flex-col gap-4">
              <div className="h-[220px]">
                {apiKey ? (
                  <MiniMap
                    apiKey={apiKey}
                    steps={course.steps}
                    currentIndex={clampedIndex}
                    onSelectStep={setCurrentIndex}
                  />
                ) : (
                  <div className="h-full rounded-lg bg-gray-100 dark:bg-gray-900" />
                )}
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-gray-200 p-4 text-sm dark:border-gray-800">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {step.turnLabel}
                </div>
                <div className="text-gray-600 dark:text-gray-300">
                  {formatDistance(step.distanceM)} 地点 / 全{formatDistance(course.totalDistanceM)}
                </div>
                <div className="text-gray-600 dark:text-gray-300">
                  進行方向: {formatHeading(step.heading)}({Math.round(step.heading)}°)
                </div>
                {step.ele !== undefined && (
                  <div className="text-gray-600 dark:text-gray-300">
                    標高: {Math.round(step.ele)} m
                  </div>
                )}
                <div className="text-xs text-gray-400">
                  {step.lat.toFixed(5)}, {step.lon.toFixed(5)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <input
              type="range"
              min={0}
              max={course.steps.length - 1}
              value={clampedIndex}
              onChange={(e) => setCurrentIndex(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={goPrev}
                disabled={clampedIndex === 0}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                ← 前へ
              </button>
              <span className="text-sm text-gray-500">
                {clampedIndex + 1} / {course.steps.length}
              </span>
              <button
                onClick={goNext}
                disabled={clampedIndex === course.steps.length - 1}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                次へ →
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700">
        <div className="font-medium text-gray-700 dark:text-gray-300">
          今後追加予定の機能
        </div>
        <ul className="mt-1 list-disc pl-5">
          <li>撮影ポイントのメモ</li>
          <li>車で先回りできそうな場所</li>
          <li>トイレ・駐車場の位置</li>
          <li>高低差グラフ</li>
        </ul>
      </div>
    </div>
  );
}
