import Anthropic from "@anthropic-ai/sdk";

export function buildAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません。");
  }
  return new Anthropic({ apiKey });
}
