import { NextRequest, NextResponse } from "next/server";

// Shopify Customer Account API OAuth 開始
export async function GET(req: NextRequest) {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!;
  const clientId = process.env.SHOPIFY_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;
  const scope = "openid email customer-account-api:full";

  // state をランダム生成（CSRF対策）
  const state = crypto.randomUUID();

  const authUrl = new URL(`https://shopify.com/authentication/${shopDomain}/authorize`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
  });

  return response;
}
