// GET  /api/account/messages        → the client's thread with Anissa (marks her replies read)
// POST /api/account/messages {body} → send Anissa a message (she gets a phone alert)
import { json, notify } from "../util.js";
import { thread, send, unreadFor } from "../messages.js";

// ?count=1 only counts unread replies (for the tab badge) without marking them read
export const onRequestGet = async ({ request, env, email }) =>
  new URL(request.url).searchParams.get("count")
    ? json({ unread: await unreadFor(env, email, "client") })
    : json({ messages: await thread(env, email, "client") });

export async function onRequestPost({ request, env, email, waitUntil }) {
  const d = await request.json().catch(() => ({}));
  const r = await send(env, email, "client", d.body);
  if (r.error) return json(r, 400);
  const c = await env.DB.prepare("SELECT name FROM clients WHERE email = ?").bind(email).first();
  waitUntil(notify(env, `Message from ${c?.name || email}:\n${r.body.slice(0, 600)}\nwalksforlucy.com/admin`, "New message"));
  return json({ ok: true, id: r.id, created_at: r.created_at });
}
