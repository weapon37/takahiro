"use client";

import { useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { ShortVideo } from "@/remotion/compositions/ShortVideo";
import { sampleShortVideo } from "@/remotion/data/sample";
import { getTotalDuration, shortVideoSchema, type ShortVideoProps } from "@/remotion/schema";
import { themeNames } from "@/remotion/theme";

const FPS = 30;

type Format = "short" | "wide";

const FORMATS: Record<Format, { label: string; width: number; height: number }> = {
  short: { label: "縦 1080×1920", width: 1080, height: 1920 },
  wide: { label: "横 1920×1080", width: 1920, height: 1080 },
};

/**
 * ブラウザ上で動画を確認するためのプレビュー。
 * Remotion Studio を立ち上げずに構成を試したいときに使う。
 * ここで作った JSON はそのまま `--props` に渡せる。
 */
export default function VideoPreview() {
  const [draft, setDraft] = useState(() => JSON.stringify(sampleShortVideo, null, 2));
  const [props, setProps] = useState<ShortVideoProps>(sampleShortVideo);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("short");
  const [copied, setCopied] = useState(false);

  const durationInFrames = useMemo(() => getTotalDuration(props, FPS), [props]);
  const size = FORMATS[format];

  const apply = () => {
    try {
      const parsed = shortVideoSchema.parse(JSON.parse(draft));
      setProps(parsed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const setTheme = (theme: ShortVideoProps["theme"]) => {
    const next = { ...props, theme };
    setProps(next);
    setDraft(JSON.stringify(next, null, 2));
  };

  const copyProps = async () => {
    await navigator.clipboard.writeText(JSON.stringify(props));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(FORMATS) as Format[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormat(key)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                format === key
                  ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                  : "border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"
              }`}
            >
              {FORMATS[key].label}
            </button>
          ))}
          <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            {(durationInFrames / FPS).toFixed(1)} 秒 / {durationInFrames} フレーム
          </span>
        </div>

        {/* 縦動画は画面からはみ出しやすいので幅を抑える */}
        <div className={format === "short" ? "mx-auto w-full max-w-[340px]" : "w-full"}>
          <Player
            component={ShortVideo}
            inputProps={props}
            durationInFrames={durationInFrames}
            fps={FPS}
            compositionWidth={size.width}
            compositionHeight={size.height}
            style={{ width: "100%", borderRadius: 16, overflow: "hidden" }}
            controls
            loop
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {themeNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTheme(name)}
              className={`rounded-md border px-3 py-1 text-sm transition ${
                props.theme === name
                  ? "border-gray-900 font-semibold dark:border-white"
                  : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <label
          htmlFor="props"
          className="text-sm font-semibold text-gray-900 dark:text-white"
        >
          動画の中身 (JSON)
        </label>
        <textarea
          id="props"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
          className="h-[520px] w-full resize-none rounded-lg border border-gray-300 bg-white p-3 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        {error ? (
          <p className="whitespace-pre-wrap text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={apply}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-gray-900"
          >
            プレビューに反映
          </button>
          <button
            type="button"
            onClick={copyProps}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
          >
            {copied ? "コピーしました" : "props JSON をコピー"}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          コピーした JSON を props.json に保存すると
          <code className="mx-1">npx remotion render ShortVideo out/short.mp4 --props=props.json</code>
          で同じ動画を書き出せます。
        </p>
      </div>
    </div>
  );
}
