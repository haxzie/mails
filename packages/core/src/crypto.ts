const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomToken(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function randomCode(digits = 6): string {
  const max = 10 ** digits;
  const value = crypto.getRandomValues(new Uint32Array(1))[0]! % max;
  return value.toString().padStart(digits, "0");
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-safe, timing-safe string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * `<base64url(payload)>.<base64url(hmac)>` — used for unsubscribe and
 * tracking links, so they are verifiable without a database lookup.
 */
export async function signPayload(
  payload: string,
  secret: string,
): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(payload),
  );
  return `${toBase64Url(encoder.encode(payload))}.${toBase64Url(
    new Uint8Array(signature),
  )}`;
}

export async function verifyPayload(
  token: string,
  secret: string,
): Promise<string | null> {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  let payload: string;
  try {
    payload = decoder.decode(fromBase64Url(encodedPayload));
  } catch {
    return null;
  }
  const expected = await signPayload(payload, secret);
  return safeEqual(expected, token) ? payload : null;
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** AES-GCM encrypt a secret at rest (SES keys). Returns `iv:ciphertext`. */
export async function encryptSecret(
  plaintext: string,
  secret: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await aesKey(secret),
    encoder.encode(plaintext),
  );
  return `${toBase64Url(iv)}:${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(
  value: string,
  secret: string,
): Promise<string> {
  const [iv, ciphertext] = value.split(":");
  if (!iv || !ciphertext) throw new Error("Malformed encrypted value");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(iv) },
    await aesKey(secret),
    fromBase64Url(ciphertext),
  );
  return decoder.decode(plaintext);
}
