import { createHmac, timingSafeEqual } from "crypto";

const SIG_LEN = 32; // hex-encoded HMAC-SHA256 length
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionPayload {
  memberId: number;
  username: string;
  email: string | null;
  iat: number; // epoch ms
}

function sign(value: string, secret: string): string {
  const hmac = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${hmac}`;
}

export function createSessionToken(
  payload: SessionPayload,
  secret: string
): string {
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return sign(json, secret);
}

export function verifySessionToken(
  token: string,
  secret: string
): { valid: false } | { valid: true; payload: SessionPayload; expired: boolean } {
  if (!token || typeof token !== "string") return { valid: false };

  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1 || lastDot !== token.length - SIG_LEN - 1) {
    return { valid: false };
  }

  const value = token.slice(0, lastDot);
  const expected = sign(value, secret);

  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(token))) {
      return { valid: false };
    }
  } catch {
    return { valid: false };
  }

  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const payload = JSON.parse(json) as SessionPayload;
    const expired = Date.now() - payload.iat > MAX_AGE_MS;
    return { valid: true, payload, expired };
  } catch {
    return { valid: false };
  }
}

export function setAuthCookie(
  res: any,
  token: string,
  options?: { maxAge?: number; sameSite?: string }
): void {
  const maxAge = options?.maxAge ?? MAX_AGE_MS;
  const sameSite = options?.sameSite ?? "None";
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("tcs_auth", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: sameSite as any,
    maxAge,
    path: "/",
  });
}

export function clearAuthCookie(res: any): void {
  res.clearCookie("tcs_auth", { path: "/" });
}
