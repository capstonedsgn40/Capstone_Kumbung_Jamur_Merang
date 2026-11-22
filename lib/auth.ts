export const SESSION_COOKIE = "mushroom_session";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(payload: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET belum dikonfigurasi");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function signSession(): Promise<string> {
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `mushroom:${expiresAt}`;
  return `${payload}:${await hmac(payload)}`;
}

export async function verifySession(
  cookie: string | undefined,
): Promise<boolean> {
  if (!cookie) return false;
  const parts = cookie.split(":");
  if (parts.length !== 3) return false;
  const expiresAt = Number(parts[1]);
  if (
    !Number.isFinite(expiresAt) ||
    expiresAt < Date.now() ||
    parts[0] !== "mushroom"
  )
    return false;

  const payload = `${parts[0]}:${parts[1]}`;
  const expected = await hmac(payload);
  const actual = base64UrlToBytes(parts[2]);
  const wanted = base64UrlToBytes(expected);
  if (actual.length !== wanted.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index++)
    mismatch |= actual[index] ^ wanted[index];
  return mismatch === 0;
}
