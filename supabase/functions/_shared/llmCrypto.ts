// AES-GCM helpers using LLM_KEYS_ENC_SECRET (any length string -> SHA-256 -> 32-byte key).
const enc = new TextEncoder();
const dec = new TextDecoder();

async function getKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("LLM_KEYS_ENC_SECRET");
  if (!secret) throw new Error("LLM_KEYS_ENC_SECRET not configured");
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return await crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function encryptApiKey(plain: string): Promise<{ ciphertext: string; iv: string; last4: string }> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  return { ciphertext: toB64(ct), iv: toB64(iv), last4: plain.slice(-4) };
}

export async function decryptApiKey(ciphertext: string, iv: string): Promise<string> {
  const key = await getKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ciphertext));
  return dec.decode(pt);
}
