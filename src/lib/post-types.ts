export type PostTypeId =
  | "empathy"
  | "howto"
  | "story"
  | "controversy"
  | "visual"
  | "quote"
  | "comparison"
  | "relatable"
  | "question"
  | "news"
  | "achievement"
  | "thread";

export interface PostTypeDefinition {
  id: PostTypeId;
  label: string;
  description: string;
}

export const POST_TYPES: PostTypeDefinition[] = [
  {
    id: "empathy",
    label: "共感・感情訴求型",
    description: "読み手の感情や共感を強く揺さぶる内容。「わかる」「泣ける」と思わせる投稿。",
  },
  {
    id: "howto",
    label: "ノウハウ・Tips型",
    description: "知識やテクニック、便利な情報を共有する投稿。保存・引用されやすい。",
  },
  {
    id: "story",
    label: "ストーリー・体験談型",
    description: "個人の実体験や出来事を時系列で語る投稿。起承転結があり読み進めたくなる。",
  },
  {
    id: "controversy",
    label: "炎上・問題提起型",
    description: "賛否が分かれる意見や社会的な問題提起を行う投稿。リプライ・引用RTで議論を呼ぶ。",
  },
  {
    id: "visual",
    label: "ビジュアル訴求型",
    description: "画像・動画・スクリーンショットなど視覚的なインパクトが主役の投稿。",
  },
  {
    id: "quote",
    label: "名言・格言型",
    description: "短く印象的な一言やフレーズで気づきや教訓を伝える投稿。",
  },
  {
    id: "comparison",
    label: "Before/After・比較型",
    description: "変化や違いを並べて見せる投稿。ギャップの大きさが拡散力になる。",
  },
  {
    id: "relatable",
    label: "自虐・あるある型",
    description: "「あるある」や自虐ネタで多くの人が「自分も同じ」と感じる投稿。",
  },
  {
    id: "question",
    label: "質問・アンケート型",
    description: "読み手に問いかけたり投票を促したりして、リプライ・引用を誘発する投稿。",
  },
  {
    id: "news",
    label: "ニュース・速報型",
    description: "時事性の高い情報やニュースを最速で伝える投稿。情報の新規性が価値。",
  },
  {
    id: "achievement",
    label: "自慢・成果報告型",
    description: "成果や実績、結果を報告する投稿。驚きや羨望を誘って拡散される。",
  },
  {
    id: "thread",
    label: "スレッド・解説型",
    description: "複数ポストや長文で体系的に解説するスレッド形式の投稿。",
  },
];

export const POST_TYPE_IDS = POST_TYPES.map((t) => t.id) as [
  PostTypeId,
  ...PostTypeId[],
];

export function getPostTypeById(id: string): PostTypeDefinition | undefined {
  return POST_TYPES.find((t) => t.id === id);
}
