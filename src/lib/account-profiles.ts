export interface AccountProfile {
  id: string;
  name: string;
  toneDescription: string;
  sampleHooks: string[];
}

export const ACCOUNT_PROFILES: AccountProfile[] = [
  {
    id: "default",
    name: "デフォルトアカウント",
    toneDescription:
      "親しみやすく、丁寧語と話し言葉の中間。一文を短く区切り、読者を「あなた」と呼びかける。絵文字は使わない。",
    sampleHooks: [
      "それ、知らないと損してます。",
      "3ヶ月前の自分に教えたい話。",
      "みんな勘違いしてるけど、",
    ],
  },
];

export function getAccountProfileById(id: string): AccountProfile | undefined {
  return ACCOUNT_PROFILES.find((p) => p.id === id);
}

export const ACCOUNT_PROFILE_IDS = ACCOUNT_PROFILES.map((p) => p.id) as [
  string,
  ...string[],
];
