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

const RANK_GRADIENT: Record<RankName, string> = {
  bronze: "from-amber-900 via-amber-800 to-yellow-900",
  silver: "from-slate-600 via-slate-500 to-slate-400",
  gold: "from-yellow-600 via-amber-500 to-yellow-400",
  platinum: "from-cyan-800 via-sky-600 to-blue-500",
  diamond: "from-violet-800 via-purple-600 to-fuchsia-500",
};

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
        .from("loyalty_customers")
        .select("id, name, email")
        .eq("email", customerEmail.trim().toLowerCase())
        .single();

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
        customer_id: customer.id,
        customer_name: customer.name,
        customer_email: customer.email,
        card_number: activeCard?.card_number ?? 1,
        total_spent: activeCard?.total_spent ?? 0,
        stamps_earned: activeCard?.stamps_earned ?? 0,
        rewards_claimed: activeCard?.rewards_claimed ?? [],
        cards_completed: completedCount ?? 0,
        rank: (rankData?.rank as RankName) ?? "bronze",
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
    <main className="min-h-screen bg-[#0f0f0f] text-white">
      <div className="max-w-md mx-auto px-4 py-6">

        {/* ── 未ログイン ── */}
        {!card && !loading && (
          <div className="min-h-[80vh] flex flex-col justify-center">
            {/* ブランドヘッダー */}
            <div className="text-center mb-10">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center shadow-lg shadow-amber-900/30">
                <span className="text-3xl">🍶</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight">金井酒造店</h1>
              <p className="text-white/40 text-sm mt-1 tracking-widest uppercase">Members Card</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 space-y-4 border border-white/10">
              <h2 className="text-center text-lg font-bold">
                {authMode === "login" ? "ログイン" : "新規登録"}
              </h2>

              {authMode === "register" && (
                <div className="flex gap-2">
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    placeholder="姓" className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500" />
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                    placeholder="名" className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500" />
                </div>
              )}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500" />
              {authMode === "register" && (
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="電話番号（任意）" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500" />
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
                className="w-full py-4 bg-gradient-to-r from-amber-700 to-amber-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-amber-800/30 hover:shadow-amber-700/50 transition-all active:scale-[0.98] disabled:opacity-40"
              >
                {authMode === "login" ? "ログイン" : "登録してはじめる"}
              </button>

              <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }}
                className="w-full text-center text-sm text-amber-400/80 hover:text-amber-300">
                {authMode === "login" ? "アカウントをお持ちでない方 → 新規登録" : "アカウントをお持ちの方 → ログイン"}
              </button>

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            </div>
          </div>
        )}

        {loading && !card && (
          <div className="min-h-[80vh] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* ── 会員証カード表示 ── */}
        {card && (
          <div className="space-y-5">

            {/* メインカード */}
            <div className={`relative rounded-[1.5rem] overflow-hidden bg-gradient-to-br ${RANK_GRADIENT[card.rank]} p-6 shadow-2xl`}>
              {/* 装飾 */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />

              <div className="relative z-10">
                {/* ブランド */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">Members Card</p>
                    <h1 className="text-lg font-black tracking-tight">金井酒造店</h1>
                  </div>
                  <div className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full">
                    <span className="text-xs font-black uppercase tracking-wider">{rankCfg.label}</span>
                  </div>
                </div>

                {/* 会員名 */}
                <div className="mb-6">
                  <p className="text-2xl font-black tracking-wide">{card.customer_name}</p>
                  <p className="text-white/50 text-xs mt-1">Card No.{card.card_number} ｜ {card.cards_completed}枚完了</p>
                </div>

                {/* プログレスバー */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-white/70">{stamps} / {STAMPS_PER_CARD} stamps</span>
                    <span className="text-white/70">{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/80 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  {nextReward && (
                    <p className="text-white/50 text-[11px]">
                      次の特典「{nextReward.name}」まで あと{nextReward.step - stamps}スタンプ
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* スタンプグリッド */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Stamps</h2>
                {carryOver > 0 && (
                  <span className="text-[11px] text-amber-400/80">
                    繰越 ¥{carryOver} → 次まで ¥{STAMP_UNIT - carryOver}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-10 gap-[6px]">
                {Array.from({ length: STAMPS_PER_CARD }, (_, i) => {
                  const num = i + 1;
                  const filled = num <= stamps;
                  const isReward = REWARDS.some((r) => r.step === num);
                  const rewardClaimed = card.rewards_claimed.includes(num);

                  return (
                    <div
                      key={i}
                      className={`
                        aspect-square rounded-lg flex items-center justify-center text-[8px] font-bold transition-all
                        ${filled
                          ? isReward
                            ? rewardClaimed
                              ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                              : "bg-amber-400 text-amber-900 shadow-md shadow-amber-400/40 animate-pulse"
                            : "bg-white/90 text-gray-800 shadow-sm"
                          : isReward
                            ? "bg-amber-400/20 text-amber-400 border border-amber-400/40"
                            : "bg-white/5 text-white/20 border border-white/5"
                        }
                      `}
                    >
                      {isReward ? "★" : filled ? "●" : ""}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 特典一覧 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10 space-y-3">
              <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3">Rewards</h2>
              {REWARDS.map((reward) => {
                const claimed = card.rewards_claimed.includes(reward.step);
                const reached = stamps >= reward.step;
                return (
                  <div
                    key={reward.step}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                      claimed
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : reached
                          ? "bg-amber-500/10 border border-amber-400/30"
                          : "bg-white/5 border border-white/5"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      claimed ? "bg-emerald-500 text-white" : reached ? "bg-amber-400 text-amber-900" : "bg-white/10 text-white/30"
                    }`}>
                      {claimed ? "✓" : reward.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${claimed ? "text-emerald-400" : reached ? "text-amber-300" : "text-white/60"}`}>
                        {reward.name}
                      </p>
                      <p className={`text-xs ${claimed ? "text-emerald-400/60" : "text-white/30"}`}>
                        {claimed ? "交換済み" : reached ? "交換可能" : `あと ${reward.step - stamps} スタンプ`}
                      </p>
                    </div>
                    {reached && !claimed && (
                      <div className="px-3 py-1 bg-amber-400 text-amber-900 text-[10px] font-black rounded-full uppercase">Get</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* スタンプ申請ボタン */}
            <button
              onClick={requestStamp}
              disabled={stampRequested}
              className={`w-full py-5 rounded-2xl font-black text-lg transition-all ${
                stampRequested
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-600/30 hover:shadow-emerald-500/50 active:scale-[0.98]"
              }`}
            >
              {stampRequested ? "✓ スタンプ申請中..." : "スタンプをもらう"}
            </button>
            {stampRequested && (
              <p className="text-center text-xs text-emerald-400/70 animate-pulse">
                スタッフが確認中です
              </p>
            )}

            {/* ECリンク */}
            <a
              href="https://www.kaneishuzo.co.jp"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center py-4 bg-white/5 border border-white/10 rounded-2xl text-white/70 font-bold text-sm hover:bg-white/10 hover:text-white transition-all"
            >
              オンラインショップ →
            </a>

            {/* ログアウト */}
            <button
              onClick={() => { clearSession(); setCard(null); setEmail(""); setError(""); }}
              className="w-full text-center text-xs text-white/20 hover:text-white/50 py-2"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
