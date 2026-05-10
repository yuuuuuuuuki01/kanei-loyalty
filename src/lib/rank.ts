import type { RankName } from "./types";

export const RANK_CONFIG: Record<RankName, { label: string; color: string; bg: string; border: string }> = {
  bronze:   { label: "ブロンズ",   color: "#92400e", bg: "#FFFBEB", border: "#D97706" },
  silver:   { label: "シルバー",   color: "#475569", bg: "#F1F5F9", border: "#94A3B8" },
  gold:     { label: "ゴールド",   color: "#854D0E", bg: "#FEF9C3", border: "#CA8A04" },
  platinum: { label: "プラチナ",   color: "#0A4368", bg: "#E8F2F8", border: "#0F5B8D" },
  diamond:  { label: "ダイヤモンド", color: "#1F2933", bg: "#F2F5F7", border: "#1F2933" },
};
