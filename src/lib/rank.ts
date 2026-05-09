import type { RankName } from "./types";

export const RANK_CONFIG: Record<RankName, { label: string; color: string; bg: string; border: string }> = {
  bronze:   { label: "BRONZE",   color: "#d97706", bg: "#451a03", border: "#b45309" },
  silver:   { label: "SILVER",   color: "#94a3b8", bg: "#1e293b", border: "#64748b" },
  gold:     { label: "GOLD",     color: "#eab308", bg: "#422006", border: "#ca8a04" },
  platinum: { label: "PLATINUM", color: "#38bdf8", bg: "#0c4a6e", border: "#0284c7" },
  diamond:  { label: "DIAMOND",  color: "#c084fc", bg: "#3b0764", border: "#9333ea" },
};
