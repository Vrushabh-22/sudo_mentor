export async function callAutoLoginCandidate(token: string): Promise<any> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-login-candidate`;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ token }),
  });

  let data: any = null;
  try { data = await res.json(); } catch { /* ignore */ }

  if (!res.ok) {
    const message = data?.message || data?.error || `Auto-login failed (${res.status})`;
    const err: any = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
