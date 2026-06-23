import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  MAX_POSTS,
  MAX_TOTAL_CHARS,
  MIN_POSTS,
  splitPosts,
  type StyleProfileResult,
} from "@/lib/style-profile";

export const runtime = "nodejs";

const ANALYSIS_TOOL_NAME = "submit_style_profile";

function buildAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません。");
  }
  return new Anthropic({ apiKey });
}

export async function POST(request: Request) {
  let body: { rawText?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  if (typeof body.rawText !== "string" || !body.rawText.trim()) {
    return NextResponse.json(
      { error: "過去ポストのテキストを入力してください。" },
      { status: 400 },
    );
  }

  const posts = splitPosts(body.rawText);

  if (posts.length < MIN_POSTS) {
    return NextResponse.json(
      {
        error: `分析には最低${MIN_POSTS}件のポストが必要です。各ポストの間に空行、または "---" の行を入れて区切ってください。`,
      },
      { status: 400 },
    );
  }

  if (posts.length > MAX_POSTS) {
    return NextResponse.json(
      { error: `ポストが多すぎます（最大${MAX_POSTS}件）。件数を減らして再度お試しください。` },
      { status: 400 },
    );
  }

  const totalChars = posts.reduce((sum, p) => sum + p.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return NextResponse.json(
      { error: `テキスト量が多すぎます（最大${MAX_TOTAL_CHARS}文字）。件数を減らして再度お試しください。` },
      { status: 400 },
    );
  }

  let client: Anthropic;
  try {
    client = buildAnthropicClient();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "サーバー設定エラーです。" },
      { status: 500 },
    );
  }

  const postsBlock = posts
    .map((p, i) => `[ポスト${i + 1}]\n${p}`)
    .join("\n\n");

  try {
    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 4000,
      system:
        "あなたはSNS文章の文体アナリストです。渡された過去ポスト群を読み込み、別のAIがその人の文体を高い精度で再現できるように、再現可能なルールとして言語化した「文体プロファイル」を作成します。雰囲気の模写ではなく、具体的に再現できる規則として記述してください。必ず submit_style_profile ツールを呼び出して結果を返してください。",
      messages: [
        {
          role: "user",
          content: `以下は同一人物が書いたSNSの過去ポスト群（${posts.length}件）です。これらを分析し、次の4観点で文体プロファイルを作成してください。

1. 基本トーン: 親しみやすい／断定的／煽り気味／冷静／熱量高めなどの傾向、読者との距離感、上から目線に見えないための言い回し
2. 文体の特徴: 一人称、常体と敬体の比率、語尾のクセ、一文の平均的な長さ、短文と長文の使い分け、改行のタイミング、句読点の使い方、記号・絵文字・カタカナ語の使用傾向
3. 構成のクセ: 冒頭でよく使う入り方、問題提起の仕方、主張/共感/結論のどれから入るか、具体例を出すタイミング、読者に行動を促すときの自然な流れ
4. よく使う表現: 頻出する言い回し、口癖、決め台詞、逆によく使わない言葉

最後に、これらすべてを踏まえて、別のAIにそのまま渡せば文体を再現できる指示文（reproduction_prompt）を作成してください。

---ポスト群---
${postsBlock}`,
        },
      ],
      tools: [
        {
          name: ANALYSIS_TOOL_NAME,
          description: "SNS文体プロファイルの分析結果を構造化データとして提出する。",
          input_schema: {
            type: "object",
            properties: {
              basic_tone: {
                type: "object",
                properties: {
                  tone_keywords: { type: "array", items: { type: "string" } },
                  tone_description: { type: "string" },
                  reader_distance: { type: "string" },
                  non_condescending_techniques: { type: "string" },
                },
                required: [
                  "tone_keywords",
                  "tone_description",
                  "reader_distance",
                  "non_condescending_techniques",
                ],
              },
              style_features: {
                type: "object",
                properties: {
                  first_person: { type: "string" },
                  formal_casual_ratio: { type: "string" },
                  sentence_ending_patterns: {
                    type: "array",
                    items: { type: "string" },
                  },
                  avg_sentence_length: { type: "string" },
                  short_long_usage: { type: "string" },
                  line_break_timing: { type: "string" },
                  punctuation_usage: { type: "string" },
                  symbols_emoji_katakana_usage: { type: "string" },
                },
                required: [
                  "first_person",
                  "formal_casual_ratio",
                  "sentence_ending_patterns",
                  "avg_sentence_length",
                  "short_long_usage",
                  "line_break_timing",
                  "punctuation_usage",
                  "symbols_emoji_katakana_usage",
                ],
              },
              structure_habits: {
                type: "object",
                properties: {
                  opening_patterns: { type: "array", items: { type: "string" } },
                  problem_framing: { type: "string" },
                  entry_point_style: { type: "string" },
                  example_timing: { type: "string" },
                  cta_flow: { type: "string" },
                },
                required: [
                  "opening_patterns",
                  "problem_framing",
                  "entry_point_style",
                  "example_timing",
                  "cta_flow",
                ],
              },
              common_expressions: {
                type: "object",
                properties: {
                  frequent_phrases: { type: "array", items: { type: "string" } },
                  verbal_tics: { type: "array", items: { type: "string" } },
                  signature_lines: { type: "array", items: { type: "string" } },
                  avoided_words: { type: "array", items: { type: "string" } },
                },
                required: [
                  "frequent_phrases",
                  "verbal_tics",
                  "signature_lines",
                  "avoided_words",
                ],
              },
              reproduction_prompt: { type: "string" },
            },
            required: [
              "basic_tone",
              "style_features",
              "structure_habits",
              "common_expressions",
              "reproduction_prompt",
            ],
          },
        },
      ],
      tool_choice: { type: "tool", name: ANALYSIS_TOOL_NAME },
    });

    const toolUseBlock = message.content.find(
      (block) => block.type === "tool_use" && block.name === ANALYSIS_TOOL_NAME,
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      return NextResponse.json(
        { error: "分析結果の取得に失敗しました。もう一度お試しください。" },
        { status: 502 },
      );
    }

    const input = toolUseBlock.input as {
      basic_tone: {
        tone_keywords: string[];
        tone_description: string;
        reader_distance: string;
        non_condescending_techniques: string;
      };
      style_features: {
        first_person: string;
        formal_casual_ratio: string;
        sentence_ending_patterns: string[];
        avg_sentence_length: string;
        short_long_usage: string;
        line_break_timing: string;
        punctuation_usage: string;
        symbols_emoji_katakana_usage: string;
      };
      structure_habits: {
        opening_patterns: string[];
        problem_framing: string;
        entry_point_style: string;
        example_timing: string;
        cta_flow: string;
      };
      common_expressions: {
        frequent_phrases: string[];
        verbal_tics: string[];
        signature_lines: string[];
        avoided_words: string[];
      };
      reproduction_prompt: string;
    };

    const result: StyleProfileResult = {
      basicTone: {
        toneKeywords: input.basic_tone.tone_keywords,
        toneDescription: input.basic_tone.tone_description,
        readerDistance: input.basic_tone.reader_distance,
        nonCondescendingTechniques: input.basic_tone.non_condescending_techniques,
      },
      styleFeatures: {
        firstPerson: input.style_features.first_person,
        formalCasualRatio: input.style_features.formal_casual_ratio,
        sentenceEndingPatterns: input.style_features.sentence_ending_patterns,
        avgSentenceLength: input.style_features.avg_sentence_length,
        shortLongUsage: input.style_features.short_long_usage,
        lineBreakTiming: input.style_features.line_break_timing,
        punctuationUsage: input.style_features.punctuation_usage,
        symbolsEmojiKatakanaUsage: input.style_features.symbols_emoji_katakana_usage,
      },
      structureHabits: {
        openingPatterns: input.structure_habits.opening_patterns,
        problemFraming: input.structure_habits.problem_framing,
        entryPointStyle: input.structure_habits.entry_point_style,
        exampleTiming: input.structure_habits.example_timing,
        ctaFlow: input.structure_habits.cta_flow,
      },
      commonExpressions: {
        frequentPhrases: input.common_expressions.frequent_phrases,
        verbalTics: input.common_expressions.verbal_tics,
        signatureLines: input.common_expressions.signature_lines,
        avoidedWords: input.common_expressions.avoided_words,
      },
      reproductionPrompt: input.reproduction_prompt,
      postCount: posts.length,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Style profile analysis failed", error);
    const message =
      error instanceof Anthropic.APIError
        ? `Claude APIエラー: ${error.message}`
        : "分析中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
