// GET /api/availability: public list of unavailable dates (no private details).
import { json } from "../_lib/util.js";

export async function onRequestGet({ env }) {
  const today = new Date().toISOString().slice(0, 10);
  const blocked = await env.DB.prepare("SELECT date FROM blocked_dates WHERE date >= ? ORDER BY date LIMIT 120")
    .bind(today)
    .all();
  // Approved overnights also make those nights unavailable
  const stays = await env.DB.prepare(
    "SELECT start_date, end_date FROM requests WHERE status = 'approved' AND service = 'overnight' AND end_date >= ?"
  )
    .bind(today)
    .all();

  const set = new Set(blocked.results.map((r) => r.date));
  for (const s of stays.results) {
    for (let d = new Date(s.start_date + "T12:00:00Z"); d.toISOString().slice(0, 10) < s.end_date; d.setUTCDate(d.getUTCDate() + 1)) {
      set.add(d.toISOString().slice(0, 10));
    }
  }
  return new Response(JSON.stringify({ blocked: [...set].sort() }), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
  });
}
