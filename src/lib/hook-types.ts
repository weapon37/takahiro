// フックの型ナレッジ。本来は120種以上を想定しているが、ここではパイプラインの
// 仕組みを成立させるための種となる代表パターンのみ登録している。
// 運用しながら同じ形式でエントリを追加していくことを想定。
export interface HookTypeDefinition {
  id: string;
  label: string;
  description: string;
}

export const HOOK_TYPES: HookTypeDefinition[] = [
  {
    id: "loss_warning",
    label: "損失警告型",
    description: "「知らないと損する」のように行動しないデメリットを先に提示するフック。",
  },
  {
    id: "common_mistake",
    label: "勘違い指摘型",
    description: "「実は多くの人が間違えている」と前提を覆して興味を引くフック。",
  },
  {
    id: "personal_confession",
    label: "告白型",
    description: "「正直に言うと」など筆者の本音から始め、人間味で引き込むフック。",
  },
  {
    id: "numbered_result",
    label: "数字提示型",
    description: "具体的な数字(期間・回数・金額など)を最初に出して信頼感と具体性を出すフック。",
  },
  {
    id: "past_self",
    label: "過去の自分型",
    description: "「〇年前の自分に伝えたい」のように時間軸を使って当事者性を作るフック。",
  },
  {
    id: "question_provoke",
    label: "問いかけ型",
    description: "読み手に直接問いかけて自分ごと化させるフック。",
  },
  {
    id: "contrarian",
    label: "逆説型",
    description: "一般的な常識と逆のことを言って続きを読ませるフック。",
  },
  {
    id: "before_after",
    label: "変化提示型",
    description: "Before/Afterの差分を一言で見せて続きへの期待を作るフック。",
  },
];

export const HOOK_TYPE_IDS = HOOK_TYPES.map((h) => h.id) as [
  string,
  ...string[],
];

export function getHookTypeById(id: string): HookTypeDefinition | undefined {
  return HOOK_TYPES.find((h) => h.id === id);
}
