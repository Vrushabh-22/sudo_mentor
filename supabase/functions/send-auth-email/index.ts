// Supabase Send-Email Auth Hook — sends branded auth emails via Resend.
// Configure in Supabase Dashboard → Authentication → Hooks → Send Email hook (HTTPS).
import { Webhook } from "npm:standardwebhooks@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SEND_EMAIL_HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
const AUTH_EMAIL_FROM = Deno.env.get("AUTH_EMAIL_FROM") || "SudoMentor <noreply@sudomentor.com>";

interface HookPayload {
  user: { email: string; id: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

const COPY: Record<string, { subject: string; heading: string; body: string; cta: string }> = {
  signup: {
    subject: "Confirm your SudoMentor account",
    heading: "Welcome to SudoMentor 👋",
    body: "You're one click away from your career copilot. Confirm your email to activate your account.",
    cta: "Confirm email",
  },
  recovery: {
    subject: "Reset your SudoMentor password",
    heading: "Reset your password",
    body: "We got a request to reset your password. Click below to choose a new one. This link expires in 1 hour.",
    cta: "Reset password",
  },
  magiclink: {
    subject: "Your SudoMentor sign-in link",
    heading: "Your sign-in link",
    body: "Click below to sign in to SudoMentor. This link expires shortly.",
    cta: "Sign in",
  },
  invite: {
    subject: "You're invited to SudoMentor",
    heading: "You're invited",
    body: "You've been invited to join SudoMentor. Accept the invite to get started.",
    cta: "Accept invite",
  },
  email_change: {
    subject: "Confirm your new email",
    heading: "Confirm your new email",
    body: "Click below to confirm this is your new email address.",
    cta: "Confirm email",
  },
  reauthentication: {
    subject: "Confirm it's you",
    heading: "Confirm it's you",
    body: "Use this code to complete your action.",
    cta: "Open SudoMentor",
  },
};

function renderHtml(heading: string, body: string, cta: string, url: string, token?: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
        <tr><td style="background:linear-gradient(135deg,#818cf8 0%,#67e8f9 100%);padding:32px 32px 28px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">SudoMentor</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:4px;">Your career copilot</div>
        </td></tr>
        <tr><td style="padding:36px 32px 12px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">${heading}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#475569;">${body}</p>
          <div style="text-align:center;margin:8px 0 20px;">
            <a href="${url}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px;">${cta}</a>
          </div>
          ${token ? `<p style="margin:0 0 16px;font-size:13px;color:#64748b;text-align:center;">Or use code: <strong style="font-family:monospace;font-size:16px;color:#0f172a;">${token}</strong></p>` : ""}
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">If the button doesn't work, paste this into your browser:<br/><a href="${url}" style="color:#6366f1;word-break:break-all;">${url}</a></p>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    if (!SEND_EMAIL_HOOK_SECRET) throw new Error("SEND_EMAIL_HOOK_SECRET not configured");

    const raw = await req.text();
    const headers = Object.fromEntries(req.headers);

    // Supabase signs hooks with the standardwebhooks spec.
    // Secret is the "v1,whsec_..." string from the Supabase dashboard.
    const wh = new Webhook(SEND_EMAIL_HOOK_SECRET.replace(/^v1,/, ""));
    const payload = wh.verify(raw, headers) as HookPayload;

    const { user, email_data } = payload;
    const action = email_data.email_action_type || "signup";
    const copy = COPY[action] || COPY.signup;

    const confirmationUrl = `${email_data.site_url}/auth/v1/verify?token=${encodeURIComponent(email_data.token_hash)}&type=${encodeURIComponent(action)}&redirect_to=${encodeURIComponent(email_data.redirect_to || "")}`;

    const html = renderHtml(copy.heading, copy.body, copy.cta, confirmationUrl, action === "reauthentication" ? email_data.token : undefined);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: AUTH_EMAIL_FROM,
        to: [user.email],
        subject: copy.subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const details = await resendRes.text();
      console.error(`Resend failed [${resendRes.status}]: ${details}`);
      return new Response(
        JSON.stringify({ error: "Resend request failed", status: resendRes.status, details }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-auth-email error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
