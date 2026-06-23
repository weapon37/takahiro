"use client";

import { useState } from "react";
import type { StyleProfileResult } from "@/lib/style-profile";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-600">{label}</h3>
      <p className="mt-1 text-sm whitespace-pre-wrap text-gray-800">{value}</p>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-600">{label}</h3>
      {items.length > 0 ? (
        <ul className="mt-1 list-disc pl-5 text-sm text-gray-800">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-gray-400">なし</p>
      )}
    </div>
  );
}

export default function StyleProfileForm() {
  const [rawText, setRawText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StyleProfileResult | null>(null);

  async function handleAnalyze() {
    if (!rawText.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/style-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "分析に失敗しました。");
      }
      setResult(data as StyleProfileResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={
            "過去ポストを貼り付けてください。\n各ポストの間は空行、または \"---\" の行で区切ってください。\n\n例:\nポスト1の本文\n---\nポスト2の本文\n---\nポスト3の本文"
          }
          rows={14}
          className="w-full rounded-xl border border-gray-300 p-4 text-sm focus:border-blue-500 focus:outline-none"
        />
        <p className="text-xs text-gray-500">
          最低3件のポストが必要です。区切りがない場合は空行2つで区切ってください。
        </p>
      </div>

      <button
        type="button"
        onClick={handleAnalyze}
        disabled={!rawText.trim() || isLoading}
        className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {isLoading ? "分析中..." : "文体プロファイルを作成する"}
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-gray-500">
            {result.postCount}件のポストを分析しました。
          </p>

          <Section title="1. 基本トーン">
            <ListField
              label="トーンのキーワード"
              items={result.basicTone.toneKeywords}
            />
            <Field label="トーンの説明" value={result.basicTone.toneDescription} />
            <Field label="読者との距離感" value={result.basicTone.readerDistance} />
            <Field
              label="上から目線に見えないための言い回し"
              value={result.basicTone.nonCondescendingTechniques}
            />
          </Section>

          <Section title="2. 文体の特徴">
            <Field label="一人称" value={result.styleFeatures.firstPerson} />
            <Field
              label="常体と敬体の比率"
              value={result.styleFeatures.formalCasualRatio}
            />
            <ListField
              label="語尾のクセ"
              items={result.styleFeatures.sentenceEndingPatterns}
            />
            <Field
              label="一文の平均的な長さ"
              value={result.styleFeatures.avgSentenceLength}
            />
            <Field
              label="短文と長文の使い分け"
              value={result.styleFeatures.shortLongUsage}
            />
            <Field
              label="改行のタイミング"
              value={result.styleFeatures.lineBreakTiming}
            />
            <Field
              label="句読点の使い方"
              value={result.styleFeatures.punctuationUsage}
            />
            <Field
              label="記号・絵文字・カタカナ語の使用傾向"
              value={result.styleFeatures.symbolsEmojiKatakanaUsage}
            />
          </Section>

          <Section title="3. 構成のクセ">
            <ListField
              label="冒頭でよく使う入り方"
              items={result.structureHabits.openingPatterns}
            />
            <Field
              label="問題提起の仕方"
              value={result.structureHabits.problemFraming}
            />
            <Field
              label="主張/共感/結論のどれから入るか"
              value={result.structureHabits.entryPointStyle}
            />
            <Field
              label="具体例を出すタイミング"
              value={result.structureHabits.exampleTiming}
            />
            <Field
              label="読者に行動を促すときの流れ"
              value={result.structureHabits.ctaFlow}
            />
          </Section>

          <Section title="4. よく使う表現">
            <ListField
              label="頻出する言い回し"
              items={result.commonExpressions.frequentPhrases}
            />
            <ListField label="口癖" items={result.commonExpressions.verbalTics} />
            <ListField
              label="決め台詞"
              items={result.commonExpressions.signatureLines}
            />
            <ListField
              label="よく使わない言葉"
              items={result.commonExpressions.avoidedWords}
            />
          </Section>

          <Section title="別のAIに渡せる再現用プロンプト">
            <p className="rounded-lg bg-gray-50 p-3 text-sm whitespace-pre-wrap text-gray-800">
              {result.reproductionPrompt}
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}
