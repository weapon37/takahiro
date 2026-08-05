"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// Remotion Player はブラウザ専用なので SSR を切って読み込む。
const VideoPreview = dynamic(() => import("@/components/VideoPreview"), {
  ssr: false,
  loading: () => (
    <p className="text-gray-500 dark:text-gray-400">プレビューを読み込み中...</p>
  ),
});

export default function VideoPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-2xl flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          ショート動画プレビュー
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Remotion で作ったショート動画をブラウザで確認できます。
          JSON を書き換えれば構成をその場で試せます。
        </p>
        <Link
          href="/"
          className="text-sm text-blue-600 underline dark:text-blue-400"
        >
          投稿生成ツールに戻る
        </Link>
      </div>
      <VideoPreview />
    </main>
  );
}
