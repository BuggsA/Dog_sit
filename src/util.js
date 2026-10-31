// Shared helpers for Pages Functions.

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/**
 * Send a notification to Anissa's phone.
 * Uses whichever is configured (both is fine):
 *  - Twilio SMS:  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, NOTIFY_TO
 *  - ntfy push:   NTFY_TOPIC  (free app, https://ntfy.sh)
 */
export async function notify(env, text, title = "Walks for Lucy") {
  const jobs = [];
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM && env.NOTIFY_TO) {
    const body = new URLSearchParams({ To: env.NOTIFY_TO, From: env.TWILIO_FROM, Body: text.slice(0, 1500) });
    jobs.push(
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: {
          authorization: "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
      })
    );
  }
  if (env.NTFY_TOPIC) {
    jobs.push(
      fetch(`https://ntfy.sh/${encodeURIComponent(env.NTFY_TOPIC)}`, {
        method: "POST",
        headers: { Title: title, Tags: "dog", Click: "https://walksforlucy.com/admin/" },
        body: text,
      })
    );
  }
  const results = await Promise.allSettled(jobs);
  results.forEach((r) => {
    if (r.status === "rejected") console.error("notify failed", r.reason);
    else if (!r.value.ok) console.error("notify failed", r.value.status);
  });
}

// ───────── Admin auth (Cloudflare Access) ─────────
// Cloudflare Access sits in front of /admin/* and /api/admin/* and adds a signed
// JWT header. We verify the signature here too, so the data stays safe even if
// the Access rule is ever misconfigured.
//
// Env vars: ACCESS_TEAM_DOMAIN (e.g. "walksforlucy.cloudflareaccess.com"),
//           ACCESS_AUD (Application Audience tag), ADMIN_EMAILS (comma separated)
// Local dev only: DEV_ADMIN_BYPASS="1"

let certCache = { at: 0, keys: [] };

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function accessKeys(team) {
  if (Date.now() - certCache.at < 10 * 60 * 1000 && certCache.keys.length) return certCache.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  const { keys } = await r.json();
  certCache = { at: Date.now(), keys };
  return keys;
}

export async function adminEmail(request, env) {
  if (env.DEV_ADMIN_BYPASS === "1") return "dev@localhost";
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  try {
    const [h, p, sig] = token.split(".");
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    const jwk = (await accessKeys(env.ACCESS_TEAM_DOMAIN)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.ACCESS_AUD)) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    const allowed = (env.ADMIN_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    const email = String(payload.email || "").toLowerCase();
    if (allowed.length && !allowed.includes(email)) return null;
    return email;
  } catch (e) {
    console.error("access verify failed", e);
    return null;
  }
}

export const clean = (v, max = 500) => String(v ?? "").trim().slice(0, max);
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
