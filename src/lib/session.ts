export interface LoyaltySession {
  customer_id: string;
  email: string;
  name: string;
}

export function getSession(): LoyaltySession | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith("loyalty_session="));
  if (!cookie) return null;
  try {
    const value = cookie.split("=")[1];
    return JSON.parse(atob(value));
  } catch {
    return null;
  }
}

export function clearSession(): void {
  document.cookie = "loyalty_session=; path=/; max-age=0";
}
