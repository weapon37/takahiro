export interface BasicTone {
  toneKeywords: string[];
  toneDescription: string;
  readerDistance: string;
  nonCondescendingTechniques: string;
}

export interface StyleFeatures {
  firstPerson: string;
  formalCasualRatio: string;
  sentenceEndingPatterns: string[];
  avgSentenceLength: string;
  shortLongUsage: string;
  lineBreakTiming: string;
  punctuationUsage: string;
  symbolsEmojiKatakanaUsage: string;
}

export interface StructureHabits {
  openingPatterns: string[];
  problemFraming: string;
  entryPointStyle: string;
  exampleTiming: string;
  ctaFlow: string;
}

export interface CommonExpressions {
  frequentPhrases: string[];
  verbalTics: string[];
  signatureLines: string[];
  avoidedWords: string[];
}

export interface StyleProfileResult {
  basicTone: BasicTone;
  styleFeatures: StyleFeatures;
  structureHabits: StructureHabits;
  commonExpressions: CommonExpressions;
  reproductionPrompt: string;
  postCount: number;
}

export const MIN_POSTS = 3;
export const MAX_POSTS = 300;
export const MAX_TOTAL_CHARS = 50000;

export function splitPosts(rawText: string): string[] {
  const byDelimiter = rawText
    .split(/\n[ \t]*-{3,}[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const candidates =
    byDelimiter.length > 1
      ? byDelimiter
      : rawText
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);

  return candidates;
}
