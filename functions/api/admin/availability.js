// GET  /api/admin/availability?month=2026-11 → blocked days + booked days for a month
// POST /api/admin/availability {date, blocked, note?} → block / unblock a day
import { json, clean, isDate } from "../../_lib/util.js";

export async function onRequestGet({ request, env }) {
  const month = new URL(request.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: "Bad month" }, 400);
  const first = `${month}-01`;
  const last = `${month}-31`;
  const blocked = await env.DB.prepare("SELECT date, note FROM blocked_dates WHERE date BETWEEN ? AND ?")
    .bind(first, last)
    .all();
  const booked = await env.DB.prepare(
    `SELECT id, name, service, start_date, end_date, minutes, per_day, hours, pet_types, town
       FROM requests WHERE status = 'approved' AND start_date <= ? AND end_date >= ? ORDER BY start_date`
  )
    .bind(last, first)
    .all();
  return json({ blocked: blocked.results, booked: booked.results });
}

export async function onRequestPost({ request, env }) {
  const d = await request.json().catch(() => ({}));
  if (!isDate(d.date)) return json({ error: "Bad date" }, 400);
  if (d.blocked) {
    await env.DB.prepare("INSERT INTO blocked_dates (date, note) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET note = excluded.note")
      .bind(d.date, clean(d.note, 200) || null)
      .run();
  } else {
    await env.DB.prepare("DELETE FROM blocked_dates WHERE date = ?").bind(d.date).run();
  }
  return json({ ok: true });
}
