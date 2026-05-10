import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// メール+パスワードでログイン（loyalty_customersから照合）
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "メールとパスワードを入力してください" }, { status: 400 });
  }

  const supabase = getSupabase();

  // 顧客検索
  const { data: customer } = await supabase
    .from("loyalty_customers")
    .select("id, name, email, password_hash")
    .eq("email", email.trim().toLowerCase())
    .single();

  if (!customer) {
    return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 401 });
  }

  // 簡易パスワード照合（SHA-256ハッシュ）
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 16));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  if (customer.password_hash && customer.password_hash !== hash) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  // パスワード未設定の場合はセット
  if (!customer.password_hash) {
    await supabase.from("loyalty_customers").update({ password_hash: hash }).eq("id", customer.id);
  }

  const sessionToken = Buffer.from(JSON.stringify({
    customer_id: customer.id,
    email: customer.email,
    name: customer.name,
  })).toString("base64");

  const response = NextResponse.json({ success: true, name: customer.name });
  response.cookies.set("loyalty_session", sessionToken, {
    httpOnly: false, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
  });

  return response;
}
