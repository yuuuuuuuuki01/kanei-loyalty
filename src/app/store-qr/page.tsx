"use client";

import { QRCodeSVG } from "qrcode.react";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://yuuuuuuuuki01.github.io/kanei-loyalty";

export default function StoreQRPage() {
  const cardUrl = `${BASE_URL}/card`;

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="text-center space-y-8 max-w-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-amber-900">金井酒造店</h1>
          <p className="text-amber-700 font-medium">ポイントカード</p>
        </div>

        <div className="bg-white border-4 border-amber-200 rounded-3xl p-8 inline-block shadow-lg">
          <QRCodeSVG
            value={cardUrl}
            size={220}
            level="M"
            bgColor="#ffffff"
            fgColor="#78350f"
          />
        </div>

        <div className="space-y-2">
          <p className="text-lg font-bold text-gray-800">
            QRコードを読み取って
          </p>
          <p className="text-lg font-bold text-amber-800">
            ポイントカードを始めよう！
          </p>
          <p className="text-sm text-gray-500 mt-4">
            500円ごとに1スタンプ ｜ 貯めてお得な特典をゲット
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="px-6 py-3 bg-amber-800 text-white rounded-xl font-bold hover:bg-amber-900 transition print:hidden"
        >
          印刷する
        </button>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          main { background: white !important; }
        }
      `}</style>
    </main>
  );
}
