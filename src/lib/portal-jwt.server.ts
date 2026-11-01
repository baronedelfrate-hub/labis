// Server-only. HS256 JWT via Web Crypto (Cloudflare Workers compatible).

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlEncodeStr(s: string): string {
  return b64urlEncode(new TextEncoder().encode(s));
}
function b64urlDecode(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

export interface PortalJwtPayload {
  order_id: string;
  company_id: string;
}

export async function signPortalJwt(payload: PortalJwtPayload, ttlSeconds = 20 * 60): Promise<string> {
  const secret = process.env.PORTAL_JWT_SECRET;
  if (!secret) throw new Error("PORTAL_JWT_SECRET não configurado");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const unsigned = `${b64urlEncodeStr(JSON.stringify(header))}.${b64urlEncodeStr(JSON.stringify(body))}`;
  const key = await getKey(secret, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${b64urlEncode(sig)}`;
}

export async function verifyPortalJwt(token: string): Promise<PortalJwtPayload | null> {
  const secret = process.env.PORTAL_JWT_SECRET;
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const key = await getKey(secret, ["verify"]);
  const sigBytes = b64urlDecode(s);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength) as ArrayBuffer,
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as PortalJwtPayload & { exp: number };
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return { order_id: payload.order_id, company_id: payload.company_id };
  } catch {
    return null;
  }
}
