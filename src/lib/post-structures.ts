// ポスト構成の型ナレッジ。本来は20種以上を想定しているが、フックと同様に
// パイプラインの仕組みを成立させるための代表パターンのみ登録している。
export interface PostStructureDefinition {
  id: string;
  label: string;
  description: string;
}

export const POST_STRUCTURES: PostStructureDefinition[] = [
  {
    id: "pas",
    label: "PAS型",
    description: "課題(Problem)→煽り(Agitate)→解決(Solution)の順で展開する構成。",
  },
  {
    id: "listicle",
    label: "列挙型",
    description: "「3つのポイント」のように要点を箇条書きで並べる構成。",
  },
  {
    id: "story_arc",
    label: "起承転結型",
    description: "状況→展開→転換→結論の順に語る構成。",
  },
  {
    id: "before_after_structure",
    label: "Before/After型",
    description: "変化前と変化後を対比させて見せる構成。",
  },
  {
    id: "single_message",
    label: "一点突破型",
    description: "1つの主張を様々な角度から繰り返し補強する構成。",
  },
];

export const POST_STRUCTURE_IDS = POST_STRUCTURES.map((s) => s.id) as [
  string,
  ...string[],
];

export function getPostStructureById(
  id: string,
): PostStructureDefinition | undefined {
  return POST_STRUCTURES.find((s) => s.id === id);
}
