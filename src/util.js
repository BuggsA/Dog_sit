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
//           ACCESS_AUD (Application Audience tag of the admin app), ADMIN_EMAILS (comma separated),
//           CLIENT_ACCESS_AUD (AUD tag of the client "My account" app, open to any email)
// Local dev only: DEV_ADMIN_BYPASS="1", DEV_CLIENT_EMAIL="someone@example.com"

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

/** The verified email from a Cloudflare Access login for the app with this AUD tag, or null. */
async function accessEmail(request, env, audTag) {
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token || !env.ACCESS_TEAM_DOMAIN || !audTag) return null;
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
    if (!aud.includes(audTag)) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return String(payload.email || "").trim().toLowerCase() || null;
  } catch (e) {
    console.error("access verify failed", e);
    return null;
  }
}

/** Anissa (or another address in ADMIN_EMAILS), logged in through the admin Access app. */
export async function adminEmail(request, env) {
  if (env.DEV_ADMIN_BYPASS === "1") return "dev@localhost";
  const email = await accessEmail(request, env, env.ACCESS_AUD);
  if (!email) return null;
  const allowed = (env.ADMIN_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return !allowed.length || allowed.includes(email) ? email : null;
}

/** A client, logged in through the "My account" Access app (any email, verified by a one-time code). */
export async function clientEmail(request, env) {
  if (env.DEV_CLIENT_EMAIL) return env.DEV_CLIENT_EMAIL.toLowerCase();
  return accessEmail(request, env, env.CLIENT_ACCESS_AUD);
}

// ───────── Database tables ─────────
// New tables are created automatically the first time the Worker talks to the
// database, so a schema change never needs a manual step in the Cloudflare dashboard.
import SCHEMA from "../schema.sql";

let schemaReady = null;
export function ensureSchema(env) {
  if (!schemaReady) {
    const statements = SCHEMA.replace(/--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => env.DB.prepare(s));
    schemaReady = env.DB.batch(statements).catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

/** Free text people type: trimmed, length-capped, null when empty. */
export const text = (v, max = 500) => String(v ?? "").trim().slice(0, max) || null;

export const clean = (v, max = 500) => String(v ?? "").trim().slice(0, max);
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
