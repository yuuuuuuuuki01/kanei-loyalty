import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const savedState = req.cookies.get("oauth_state")?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/?error=invalid_state", req.url));
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
  const clientId = process.env.SHOPIFY_CLIENT_ID!;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

  // code → access_token 交換
  const tokenRes = await fetch(`https://shopify.com/authentication/${shopDomain}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/?error=token_failed", req.url));
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // Shopify Customer Account API で顧客情報取得
  const customerRes = await fetch(`https://shopify.com/${shopDomain}/account/customer/api/2025-01/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query: `{ customer { id firstName lastName emailAddress { emailAddress } phoneNumber { phoneNumber } } }`,
    }),
  });

  const customerData = await customerRes.json();
  const c = customerData.data?.customer;

  if (!c) {
    return NextResponse.redirect(new URL("/?error=no_customer", req.url));
  }

  const shopifyId = c.id; // gid://shopify/Customer/123
  const email = c.emailAddress?.emailAddress || "";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "お客様";
  const phone = c.phoneNumber?.phoneNumber || null;

  // loyalty_customers に upsert
  const supabaseAdmin = getSupabaseAdmin();
  const { data: customer } = await supabaseAdmin
    .from("loyalty_customers")
    .upsert(
      { shopify_customer_id: shopifyId, email, name, phone },
      { onConflict: "email" }
    )
    .select("id, email")
    .single();

  // セッションとして簡易トークンをcookieに保存
  const sessionToken = Buffer.from(JSON.stringify({
    customer_id: customer?.id,
    email: customer?.email,
    name,
  })).toString("base64");

  const response = NextResponse.redirect(new URL("/card", req.url));
  response.cookies.set("loyalty_session", sessionToken, {
    httpOnly: false, // クライアント側で読む必要あり
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30日
    path: "/",
  });
  response.cookies.delete("oauth_state");

  return response;
}
