"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface PendingRequest {
  id: string;
  customer_id: string;
  customer_name: string;
  created_at: string;
}

export default function StaffPage() {
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [activeRequest, setActiveRequest] = useState<PendingRequest | null>(null);
  const [amount, setAmount] = useState("");
  const [staffName, setStaffName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ stamps_added: number; new_stamps: number; card_completed: boolean } | null>(null);

  // リアルタイムでpendingリクエストを監視
  useEffect(() => {
    // 初回取得
    supabase
      .from("scan_events")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setPending(data);
      });

    // リアルタイム購読
    const channel = supabase
      .channel("staff-listener")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_events", filter: "status=eq.pending" },
        (payload) => {
          const newReq = payload.new as PendingRequest;
          setPending((prev) => [newReq, ...prev]);
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  async function approve() {
    if (!activeRequest || !amount) return;
    setLoading(true);
    setResult(null);

    // スタンプ付与RPC呼び出し
    const { data, error } = await supabase.rpc("add_purchase", {
      p_customer_id: activeRequest.customer_id,
      p_amount: parseInt(amount, 10),
      p_staff_name: staffName || null,
    });

    if (error) {
      alert("付与に失敗しました: " + error.message);
    } else {
      setResult(data);
      // scan_eventをapprovedに更新
      await supabase
        .from("scan_events")
        .update({ status: "approved", amount: parseInt(amount, 10) })
        .eq("id", activeRequest.id);
      // pendingリストから除去
      setPending((prev) => prev.filter((p) => p.id !== activeRequest.id));
    }
    setLoading(false);
  }

  function dismiss() {
    if (activeRequest) {
      supabase
        .from("scan_events")
        .update({ status: "dismissed" })
        .eq("id", activeRequest.id)
        .then(() => {
          setPending((prev) => prev.filter((p) => p.id !== activeRequest.id));
        });
    }
    setActiveRequest(null);
    setResult(null);
    setAmount("");
  }

  function handleKeypad(val: string) {
    if (val === "C") { setAmount(""); return; }
    if (val === "←") { setAmount((p) => p.slice(0, -1)); return; }
    setAmount((p) => p + val);
  }

  const previewStamps = amount ? Math.floor(parseInt(amount, 10) / 500) : 0;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-black text-gray-800">スタッフ用</h1>
          <p className="text-sm text-gray-500">金井酒造店 直売所</p>
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

        {/* 待ちリクエスト一覧 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3">
            スタンプ申請
            {pending.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-black rounded-full animate-pulse">
                {pending.length}
              </span>
            )}
          </h2>

          {pending.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📱</p>
              <p className="text-sm">お客様のスタンプ申請を待っています...</p>
              <p className="text-xs mt-1">お客様がQRコードを読み取ると、ここに表示されます</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pending.map((req) => (
                <button
                  key={req.id}
                  onClick={() => { setActiveRequest(req); setResult(null); setAmount(""); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                    activeRequest?.id === req.id
                      ? "border-amber-400 bg-amber-50"
                      : "border-gray-100 hover:border-amber-200 hover:bg-amber-50/50"
                  }`}
                >
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-800 font-black text-sm">
                    {req.customer_name.slice(0, 1)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800 text-sm">{req.customer_name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(req.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-full">対応する</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 金額入力 + 承認パネル */}
        {activeRequest && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-4 space-y-4 border-2 border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-gray-800">{activeRequest.customer_name}</p>
                <p className="text-xs text-gray-400">スタンプ申請</p>
              </div>
              <button onClick={dismiss} className="text-xs text-gray-400 hover:text-red-500 font-bold">
                却下
              </button>
            </div>

            {/* 金額表示 */}
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs font-bold text-gray-400 mb-1">購入金額</p>
              <p className="text-4xl font-black text-gray-800">
                ¥{amount ? parseInt(amount, 10).toLocaleString() : "0"}
              </p>
              <p className="text-sm text-amber-600 font-bold mt-1">
                → {previewStamps} スタンプ
              </p>
            </div>

            {/* テンキー */}
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9","C","0","←"].map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeypad(key)}
                  className={`py-4 rounded-xl font-black text-xl transition active:scale-95 ${
                    key === "C" || key === "←"
                      ? "bg-gray-100 text-gray-500 text-base"
                      : "bg-white border border-gray-200 text-gray-800 shadow-sm hover:shadow"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            {/* 承認ボタン */}
            <button
              onClick={approve}
              disabled={loading || !amount || parseInt(amount, 10) <= 0}
              className="w-full py-4 bg-green-600 text-white rounded-xl font-black text-lg hover:bg-green-700 disabled:opacity-50 transition active:scale-[0.98]"
            >
              {loading ? "処理中..." : `スタンプ付与（${previewStamps}個）`}
            </button>

            {/* 付与結果 */}
            {result && (
              <div className={`p-4 rounded-xl text-center ${result.card_completed ? "bg-amber-100 border-2 border-amber-400" : "bg-green-50 border border-green-200"}`}>
                {result.stamps_added > 0 ? (
                  <>
                    <p className="text-3xl font-black text-green-700">+{result.stamps_added}</p>
                    <p className="text-sm font-bold text-green-600">
                      スタンプ付与完了（合計 {result.new_stamps}個）
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
                <button
                  onClick={() => { setActiveRequest(null); setResult(null); setAmount(""); }}
                  className="mt-3 px-4 py-2 bg-white text-gray-600 rounded-lg text-sm font-bold border border-gray-200"
                >
                  完了
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
