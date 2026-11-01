// GET  /api/admin/messages              → every thread (latest message, unread count)
// GET  /api/admin/messages?email=…      → one thread (marks the client's messages read)
// POST /api/admin/messages {email, body} → reply as Anissa
import { json } from "../util.js";
import { thread, send } from "../messages.js";

export async function onRequestGet({ request, env }) {
  const email = (new URL(request.url).searchParams.get("email") || "").toLowerCase();
  if (email) return json({ messages: await thread(env, email, "anissa") });
  const { results } = await env.DB.prepare(
    `SELECT m.email, m.body AS last_body, m.sender AS last_sender, m.created_at AS last_at,
            (SELECT COUNT(*) FROM messages u WHERE u.email = m.email AND u.sender = 'client' AND u.read_at IS NULL) AS unread,
            COALESCE(c.name, (SELECT name FROM requests r WHERE lower(r.email) = m.email ORDER BY r.id DESC LIMIT 1)) AS name
       FROM messages m LEFT JOIN clients c ON c.email = m.email
      WHERE m.id = (SELECT MAX(id) FROM messages x WHERE x.email = m.email)
      ORDER BY m.id DESC LIMIT 300`
  ).all();
  return json({ threads: results, unread: results.reduce((s, t) => s + t.unread, 0) });
}

export async function onRequestPost({ request, env }) {
  const d = await request.json().catch(() => ({}));
  const email = String(d.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Missing client" }, 400);
  const r = await send(env, email, "anissa", d.body);
  return r.error ? json(r, 400) : json({ ok: true, id: r.id, created_at: r.created_at });
}
