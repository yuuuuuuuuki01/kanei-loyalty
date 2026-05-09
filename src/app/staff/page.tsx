"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function StaffPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [customer, setCustomer] = useState<{ id: string; name: string; email: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [staffName, setStaffName] = useState("");
  const [result, setResult] = useState<{ stamps_added: number; new_stamps: number; card_completed: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 新規会員登録
  const [showRegister, setShowRegister] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  async function searchCustomer() {
    setError("");
    setCustomer(null);
    setResult(null);

    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    const { data } = await supabase
      .from("loyalty_customers")
      .select("id, name, email")
      .or(`email.ilike.%${q}%,name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(1)
      .single();

    if (data) {
      setCustomer(data);
    } else {
      setError("会員が見つかりません");
    }
  }

  async function addPurchase() {
    if (!customer || !amount) return;
    setLoading(true);
    setError("");
    setResult(null);

    const { data, error: rpcError } = await supabase.rpc("add_purchase", {
      p_customer_id: customer.id,
      p_amount: parseInt(amount, 10),
      p_staff_name: staffName || null,
    });

    if (rpcError) {
      setError("スタンプ付与に失敗しました: " + rpcError.message);
    } else {
      setResult(data);
      setAmount("");
    }
    setLoading(false);
  }

  async function registerCustomer() {
    if (!newName || !newEmail) return;
    setLoading(true);
    setError("");

    const { data, error: insertError } = await supabase
      .from("loyalty_customers")
      .insert({ name: newName.trim(), email: newEmail.trim().toLowerCase(), phone: newPhone.trim() || null })
      .select("id, name, email")
      .single();

    if (insertError) {
      setError("登録に失敗しました: " + insertError.message);
    } else if (data) {
      setCustomer(data);
      setShowRegister(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-xl font-black text-gray-800">スタッフ用 スタンプ付与</h1>
          <p className="text-sm text-gray-500 mt-1">金井酒造店 直売所</p>
        </div>

        {/* 担当者名 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <label className="block text-xs font-bold text-gray-500 mb-1">担当者名</label>
          <input
            type="text"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            placeholder="田中"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {/* 会員検索 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3">
          <label className="block text-xs font-bold text-gray-500">会員検索</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchCustomer()}
              placeholder="名前・メール・電話番号"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={searchCustomer}
              className="px-4 py-2 bg-amber-800 text-white rounded-lg text-sm font-bold hover:bg-amber-900"
            >
              検索
            </button>
          </div>
          <button
            onClick={() => setShowRegister(!showRegister)}
            className="text-sm text-amber-700 font-bold hover:underline"
          >
            {showRegister ? "▲ 閉じる" : "＋ 新規会員登録"}
          </button>
        </div>

        {/* 新規登録フォーム */}
        {showRegister && (
          <div className="bg-amber-50 rounded-xl p-4 mb-4 space-y-3 border border-amber-200">
            <h3 className="text-sm font-bold text-amber-800">新規会員登録</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="お名前"
              className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="メールアドレス"
              className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="電話番号（任意）"
              className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={registerCustomer}
              disabled={loading || !newName || !newEmail}
              className="w-full py-2 bg-amber-800 text-white rounded-lg text-sm font-bold hover:bg-amber-900 disabled:opacity-50"
            >
              登録
            </button>
          </div>
        )}

        {/* 選択された会員 */}
        {customer && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800">{customer.name}</p>
                <p className="text-xs text-gray-400">{customer.email}</p>
              </div>
              <button
                onClick={() => { setCustomer(null); setResult(null); }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                変更
              </button>
            </div>

            {/* 金額入力 */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">購入金額（税込）</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">¥</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPurchase()}
                    placeholder="1500"
                    min="0"
                    className="w-full pl-8 pr-3 py-3 border border-gray-200 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <button
                  onClick={addPurchase}
                  disabled={loading || !amount || parseInt(amount) <= 0}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-black text-lg hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {loading ? "..." : "付与"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {amount && parseInt(amount) > 0
                  ? `→ ${Math.floor(parseInt(amount) / 500)} スタンプ付与`
                  : "500円ごとに1スタンプ"}
              </p>
            </div>

            {/* 付与結果 */}
            {result && (
              <div className={`p-4 rounded-xl text-center ${result.card_completed ? "bg-amber-100 border-2 border-amber-400" : "bg-green-50 border border-green-200"}`}>
                {result.stamps_added > 0 ? (
                  <>
                    <p className="text-3xl font-black text-green-700">+{result.stamps_added}</p>
                    <p className="text-sm font-bold text-green-600">
                      スタンプ付与（合計 {result.new_stamps}個）
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-gray-500">金額が繰り越されました</p>
                )}
                {result.card_completed && (
                  <p className="text-sm font-black text-amber-700 mt-2">
                    🎉 カード完了！ 新しいカードに切り替わりました
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
      </div>
    </main>
  );
}
