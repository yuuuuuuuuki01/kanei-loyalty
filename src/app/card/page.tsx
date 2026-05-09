"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
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

  async function loadCard(customerEmail: string) {
    setLoading(true);
    setError("");
    try {
      // 顧客取得
      const { data: customer } = await supabase
        .from("loyalty_customers")
        .select("id, name, email")
        .eq("email", customerEmail.trim().toLowerCase())
        .single();

      if (!customer) {
        setError("会員が見つかりません");
        setLoading(false);
        return;
      }

      // アクティブカード取得
      const { data: activeCard } = await supabase
        .from("stamp_cards")
        .select("*")
        .eq("customer_id", customer.id)
        .is("completed_at", null)
        .order("card_number", { ascending: false })
        .limit(1)
        .single();

      // 完了カード枚数
      const { count: completedCount } = await supabase
        .from("stamp_cards")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customer.id)
        .not("completed_at", "is", null);

      // ランク取得
      const { data: rankData } = await supabase
        .from("v_customer_rank")
        .select("rank")
        .eq("customer_id", customer.id)
        .single();

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
    } catch {
      setError("データの取得に失敗しました");
    }
    setLoading(false);
  }

  // URLパラメータからemailを取得
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("email");
    if (e) {
      setEmail(e);
      loadCard(e);
    }
  }, []);

  async function requestStamp() {
    if (!card) return;
    setStampRequested(true);
    await supabase.from("scan_events").insert({
      customer_id: card.customer_id,
      customer_name: card.customer_name,
      status: "pending",
    });
    // リアルタイムで承認を待つ
    const channel = supabase
      .channel("stamp-response")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "scan_events", filter: `customer_id=eq.${card.customer_id}` },
        (payload) => {
          if (payload.new.status === "approved") {
            setStampRequested(false);
            // カード再読み込み
            loadCard(card.customer_email);
            channel.unsubscribe();
          }
        }
      )
      .subscribe();
  }

  const stamps = card?.stamps_earned ?? 0;
  const rankCfg = card ? RANK_CONFIG[card.rank] : RANK_CONFIG.bronze;
  const carryOver = card ? card.total_spent % STAMP_UNIT : 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-amber-900 tracking-tight">金井酒造店</h1>
          <p className="text-sm text-amber-700 mt-1">ポイントカード</p>
        </div>

        {/* メール入力（未ログイン時） */}
        {!card && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <label className="block text-sm font-bold text-gray-700">
              メールアドレスで確認
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={() => loadCard(email)}
              disabled={loading || !email}
              className="w-full py-3 bg-amber-800 text-white rounded-xl font-bold hover:bg-amber-900 transition disabled:opacity-50"
            >
              {loading ? "読み込み中..." : "カードを表示"}
            </button>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </div>
        )}

        {/* スタンプカード表示 */}
        {card && (
          <div className="space-y-6">
            {/* ランクバッジ + 会員情報 */}
            <div
              className="rounded-2xl p-4 border-2"
              style={{ background: rankCfg.bg, borderColor: rankCfg.border }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-black" style={{ color: rankCfg.color }}>
                    {card.customer_name}
                  </p>
                  <p className="text-xs text-gray-500">{card.customer_email}</p>
                </div>
                <div
                  className="px-3 py-1 rounded-full text-xs font-black"
                  style={{ background: rankCfg.border, color: "#fff" }}
                >
                  {rankCfg.label}
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: rankCfg.color }}>
                カード {card.card_number}枚目 ｜ 完了 {card.cards_completed}枚
              </p>
            </div>

            {/* スタンプグリッド */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800">スタンプ</h2>
                <span className="text-2xl font-black text-amber-800">
                  {stamps}<span className="text-sm font-bold text-gray-400"> / {STAMPS_PER_CARD}</span>
                </span>
              </div>

              <div className="grid grid-cols-10 gap-1.5">
                {Array.from({ length: STAMPS_PER_CARD }, (_, i) => {
                  const num = i + 1;
                  const filled = num <= stamps;
                  const isReward = REWARDS.some((r) => r.step === num);
                  const rewardClaimed = card.rewards_claimed.includes(num);

                  return (
                    <div
                      key={i}
                      className={`
                        aspect-square rounded-full flex items-center justify-center text-[9px] font-bold
                        transition-all
                        ${filled
                          ? isReward
                            ? rewardClaimed
                              ? "bg-green-500 text-white"
                              : "bg-amber-500 text-white ring-2 ring-amber-300 animate-pulse"
                            : "bg-amber-800 text-white"
                          : isReward
                            ? "bg-amber-100 text-amber-600 ring-1 ring-amber-300"
                            : "bg-gray-100 text-gray-300"
                        }
                      `}
                    >
                      {isReward ? "★" : filled ? "●" : num}
                    </div>
                  );
                })}
              </div>

              {/* 繰越金額 */}
              {carryOver > 0 && (
                <p className="text-xs text-gray-400 mt-3 text-center">
                  次のスタンプまであと {STAMP_UNIT - carryOver}円（繰越: {carryOver}円）
                </p>
              )}
            </div>

            {/* 特典一覧 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-3">
              <h2 className="font-bold text-gray-800 mb-2">特典</h2>
              {REWARDS.map((reward) => {
                const claimed = card.rewards_claimed.includes(reward.step);
                const reached = stamps >= reward.step;
                return (
                  <div
                    key={reward.step}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      claimed
                        ? "bg-green-50 border-green-200"
                        : reached
                          ? "bg-amber-50 border-amber-300"
                          : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                        claimed
                          ? "bg-green-500 text-white"
                          : reached
                            ? "bg-amber-500 text-white"
                            : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      {claimed ? "✓" : reward.step}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${claimed ? "text-green-700" : "text-gray-700"}`}>
                        {reward.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {claimed ? "交換済み" : reached ? "交換可能！" : `あと ${reward.step - stamps} スタンプ`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* スタンプ申請ボタン */}
            <button
              onClick={requestStamp}
              disabled={stampRequested}
              className={`w-full py-4 rounded-2xl font-black text-lg transition shadow-lg ${
                stampRequested
                  ? "bg-green-100 text-green-700 border-2 border-green-300"
                  : "bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]"
              }`}
            >
              {stampRequested ? "✓ スタンプ申請中..." : "スタンプをもらう"}
            </button>
            {stampRequested && (
              <p className="text-center text-sm text-green-600 animate-pulse">
                スタッフが確認中です。しばらくお待ちください。
              </p>
            )}

            {/* ECリンク */}
            <a
              href="https://kaneishuzo.myshopify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center py-3 bg-amber-800 text-white rounded-xl font-bold hover:bg-amber-900 transition"
            >
              オンラインショップでお買い物 →
            </a>

            {/* 別アカウント */}
            <button
              onClick={() => { setCard(null); setEmail(""); setError(""); }}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
            >
              別のアカウントで確認
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
