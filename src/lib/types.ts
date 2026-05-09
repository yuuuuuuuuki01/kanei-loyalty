// ── 金井酒造 ロイヤリティシステム型定義 ──

export interface Customer {
  id: string;
  shopify_customer_id: string | null;
  email: string;
  name: string;
  phone: string | null;
  created_at: string;
}

export interface StampCard {
  id: string;
  customer_id: string;
  card_number: number;        // 何枚目のカード (1-indexed)
  total_spent: number;        // このカードの累計金額
  stamps_earned: number;      // 累計スタンプ (floor(total_spent / 500))
  rewards_claimed: number[];  // 交換済み特典ステップ [20, 40]
  completed_at: string | null;
  created_at: string;
}

export interface StampTransaction {
  id: string;
  card_id: string;
  customer_id: string;
  amount: number;             // 購入金額
  stamps_awarded: number;     // 今回付与されたスタンプ数
  staff_name: string | null;  // 付与した店員
  created_at: string;
}

export type RankName = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface CustomerRank {
  rank: RankName;
  cardsCompleted: number;
  recentSpend90d: number;     // 直近90日の支出
  recentSpend60d: number;     // 直近60日の支出
}

// ── ビジネスロジック定数 ──

export const STAMP_UNIT = 500;              // 500円で1スタンプ
export const STAMPS_PER_CARD = 60;          // 1カード60スタンプ
export const REWARDS = [
  { step: 20, name: "ステッカー" },
  { step: 40, name: "商品券1,000円分（直売所限定）" },
  { step: 60, name: "商品券2,000円分（直売所限定）" },
] as const;

// ランク判定
export function calculateRank(
  cardsCompleted: number,
  recentSpend90d: number,
  recentSpend60d: number
): RankName {
  // ダイヤモンド: ゴールド以上 + 直近2ヶ月で30,000円
  if (cardsCompleted >= 3 && recentSpend60d >= 30000) return "diamond";
  // プラチナ: ゴールド以上 + 直近3ヶ月で10,000円
  if (cardsCompleted >= 3 && recentSpend90d >= 10000) return "platinum";
  // ゴールド: 3枚完了
  if (cardsCompleted >= 3) return "gold";
  // シルバー: 2枚完了
  if (cardsCompleted >= 2) return "silver";
  // ブロンズ: デフォルト
  return "bronze";
}

// スタンプ計算
export function calculateStamps(totalSpent: number): number {
  return Math.floor(totalSpent / STAMP_UNIT);
}

// 現在のスタンプ数（交換済み分は引かない — 表示用）
export function currentStamps(card: StampCard): number {
  return calculateStamps(card.total_spent);
}

// 次の特典までの残りスタンプ
export function stampsToNextReward(card: StampCard): { next: typeof REWARDS[number]; remaining: number } | null {
  const stamps = currentStamps(card);
  for (const reward of REWARDS) {
    if (!card.rewards_claimed.includes(reward.step)) {
      return { next: reward, remaining: Math.max(0, reward.step - stamps) };
    }
  }
  return null;
}
