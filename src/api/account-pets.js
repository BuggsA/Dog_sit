// POST   /api/account/pets {id?, name, type, breed, age, feeding, medications, behavior, notes} → add / update
// DELETE /api/account/pets {id} → remove
import { json } from "../util.js";
import { getOrCreateClient, savePet } from "../clients.js";

export async function onRequestPost({ request, env, email }) {
  const d = await request.json().catch(() => ({}));
  const client = await getOrCreateClient(env, email);
  const r = await savePet(env, client.id, d);
  return r.error ? json(r, 400) : json({ ok: true, id: r.id });
}

export async function onRequestDelete({ request, env, email }) {
  const d = await request.json().catch(() => ({}));
  const client = await getOrCreateClient(env, email);
  await env.DB.prepare("DELETE FROM pets WHERE id = ? AND client_id = ?").bind(Number(d.id) || 0, client.id).run();
  return json({ ok: true });
}
