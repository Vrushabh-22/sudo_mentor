// Cached Azure Blob Storage resolver + SAS generator.
// Used by every edge function that needs to read/write Azure blobs so we
// don't hit the DB on every request (B2C scale).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decryptApiKey } from "./llmCrypto.ts";

type ContainerConfig = {
  accountName: string;
  accountKey: string;
  endpointSuffix: string; // e.g. "core.windows.net"
  containerName: string;
  publicRead: boolean;
  blobHost: string; // {account}.blob.{suffix}
  cachedAt: number;
};

const TTL_MS = 60_000; // 60s — eventual-consistency bound after admin updates
const cache = new Map<string, ContainerConfig>();

function parseConnString(cs: string): { accountName: string; accountKey: string; endpointSuffix: string } {
  const parts = Object.fromEntries(
    cs.split(";").filter(Boolean).map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const accountName = parts["AccountName"];
  const accountKey = parts["AccountKey"];
  const endpointSuffix = parts["EndpointSuffix"] || "core.windows.net";
  if (!accountName || !accountKey) throw new Error("Invalid Azure connection string");
  return { accountName, accountKey, endpointSuffix };
}

export function invalidateAzureCache(purpose?: string) {
  if (purpose) cache.delete(purpose);
  else cache.clear();
}

export async function getAzureContainer(purpose: string): Promise<ContainerConfig> {
  const hit = cache.get(purpose);
  if (hit && Date.now() - hit.cachedAt < TTL_MS) return hit;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: container, error: cErr } = await admin
    .from("azure_storage_containers")
    .select("container_name, public_read, enabled, account_id")
    .eq("purpose", purpose)
    .eq("enabled", true)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!container) throw new Error(`No Azure container configured for purpose '${purpose}'`);

  const { data: account, error: aErr } = await admin
    .from("azure_storage_accounts")
    .select("connection_string_ciphertext, connection_string_iv, enabled, is_active")
    .eq("id", container.account_id)
    .maybeSingle();
  if (aErr) throw aErr;
  if (!account || !account.enabled) throw new Error("Azure account not configured or disabled");

  const cs = await decryptApiKey(account.connection_string_ciphertext, account.connection_string_iv);
  const { accountName, accountKey, endpointSuffix } = parseConnString(cs);

  const cfg: ContainerConfig = {
    accountName,
    accountKey,
    endpointSuffix,
    containerName: container.container_name,
    publicRead: container.public_read,
    blobHost: `${accountName}.blob.${endpointSuffix}`,
    cachedAt: Date.now(),
  };
  cache.set(purpose, cfg);
  return cfg;
}

// ---- SAS signing (Service SAS v2022-11-02) ----
function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

async function hmacSha256B64(keyB64: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    b64ToBytes(keyB64),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToB64(sig);
}

export type SasOpts = {
  purpose: string;
  blobName: string;
  permissions?: string; // e.g. "cw" for write+create (upload), "r" for read
  expiresInMinutes?: number;
  contentType?: string;
};

export async function generateBlobSasUrl(opts: SasOpts): Promise<{ sasUrl: string; publicUrl: string; blobName: string }> {
  const cfg = await getAzureContainer(opts.purpose);
  const perms = opts.permissions || "cw";
  const expiresMin = opts.expiresInMinutes ?? 15;
  const now = new Date();
  const start = new Date(now.getTime() - 5 * 60 * 1000);
  const expiry = new Date(now.getTime() + expiresMin * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

  const signedVersion = "2022-11-02";
  const canonicalizedResource = `/blob/${cfg.accountName}/${cfg.containerName}/${opts.blobName}`;

  // String-to-sign for Service SAS on a blob (v2022-11-02)
  const stringToSign = [
    perms,                       // signedPermissions
    fmt(start),                  // signedStart
    fmt(expiry),                 // signedExpiry
    canonicalizedResource,       // canonicalizedResource
    "",                          // signedIdentifier
    "",                          // signedIP
    "https",                     // signedProtocol
    signedVersion,               // signedVersion
    "b",                         // signedResource (blob)
    "",                          // signedSnapshotTime
    "",                          // signedEncryptionScope
    "",                          // rscc cache-control
    "",                          // rscd content-disposition
    "",                          // rsce content-encoding
    "",                          // rscl content-language
    opts.contentType || "",      // rsct content-type
  ].join("\n");

  const sig = await hmacSha256B64(cfg.accountKey, stringToSign);

  const qs = new URLSearchParams({
    sv: signedVersion,
    ss: "b",
    srt: "o",
    sp: perms,
    st: fmt(start),
    se: fmt(expiry),
    spr: "https",
    sr: "b",
    sig,
  });
  if (opts.contentType) qs.set("rsct", opts.contentType);

  const base = `https://${cfg.blobHost}/${cfg.containerName}/${encodeURIComponent(opts.blobName)}`;
  return {
    sasUrl: `${base}?${qs.toString()}`,
    publicUrl: base,
    blobName: opts.blobName,
  };
}

export async function testAzureConnection(connectionString: string): Promise<{ ok: boolean; accountName?: string; error?: string }> {
  try {
    const { accountName } = parseConnString(connectionString);
    // We don't make a real network call here to avoid blocking on Azure DNS;
    // parsing validates structure, and admin UI can also try an upload later.
    return { ok: true, accountName };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
