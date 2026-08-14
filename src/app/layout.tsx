import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "バズったX投稿 量産ツール",
  description:
    "バズったX投稿のテキストやスクリーンショットから型を分析し、同じ型で新しい投稿を量産します。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <nav className="flex justify-center gap-6 border-b border-gray-200 dark:border-gray-800 px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-300">
          <Link href="/" className="hover:text-gray-900 dark:hover:text-white">
            投稿を量産
          </Link>
          <Link href="/plan" className="hover:text-gray-900 dark:hover:text-white">
            投稿計画
          </Link>
          <Link href="/metrics" className="hover:text-gray-900 dark:hover:text-white">
            実績記録
          </Link>
          <Link href="/analytics" className="hover:text-gray-900 dark:hover:text-white">
            分析
          </Link>
          <Link href="/settings" className="hover:text-gray-900 dark:hover:text-white">
            設定
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
