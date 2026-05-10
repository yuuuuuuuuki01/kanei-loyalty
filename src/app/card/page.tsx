"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getSession, clearSession } from "@/lib/session";
import { STAMPS_PER_CARD, REWARDS, STAMP_UNIT } from "@/lib/types";
import type { RankName } from "@/lib/types";
import { RANK_CONFIG } from "@/lib/rank";

interface CardData {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  card_number: number;
  total_spent: number;
  stamps_earned: number;
  rewards_claimed: number[];
  cards_completed: number;
  rank: RankName;
}

export default function CardPage() {
  const [email, setEmail] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stampRequested, setStampRequested] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  async function loadCard(customerEmail: string) {
    setLoading(true);
    setError("");
    try {
      const { data: customer } = await supabase
        .from("loyalty_customers").select("id, name, email")
        .eq("email", customerEmail.trim().toLowerCase()).single();
      if (!customer) { setError("会員が見つかりません"); setLoading(false); return; }

      const { data: activeCard } = await supabase
        .from("stamp_cards").select("*")
        .eq("customer_id", customer.id).is("completed_at", null)
        .order("card_number", { ascending: false }).limit(1).single();

      const { count: completedCount } = await supabase
        .from("stamp_cards").select("*", { count: "exact", head: true })
        .eq("customer_id", customer.id).not("completed_at", "is", null);

      const { data: rankData } = await supabase
        .from("v_customer_rank").select("rank")
        .eq("customer_id", customer.id).single();

      setCard({
        customer_id: customer.id, customer_name: customer.name, customer_email: customer.email,
        card_number: activeCard?.card_number ?? 1, total_spent: activeCard?.total_spent ?? 0,
        stamps_earned: activeCard?.stamps_earned ?? 0, rewards_claimed: activeCard?.rewards_claimed ?? [],
        cards_completed: completedCount ?? 0, rank: (rankData?.rank as RankName) ?? "bronze",
      });
    } catch { setError("データの取得に失敗しました"); }
    setLoading(false);
  }

  useEffect(() => {
    const session = getSession();
    if (session) { setEmail(session.email); loadCard(session.email); }
  }, []);

  async function requestStamp() {
    if (!card) return;
    setStampRequested(true);
    await supabase.from("scan_events").insert({
      customer_id: card.customer_id, customer_name: card.customer_name, status: "pending",
    });
    const channel = supabase.channel("stamp-response")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "scan_events", filter: `customer_id=eq.${card.customer_id}` },
        (payload) => {
          if (payload.new.status === "approved") {
            setStampRequested(false); loadCard(card.customer_email); channel.unsubscribe();
          }
        }).subscribe();
  }

  const stamps = card?.stamps_earned ?? 0;
  const rankCfg = card ? RANK_CONFIG[card.rank] : RANK_CONFIG.bronze;
  const carryOver = card ? card.total_spent % STAMP_UNIT : 0;
  const progress = stamps / STAMPS_PER_CARD;
  const nextReward = REWARDS.find((r) => !card?.rewards_claimed.includes(r.step) && r.step > stamps);

  return (
    <main className="min-h-screen bg-[#F7FAFC]" style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", "Inter", sans-serif' }}>
      <div className="max-w-md mx-auto px-5 py-6">

        {/* ── ヘッダー ── */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[18px] font-bold text-[#1F2933] leading-[1.45] tracking-[0.01em]">金井酒造店</h1>
            <p className="text-[12px] text-[#52606D] tracking-[0.03em]">ポイントカード</p>
          </div>
          {card && (
            <button onClick={() => { clearSession(); setCard(null); setEmail(""); setError(""); }}
              className="text-[12px] text-[#9AA5B1] hover:text-[#52606D] transition">
              ログアウト
            </button>
          )}
        </header>

        {/* ── 未ログイン ── */}
        {!card && !loading && (
          <div className="bg-white rounded-[12px] border border-[#E5EDF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-6 space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-[15px] font-bold text-[#1F2933] tracking-[0.02em]">
                {authMode === "login" ? "ログイン" : "新規会員登録"}
              </h2>
              <p className="text-[12px] text-[#52606D] mt-1 tracking-[0.03em]">
                オンラインショップのアカウントをご利用ください
              </p>
            </div>

            {authMode === "register" && (
              <div className="flex gap-3">
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="姓" className="flex-1 h-[40px] px-3 text-[14px] border border-[#BCCCDC] rounded-[8px] bg-white placeholder:text-[#9AA5B1] focus:outline-none focus:ring-[3px] focus:ring-[rgba(15,91,141,0.14)]" />
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="名" className="flex-1 h-[40px] px-3 text-[14px] border border-[#BCCCDC] rounded-[8px] bg-white placeholder:text-[#9AA5B1] focus:outline-none focus:ring-[3px] focus:ring-[rgba(15,91,141,0.14)]" />
              </div>
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス" className="w-full h-[40px] px-3 text-[14px] border border-[#BCCCDC] rounded-[8px] bg-white placeholder:text-[#9AA5B1] focus:outline-none focus:ring-[3px] focus:ring-[rgba(15,91,141,0.14)]" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード" className="w-full h-[40px] px-3 text-[14px] border border-[#BCCCDC] rounded-[8px] bg-white placeholder:text-[#9AA5B1] focus:outline-none focus:ring-[3px] focus:ring-[rgba(15,91,141,0.14)]" />
            {authMode === "register" && (
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="電話番号（任意）" className="w-full h-[40px] px-3 text-[14px] border border-[#BCCCDC] rounded-[8px] bg-white placeholder:text-[#9AA5B1] focus:outline-none focus:ring-[3px] focus:ring-[rgba(15,91,141,0.14)]" />
            )}

            <button
              onClick={async () => {
                setLoading(true); setError("");
                try {
                  const endpoint = authMode === "login" ? "/api/auth/shopify" : "/api/auth/register";
                  const body = authMode === "login" ? { email, password } : { firstName, lastName, email, password, phone };
                  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                  const data = await res.json();
                  if (!res.ok) { setError(data.error || "エラーが発生しました"); setLoading(false); return; }
                  loadCard(email);
                } catch { setError("通信エラーが発生しました"); setLoading(false); }
              }}
              disabled={loading || !email || !password || (authMode === "register" && !firstName)}
              className="w-full h-[44px] bg-[#0F5B8D] text-white rounded-[8px] text-[14px] font-bold hover:bg-[#0A4368] transition disabled:opacity-40"
            >
              {authMode === "login" ? "ログイン" : "登録してはじめる"}
            </button>

            <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }}
              className="w-full text-center text-[12px] text-[#0F5B8D] font-bold hover:underline">
              {authMode === "login" ? "アカウントをお持ちでない方 → 新規登録" : "アカウントをお持ちの方 → ログイン"}
            </button>

            {error && <p className="text-[#C53D3D] text-[12px] text-center">{error}</p>}
          </div>
        )}

        {loading && !card && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#0F5B8D] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* ── カード表示 ── */}
        {card && (
          <div className="space-y-4">

            {/* 会員証カード */}
            <div className="bg-white rounded-[12px] border border-[#E5EDF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
              {/* ランクバー */}
              <div className="h-[6px]" style={{ background: rankCfg.border }} />

              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[18px] font-bold text-[#1F2933] leading-[1.4]">{card.customer_name}</p>
                    <p className="text-[11px] text-[#9AA5B1] mt-0.5">{card.customer_email}</p>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: rankCfg.bg, color: rankCfg.color, border: `1px solid ${rankCfg.border}` }}>
                    {rankCfg.label}
                  </span>
                </div>

                {/* プログレス */}
                <div className="mb-3">
                  <div className="flex justify-between text-[12px] mb-1.5">
                    <span className="text-[#52606D] font-bold">{stamps} / {STAMPS_PER_CARD} スタンプ</span>
                    <span className="text-[#0F5B8D] font-bold">{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="h-[8px] bg-[#F2F5F7] rounded-full overflow-hidden border border-[#D9E2EC]">
                    <div className="h-full bg-[#0F5B8D] rounded-full transition-all duration-700" style={{ width: `${progress * 100}%` }} />
                  </div>
                  {nextReward && (
                    <p className="text-[11px] text-[#52606D] mt-1.5">
                      次の特典「{nextReward.name}」まで あと <strong className="text-[#0F5B8D]">{nextReward.step - stamps}</strong> スタンプ
                    </p>
                  )}
                </div>

                <div className="flex gap-4 text-[11px] text-[#9AA5B1] border-t border-[#D9E2EC] pt-3">
                  <span>カード {card.card_number}枚目</span>
                  <span>完了 {card.cards_completed}枚</span>
                  {carryOver > 0 && <span>繰越 ¥{carryOver}</span>}
                </div>
              </div>
            </div>

            {/* スタンプグリッド */}
            <div className="bg-white rounded-[12px] border border-[#E5EDF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5">
              <h2 className="text-[12px] font-bold text-[#52606D] uppercase tracking-[0.05em] mb-3">スタンプ</h2>
              <div className="grid grid-cols-10 gap-[5px]">
                {Array.from({ length: STAMPS_PER_CARD }, (_, i) => {
                  const num = i + 1;
                  const filled = num <= stamps;
                  const isReward = REWARDS.some((r) => r.step === num);
                  const rewardClaimed = card.rewards_claimed.includes(num);

                  let bg = "bg-[#F2F5F7] border-[#D9E2EC]";
                  let text = "text-[#9AA5B1]";
                  let content = "";

                  if (filled) {
                    if (isReward && rewardClaimed) { bg = "bg-[#2F855A] border-[#2F855A]"; text = "text-white"; }
                    else if (isReward) { bg = "bg-[#B7791F] border-[#B7791F]"; text = "text-white"; }
                    else { bg = "bg-[#0F5B8D] border-[#0F5B8D]"; text = "text-white"; }
                    content = isReward ? "★" : "●";
                  } else {
                    if (isReward) { bg = "bg-[#FFF9E6] border-[#B7791F]"; text = "text-[#B7791F]"; content = "★"; }
                  }

                  return (
                    <div key={i} className={`aspect-square rounded-[4px] border flex items-center justify-center text-[8px] font-bold ${bg} ${text}`}>
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 特典一覧 */}
            <div className="bg-white rounded-[12px] border border-[#E5EDF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5 space-y-2">
              <h2 className="text-[12px] font-bold text-[#52606D] uppercase tracking-[0.05em] mb-2">特典</h2>
              {REWARDS.map((reward) => {
                const claimed = card.rewards_claimed.includes(reward.step);
                const reached = stamps >= reward.step;
                return (
                  <div key={reward.step} className={`flex items-center gap-3 p-3 rounded-[8px] border ${
                    claimed ? "bg-[#F0FFF4] border-[#C6F6D5]" : reached ? "bg-[#FFFFF0] border-[#FEFCBF]" : "bg-[#F2F5F7] border-[#D9E2EC]"
                  }`}>
                    <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center text-[12px] font-bold shrink-0 ${
                      claimed ? "bg-[#2F855A] text-white" : reached ? "bg-[#B7791F] text-white" : "bg-[#D9E2EC] text-[#9AA5B1]"
                    }`}>
                      {claimed ? "✓" : reward.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-bold truncate ${claimed ? "text-[#2F855A]" : "text-[#1F2933]"}`}>{reward.name}</p>
                      <p className="text-[11px] text-[#9AA5B1]">
                        {claimed ? "交換済み" : reached ? "交換可能" : `あと ${reward.step - stamps} スタンプ`}
                      </p>
                    </div>
                    {reached && !claimed && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#B7791F] text-white">交換可</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* スタンプ申請ボタン */}
            <button
              onClick={requestStamp}
              disabled={stampRequested}
              className={`w-full h-[48px] rounded-[8px] text-[14px] font-bold transition ${
                stampRequested
                  ? "bg-[#F0FFF4] text-[#2F855A] border border-[#C6F6D5]"
                  : "bg-[#2F855A] text-white hover:bg-[#276749] active:scale-[0.99]"
              }`}
            >
              {stampRequested ? "✓ スタンプ申請中..." : "スタンプをもらう"}
            </button>
            {stampRequested && (
              <p className="text-center text-[11px] text-[#2F855A] animate-pulse">スタッフが確認中です</p>
            )}

            {/* ECリンク */}
            <a href="https://www.kaneishuzo.co.jp" target="_blank" rel="noopener noreferrer"
              className="block text-center h-[40px] leading-[40px] bg-white border border-[#BCCCDC] rounded-[8px] text-[13px] font-bold text-[#0F5B8D] hover:bg-[#E8F2F8] transition">
              オンラインショップ →
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
