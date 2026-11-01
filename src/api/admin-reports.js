// GET    /api/admin/reports?email=…          → that client's visit reports
// POST   /api/admin/reports {email, request_id?, visit_date, visit_time?, done[], notes?, photoCount?} → { id }
// DELETE /api/admin/reports {id}             → remove a report and its photos
import { json } from "../util.js";
import { listReports, createReport, deleteReport } from "../reports.js";

export async function onRequestGet({ request, env }) {
  const email = (new URL(request.url).searchParams.get("email") || "").toLowerCase();
  if (!email) return json({ error: "Missing email" }, 400);
  return json({ reports: await listReports(env, { email }) });
}

export async function onRequestPost({ request, env }) {
  const r = await createReport(env, await request.json().catch(() => ({})));
  return r.error ? json(r, 400) : json({ ok: true, id: r.id });
}

export async function onRequestDelete({ request, env }) {
  const d = await request.json().catch(() => ({}));
  if (!Number(d.id)) return json({ error: "Missing id" }, 400);
  await deleteReport(env, Number(d.id));
  return json({ ok: true });
}
