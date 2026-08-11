import { buildAnthropicClient } from "@/lib/anthropic-client";
import { TARGET_AUDIENCE, GENRE } from "@/lib/audience";
import { POST_TYPES, POST_TYPE_IDS } from "@/lib/post-types";
import { PURPOSE_IDS, PURPOSE_LABELS, type PostPurpose } from "@/lib/types";
import { MIN_WEEKS, MAX_WEEKS } from "@/lib/plan-constants";

export { MIN_WEEKS, MAX_WEEKS };

interface DailyDraft {
  dayOffset: number;
  typeId: string;
  purpose: PostPurpose;
  content: string;
}

interface WeeklyTheme {
  weekIndex: number;
  theme: string;
  rationale: string;
}

export interface GeneratedPlan {
  longTermTheme: string;
  longTermRationale: string;
  weeklyThemes: WeeklyTheme[];
  dailyDrafts: DailyDraft[];
}

const GENERATE_PLAN_TOOL = "submit_content_plan";

export async function generatePlan(weeks: number): Promise<GeneratedPlan> {
  const clampedWeeks = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.round(weeks)));
  const totalDays = clampedWeeks * 7;
  const client = buildAnthropicClient();

  const typeList = POST_TYPES.map(
    (t) => `- ${t.id}: ${t.label} — ${t.description}`,
  ).join("\n");
  const purposeList = PURPOSE_IDS.map((p) => `- ${p}: ${PURPOSE_LABELS[p]}`).join(
    "\n",
  );

  const instructionText =
    `あなたはX(旧Twitter)の日々の投稿計画を立てるSNSマーケターです。\n\n` +
    `ターゲット: ${TARGET_AUDIENCE}\n` +
    `ジャンル: ${GENRE}\n\n` +
    `目的は同じジャンルに関心がある人からのフォロワー獲得です。収益化(商品販売やアフィリエイト)を急がなくても長く続けられるよう、` +
    `売り込み色の強い投稿ばかりにせず、価値提供・共感・エンゲージメントを誘う投稿を中心に組み立ててください。\n\n` +
    `以下を作成してください。\n` +
    `1. long_term_theme: 今後${clampedWeeks}週間全体を貫く長期テーマと、long_term_rationale にその狙いの説明。\n` +
    `2. weekly_themes: 週ごと(week_index は 0〜${clampedWeeks - 1})の中期テーマ。長期テーマを分解し、週ごとに違う切り口にすること。\n` +
    `3. daily_drafts: 全${totalDays}日分(day_offset は 0〜${totalDays - 1}、1日1投稿)の投稿下書き。\n` +
    `   - type_id は以下の型リストから選択してください。\n${typeList}\n\n` +
    `   - purpose は以下のリストから選択してください。value/engagement/relatability/story系が中心になるようにし、proof(実績・成果)は偶に留めてください。\n${purposeList}\n\n` +
    `   - 1週間の中で type_id・purpose に変化をつけ、同じ型が連続しすぎないようにしてください。\n` +
    `   - content はそのままX投稿として使える完成形の日本語文章(300字以内、説明や見出しなし)にしてください。\n` +
    `   - 元の投稿の丸写しではなく、ターゲット・ジャンルに沿ったオリジナルの内容にしてください。`;

  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    max_tokens: 8192,
    system:
      "あなたはSNSマーケティングの専門家で、フォロワー獲得のための中長期投稿計画を立てます。必ず submit_content_plan ツールを呼び出して結果を返してください。",
    messages: [{ role: "user", content: instructionText }],
    tools: [
      {
        name: GENERATE_PLAN_TOOL,
        description: "中長期の投稿計画(長期テーマ・週テーマ・日次下書き)を提出する。",
        input_schema: {
          type: "object",
          properties: {
            long_term_theme: { type: "string" },
            long_term_rationale: { type: "string" },
            weekly_themes: {
              type: "array",
              minItems: clampedWeeks,
              maxItems: clampedWeeks,
              items: {
                type: "object",
                properties: {
                  week_index: { type: "integer" },
                  theme: { type: "string" },
                  rationale: { type: "string" },
                },
                required: ["week_index", "theme", "rationale"],
              },
            },
            daily_drafts: {
              type: "array",
              minItems: totalDays,
              maxItems: totalDays,
              items: {
                type: "object",
                properties: {
                  day_offset: { type: "integer" },
                  type_id: { type: "string", enum: POST_TYPE_IDS },
                  purpose: { type: "string", enum: PURPOSE_IDS },
                  content: { type: "string" },
                },
                required: ["day_offset", "type_id", "purpose", "content"],
              },
            },
          },
          required: [
            "long_term_theme",
            "long_term_rationale",
            "weekly_themes",
            "daily_drafts",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: GENERATE_PLAN_TOOL },
  });

  const toolUseBlock = message.content.find(
    (block) => block.type === "tool_use" && block.name === GENERATE_PLAN_TOOL,
  );
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("計画の生成に失敗しました。もう一度お試しください。");
  }

  const input = toolUseBlock.input as {
    long_term_theme: string;
    long_term_rationale: string;
    weekly_themes: { week_index: number; theme: string; rationale: string }[];
    daily_drafts: {
      day_offset: number;
      type_id: string;
      purpose: PostPurpose;
      content: string;
    }[];
  };

  return {
    longTermTheme: input.long_term_theme,
    longTermRationale: input.long_term_rationale,
    weeklyThemes: input.weekly_themes.map((w) => ({
      weekIndex: w.week_index,
      theme: w.theme,
      rationale: w.rationale,
    })),
    dailyDrafts: input.daily_drafts.map((d) => ({
      dayOffset: d.day_offset,
      typeId: d.type_id,
      purpose: d.purpose,
      content: d.content,
    })),
  };
}
