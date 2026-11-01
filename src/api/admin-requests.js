// GET   /api/admin/requests?status=pending   → list requests
// PATCH /api/admin/requests  {id, status?, admin_notes?} → update one
import { json, clean } from "../util.js";

const STATUSES = ["pending", "approved", "declined", "done"];
// client_id is set when the person has a "My account" profile (pets, vet, home notes…)
const SELECT = "SELECT r.*, c.id AS client_id FROM requests r LEFT JOIN clients c ON c.email = lower(r.email)";

export async function onRequestGet({ request, env }) {
  const status = new URL(request.url).searchParams.get("status");
  const stmt = STATUSES.includes(status)
    ? env.DB.prepare(`${SELECT} WHERE r.status = ? ORDER BY r.start_date ASC, r.id DESC LIMIT 200`).bind(status)
    : env.DB.prepare(`${SELECT} ORDER BY r.id DESC LIMIT 200`);
  const { results } = await stmt.all();
  const counts = await env.DB.prepare("SELECT status, COUNT(*) AS n FROM requests GROUP BY status").all();
  return json({ requests: results, counts: Object.fromEntries(counts.results.map((r) => [r.status, r.n])) });
}

export async function onRequestPatch({ request, env }) {
  const d = await request.json().catch(() => ({}));
  const id = Number(d.id);
  if (!id) return json({ error: "Missing id" }, 400);
  if (d.status !== undefined && !STATUSES.includes(d.status)) return json({ error: "Bad status" }, 400);
  await env.DB.prepare(
    "UPDATE requests SET status = COALESCE(?, status), admin_notes = COALESCE(?, admin_notes) WHERE id = ?"
  )
    .bind(d.status ?? null, d.admin_notes !== undefined ? clean(d.admin_notes, 2000) : null, id)
    .run();
  return json({ ok: true });
}
