export interface PersonaPreset {
  id: string;
  label: string;
  audience: string;
  genre: string;
}

/**
 * 投稿を作り分けるためのターゲット・ジャンルのプリセット。
 * 先頭の要素が既定値として使われる。
 */
export const PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: "running-sub4",
    label: "ランニング / サブ4を狙う市民ランナー",
    audience:
      "フルマラソン4時間切り(サブ4)を目指す30〜50代の市民ランナー。週2〜4回走っているが記録が伸び悩んでおり、練習メニュー・シューズ選び・レース戦略・故障予防に関心がある",
    genre:
      "ランニング・マラソンの練習法とギア選び(サブ4/サブ3.5を狙う練習メニューの組み方、シューズやGPSウォッチの選び方と買い替え時期、レース当日のペース配分、補給・食事、故障予防とケアなど)",
  },
  {
    id: "running-beginner",
    label: "ランニング / 走り始めたばかりの初心者",
    audience:
      "運動不足の解消やダイエットのために走り始めた20〜40代の初心者ランナー。まだ5〜10kmを走り切るのがやっとで、何を買えばいいか・どう練習すればいいか分からず迷っている",
    genre:
      "ランニング入門(続けられる走り方と習慣化のコツ、初心者向けシューズやウェアの選び方、5km・10kmを走り切るための練習、初レース参加の準備、走ることで体が変わる実感など)",
  },
  {
    id: "running-race",
    label: "ランニング / 秋冬レースに向けて仕上げる層",
    audience:
      "秋冬のフルマラソン・ハーフマラソンにエントリー済みで、本番に向けて仕上げていく市民ランナー。大会当日の失敗を避けたい、自己ベストを更新したいという気持ちが強い",
    genre:
      "マラソンレース対策(本番までの調整と練習の逆算、テーパリング、当日の装備とギア、ペース戦略と給水・補給計画、レース後のリカバリー、大会エントリー情報など)",
  },
  {
    id: "ai-sidejob",
    label: "AI副業 / 時間が取りづらい会社員",
    audience:
      "30〜40代で、営業職や現場仕事など外に出て働くスタイルのため、まとまった副業の時間を取りづらい人",
    genre:
      "AIを活用した副業(AIツールを使って隙間時間・移動時間でもできる副業、AIで作業を効率化して副業の時間を生み出す方法など)",
  },
];

export const DEFAULT_PERSONA = PERSONA_PRESETS[0];

/** ターゲット・ジャンルの入力上限(文字数)。 */
export const MAX_PERSONA_FIELD_LENGTH = 600;

export function getPersonaById(id: string): PersonaPreset | undefined {
  return PERSONA_PRESETS.find((p) => p.id === id);
}
