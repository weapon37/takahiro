// freee の経費入力でよく使う勘定科目・税区分の定義。
// AIが領収書を読み取って勘定科目を推定する際の選択肢としても使う。

export interface AccountItem {
  /** freee上の勘定科目名(そのままCSVに出力する) */
  name: string;
  /** どんな支出がこの科目に当たるかの説明。AIの判定ヒントとして使う。 */
  description: string;
}

/** freee 標準で用意されている代表的な費用系の勘定科目 */
export const ACCOUNT_ITEMS: AccountItem[] = [
  {
    name: "旅費交通費",
    description: "電車・バス・タクシー・航空券・ガソリン代・駐車場代・出張旅費など移動にかかる費用。",
  },
  {
    name: "会議費",
    description: "打ち合わせ・会議の飲食代、カフェ代、会議室利用料など(1人あたり少額なもの)。",
  },
  {
    name: "接待交際費",
    description: "取引先との飲食・接待・贈答品・お中元お歳暮・慶弔費など。",
  },
  {
    name: "消耗品費",
    description: "文房具・事務用品・10万円未満の備品・電池・トナー・日用品など消耗する物品。",
  },
  {
    name: "通信費",
    description: "電話・携帯・インターネット回線・切手・宅配便・サーバー/ドメイン費用など。",
  },
  {
    name: "水道光熱費",
    description: "電気・ガス・水道料金など。",
  },
  {
    name: "新聞図書費",
    description: "書籍・雑誌・新聞・電子書籍・有料記事・資料の購入費用。",
  },
  {
    name: "広告宣伝費",
    description: "広告出稿・チラシ・名刺・Web広告・販促物などの費用。",
  },
  {
    name: "支払手数料",
    description: "振込手数料・決済手数料・各種サービス利用手数料・仲介手数料など。",
  },
  {
    name: "外注費",
    description: "業務の一部を外部に委託した際の報酬・制作費・業務委託費など。",
  },
  {
    name: "地代家賃",
    description: "事務所・店舗・駐車場などの家賃・賃借料。",
  },
  {
    name: "租税公課",
    description: "収入印紙・登録免許税・自動車税・固定資産税などの税金・公的な負担金。",
  },
  {
    name: "荷造運賃",
    description: "商品発送の梱包資材や配送料など販売にかかる運賃。",
  },
  {
    name: "修繕費",
    description: "設備・車両・建物などの修理・メンテナンス費用。",
  },
  {
    name: "福利厚生費",
    description: "従業員向けの飲食・慶弔・健康診断・社内行事などの費用。",
  },
  {
    name: "雑費",
    description: "他のどの科目にも当てはまらない少額の費用。",
  },
];

export const ACCOUNT_ITEM_NAMES = ACCOUNT_ITEMS.map((a) => a.name) as [
  string,
  ...string[],
];

/** freee の税区分。仕入(経費)側でよく使うものを列挙。 */
export const TAX_CATEGORIES = [
  "課税仕入10%",
  "課対仕入(軽)8%",
  "非課税仕入",
  "対象外",
] as const;

export type TaxCategory = (typeof TAX_CATEGORIES)[number];

export const TAX_CATEGORY_VALUES = TAX_CATEGORIES as unknown as [
  string,
  ...string[],
];
