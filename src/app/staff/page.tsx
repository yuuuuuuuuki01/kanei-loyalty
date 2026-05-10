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

  useEffect(() => {
    supabase.from("scan_events").select("*").eq("status", "pending").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setPending(data); });

    const channel = supabase.channel("staff-listener")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scan_events", filter: "status=eq.pending" },
        (payload) => { setPending((prev) => [payload.new as PendingRequest, ...prev]); })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  async function approve() {
    if (!activeRequest || !amount) return;
    setLoading(true); setResult(null);
    const { data, error } = await supabase.rpc("add_purchase", {
      p_customer_id: activeRequest.customer_id, p_amount: parseInt(amount, 10), p_staff_name: staffName || null,
    });
    if (error) { alert("付与に失敗しました: " + error.message); }
    else {
      setResult(data);
      await supabase.from("scan_events").update({ status: "approved", amount: parseInt(amount, 10) }).eq("id", activeRequest.id);
      setPending((prev) => prev.filter((p) => p.id !== activeRequest.id));
    }
    setLoading(false);
  }

  function dismiss() {
    if (activeRequest) {
      supabase.from("scan_events").update({ status: "dismissed" }).eq("id", activeRequest.id)
        .then(() => { setPending((prev) => prev.filter((p) => p.id !== activeRequest.id)); });
    }
    setActiveRequest(null); setResult(null); setAmount("");
  }

  function handleKeypad(val: string) {
    if (val === "C") { setAmount(""); return; }
    if (val === "←") { setAmount((p) => p.slice(0, -1)); return; }
    setAmount((p) => p + val);
  }

  const previewStamps = amount ? Math.floor(parseInt(amount, 10) / 500) : 0;

  return (
    <main className="min-h-screen bg-[#F7FAFC]" style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", "Inter", sans-serif' }}>
      <div className="max-w-lg mx-auto px-5 py-6">

        {/* ヘッダー */}
        <header className="mb-6">
          <h1 className="text-[18px] font-bold text-[#1F2933] leading-[1.45]">スタンプ付与</h1>
          <p className="text-[12px] text-[#52606D]">金井酒造店 直売所</p>
        </header>

        {/* 担当者 */}
        <div className="bg-white rounded-[12px] border border-[#E5EDF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-4 mb-4">
          <label className="block text-[11px] font-bold text-[#52606D] uppercase tracking-[0.05em] mb-1.5">担当者</label>
          <input type="text" value={staffName} onChange={(e) => setStaffName(e.target.value)}
            placeholder="氏名を入力" className="w-full h-[40px] px-3 text-[14px] border border-[#BCCCDC] rounded-[8px] bg-white placeholder:text-[#9AA5B1] focus:outline-none focus:ring-[3px] focus:ring-[rgba(15,91,141,0.14)]" />
        </div>

        {/* 申請一覧 */}
        <div className="bg-white rounded-[12px] border border-[#E5EDF5] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[12px] font-bold text-[#52606D] uppercase tracking-[0.05em]">スタンプ申請</h2>
            {pending.length > 0 && (
              <span className="min-w-[20px] h-[20px] flex items-center justify-center bg-[#C53D3D] text-white text-[10px] font-bold rounded-full px-1 animate-pulse">
                {pending.length}
              </span>
            )}
          </div>

          {pending.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[13px] text-[#9AA5B1]">申請を待機中...</p>
              <p className="text-[11px] text-[#9AA5B1] mt-1">お客様がQRコードを読み取ると表示されます</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pending.map((req) => (
                <button key={req.id}
                  onClick={() => { setActiveRequest(req); setResult(null); setAmount(""); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-[8px] border transition text-left ${
                    activeRequest?.id === req.id ? "border-[#0F5B8D] bg-[#E8F2F8]" : "border-[#D9E2EC] hover:border-[#BCCCDC] hover:bg-[#F2F5F7]"
                  }`}>
                  <div className="w-9 h-9 bg-[#E8F2F8] rounded-[8px] flex items-center justify-center text-[#0F5B8D] text-[13px] font-bold shrink-0">
                    {req.customer_name.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[#1F2933] truncate">{req.customer_name}</p>
                    <p className="text-[11px] text-[#9AA5B1]">
                      {new Date(req.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-[#0F5B8D] bg-[#E8F2F8] px-2 py-1 rounded-full">対応</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 金額入力パネル */}
        {activeRequest && (
          <div className="bg-white rounded-[12px] border-2 border-[#0F5B8D] shadow-[0_4px_12px_rgba(15,91,141,0.1)] p-5 mb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-bold text-[#1F2933]">{activeRequest.customer_name}</p>
                <p className="text-[11px] text-[#52606D]">スタンプ付与</p>
              </div>
              <button onClick={dismiss} className="text-[11px] text-[#C53D3D] font-bold hover:underline">却下</button>
            </div>

            {/* 金額表示 */}
            <div className="bg-[#F2F5F7] rounded-[8px] p-4 text-center border border-[#D9E2EC]">
              <p className="text-[11px] font-bold text-[#52606D] mb-1">購入金額</p>
              <p className="text-[28px] font-bold text-[#1F2933] tracking-tight" style={{ fontFamily: '"Inter", "JetBrains Mono", monospace' }}>
                ¥{amount ? parseInt(amount, 10).toLocaleString() : "0"}
              </p>
              <p className="text-[13px] font-bold text-[#0F5B8D] mt-1">
                → {previewStamps} スタンプ付与
              </p>
            </div>

            {/* テンキー */}
            <div className="grid grid-cols-3 gap-2">
              {["1","2","3","4","5","6","7","8","9","C","0","←"].map((key) => (
                <button key={key} onClick={() => handleKeypad(key)}
                  className={`h-[48px] rounded-[8px] text-[18px] font-bold transition active:scale-95 ${
                    key === "C" ? "bg-[#F2F5F7] text-[#C53D3D] border border-[#D9E2EC] text-[14px]"
                    : key === "←" ? "bg-[#F2F5F7] text-[#52606D] border border-[#D9E2EC]"
                    : "bg-white text-[#1F2933] border border-[#BCCCDC] hover:bg-[#F7FAFC]"
                  }`}>
                  {key}
                </button>
              ))}
            </div>

            {/* 承認 */}
            <button onClick={approve}
              disabled={loading || !amount || parseInt(amount, 10) <= 0}
              className="w-full h-[48px] bg-[#2F855A] text-white rounded-[8px] text-[14px] font-bold hover:bg-[#276749] transition disabled:opacity-40 active:scale-[0.99]">
              {loading ? "処理中..." : `スタンプ付与（${previewStamps}個）`}
            </button>

            {/* 結果 */}
            {result && (
              <div className={`p-4 rounded-[8px] text-center border ${result.card_completed ? "bg-[#FFFFF0] border-[#FEFCBF]" : "bg-[#F0FFF4] border-[#C6F6D5]"}`}>
                {result.stamps_added > 0 ? (
                  <>
                    <p className="text-[24px] font-bold text-[#2F855A]">+{result.stamps_added}</p>
                    <p className="text-[13px] font-bold text-[#2F855A]">付与完了（合計 {result.new_stamps}個）</p>
                  </>
                ) : (
                  <p className="text-[13px] text-[#52606D]">金額が繰り越されました</p>
                )}
                {result.card_completed && (
                  <p className="text-[13px] font-bold text-[#B7791F] mt-2">カード完了！ 新しいカードに切り替わりました</p>
                )}
                <button onClick={() => { setActiveRequest(null); setResult(null); setAmount(""); }}
                  className="mt-3 h-[36px] px-4 bg-white border border-[#BCCCDC] rounded-[8px] text-[12px] font-bold text-[#52606D] hover:bg-[#F2F5F7]">
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
