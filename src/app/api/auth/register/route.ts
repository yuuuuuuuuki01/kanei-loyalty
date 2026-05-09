import { NextRequest, NextResponse } from "next/server";

const SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || "kaneishuzo.myshopify.com";
const STOREFRONT_TOKEN = process.env.SHOPIFY_CLIENT_SECRET!;

// Shopify Storefront API で新規顧客登録
export async function POST(req: NextRequest) {
  const { firstName, lastName, email, password, phone } = await req.json();

  if (!email || !password || !firstName) {
    return NextResponse.json({ error: "必須項目を入力してください" }, { status: 400 });
  }

  // customerCreate で新規登録
  const res = await fetch(`https://${SHOP_DOMAIN}/api/2025-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query: `mutation customerCreate($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
          customer { id firstName lastName email phone }
          customerUserErrors { code field message }
        }
      }`,
      variables: {
        input: { firstName, lastName: lastName || "", email, password, phone: phone || null },
      },
    }),
  });

  const data = await res.json();
  const result = data.data?.customerCreate;
  const errors = result?.customerUserErrors;

  if (errors?.length > 0) {
    return NextResponse.json({ error: errors[0].message }, { status: 400 });
  }

  const c = result?.customer;
  if (!c) {
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }

  // Supabaseにも登録
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");

  const { data: customer } = await supabaseAdmin
    .from("loyalty_customers")
    .upsert(
      { shopify_customer_id: c.id, email: c.email, name, phone: c.phone || null },
      { onConflict: "email" }
    )
    .select("id, email")
    .single();

  // 自動ログイン
  const loginRes = await fetch(`https://${SHOP_DOMAIN}/api/2025-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({
      query: `mutation { customerAccessTokenCreate(input: { email: "${email}", password: "${password}" }) {
        customerAccessToken { accessToken }
        customerUserErrors { message }
      }}`,
    }),
  });

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
