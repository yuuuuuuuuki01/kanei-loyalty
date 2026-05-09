import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 py-12 text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-amber-900 tracking-tight">金井酒造店</h1>
          <p className="text-amber-700 font-medium">ポイントカード</p>
        </div>

        <div className="space-y-4">
          <Link
            href="/card"
            className="block w-full py-4 bg-amber-800 text-white rounded-2xl font-bold text-lg hover:bg-amber-900 transition shadow-lg"
          >
            ポイントカードを見る
          </Link>

          <Link
            href="/staff"
            className="block w-full py-4 bg-white text-amber-800 border-2 border-amber-200 rounded-2xl font-bold hover:bg-amber-50 transition"
          >
            スタッフ用（スタンプ付与）
          </Link>

          <Link
            href="/store-qr"
            className="block w-full py-3 text-gray-500 text-sm font-medium hover:text-amber-800 transition"
          >
            店頭QRコード印刷
          </Link>
        </div>

        <p className="text-xs text-gray-400">
          500円ごとに1スタンプ ｜ 60スタンプで1カード完了
        </p>
      </div>
    </main>
  );
}
