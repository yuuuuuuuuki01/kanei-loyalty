import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// 新規会員登録
export async function POST(req: NextRequest) {
  const { firstName, lastName, email, password, phone } = await req.json();

  if (!email || !password || !firstName) {
    return NextResponse.json({ error: "必須項目を入力してください" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "パスワードは6文字以上で設定してください" }, { status: 400 });
  }

  const supabase = getSupabase();
  const emailLower = email.trim().toLowerCase();
  const name = [firstName, lastName].filter(Boolean).join(" ");

  // 既存チェック
  const { data: existing } = await supabase
    .from("loyalty_customers")
    .select("id")
    .eq("email", emailLower)
    .single();

  if (existing) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 400 });
  }

  // パスワードハッシュ
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 16));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  // 顧客登録
  const { data: customer, error } = await supabase
    .from("loyalty_customers")
    .insert({ email: emailLower, name, phone: phone || null, password_hash: hash })
    .select("id, email, name")
    .single();

  if (error || !customer) {
    return NextResponse.json({ error: "登録に失敗しました。もう一度お試しください。" }, { status: 500 });
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
