import type { RankName } from "./types";

export const RANK_CONFIG: Record<RankName, { label: string; color: string; bg: string; border: string }> = {
  bronze:   { label: "ブロンズ",   color: "#92400e", bg: "#fef3c7", border: "#f59e0b" },
  silver:   { label: "シルバー",   color: "#475569", bg: "#f1f5f9", border: "#94a3b8" },
  gold:     { label: "ゴールド",   color: "#854d0e", bg: "#fef9c3", border: "#eab308" },
  platinum: { label: "プラチナ",   color: "#1e3a5f", bg: "#e0f2fe", border: "#0ea5e9" },
  diamond:  { label: "ダイヤモンド", color: "#581c87", bg: "#f3e8ff", border: "#a855f7" },
};
