import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "X投稿スクショ型分析ツール",
  description: "バズったX投稿のスクリーンショットから投稿の型を分析します。",
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
      <body className="min-h-full flex flex-col">
        <nav className="flex justify-center gap-6 border-b border-gray-200 px-6 py-4 text-sm font-medium text-gray-600">
          <Link href="/" className="hover:text-blue-600">
            X投稿スクショ型分析ツール
          </Link>
          <Link href="/sticker" className="hover:text-blue-600">
            LINEスタンプ量産ツール
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
