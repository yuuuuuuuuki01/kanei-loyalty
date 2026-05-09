import { NextRequest, NextResponse } from "next/server";

const SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || "kaneishuzo.myshopify.com";
const STOREFRONT_TOKEN = process.env.SHOPIFY_CLIENT_SECRET!;

// Shopify Storefront API でメール+パスワードログイン
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "メールとパスワードを入力してください" }, { status: 400 });
  }

  // customerAccessTokenCreate でログイン
  const res = await fetch(`https://${SHOP_DOMAIN}/api/2025-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query: `mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
        customerAccessTokenCreate(input: $input) {
          customerAccessToken { accessToken expiresAt }
          customerUserErrors { code field message }
        }
      }`,
      variables: { input: { email, password } },
    }),
  });

  const data = await res.json();
  const result = data.data?.customerAccessTokenCreate;
  const errors = result?.customerUserErrors;

  if (errors?.length > 0) {
    return NextResponse.json({ error: errors[0].message }, { status: 401 });
  }

  const accessToken = result?.customerAccessToken?.accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: "ログインに失敗しました" }, { status: 500 });
  }

  // アクセストークンで顧客情報を取得
  const customerRes = await fetch(`https://${SHOP_DOMAIN}/api/2025-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query: `query { customer(customerAccessToken: "${accessToken}") {
        id firstName lastName email phone
      }}`,
    }),
  });

  const customerData = await customerRes.json();
  const c = customerData.data?.customer;

  if (!c) {
    return NextResponse.json({ error: "顧客情報の取得に失敗しました" }, { status: 500 });
  }

  // Supabaseにupsert
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "お客様";

  const { data: customer } = await supabaseAdmin
    .from("loyalty_customers")
    .upsert(
      { shopify_customer_id: c.id, email: c.email, name, phone: c.phone || null },
      { onConflict: "email" }
    )
    .select("id, email")
    .single();

  // セッション cookie
  const sessionToken = Buffer.from(JSON.stringify({
    customer_id: customer?.id,
    email: customer?.email,
    name,
  })).toString("base64");

  const response = NextResponse.json({ success: true, name });
  response.cookies.set("loyalty_session", sessionToken, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return response;
}
