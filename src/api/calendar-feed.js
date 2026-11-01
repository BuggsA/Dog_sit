// GET /api/calendar/<secret>.ics → Anissa's subscribed calendar: confirmed bookings + blocked days.
// Phone calendar apps can't log in, so the long secret in the link is the key. It can be reset
// from the dashboard (Calendar tab), which stops the old link working.
import { calendar, icsResponse, serviceText } from "../ics.js";
import { petSummary } from "../../public/js/pricing.js";

export async function feed({ env, token }) {
  const saved = await env.DB.prepare("SELECT value FROM settings WHERE key = 'calendar_token'").first();
  if (!saved?.value || token !== saved.value) return new Response("Not found", { status: 404 });

  const since = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  const { results: bookings } = await env.DB.prepare(
    `SELECT r.*, c.address, c.home_notes FROM requests r LEFT JOIN clients c ON c.email = lower(r.email)
      WHERE r.status IN ('approved', 'done') AND r.end_date >= ? ORDER BY r.start_date LIMIT 1000`
  )
    .bind(since)
    .all();
  const { results: blocked } = await env.DB.prepare("SELECT date, note FROM blocked_dates WHERE date >= ?").bind(since).all();

  const events = bookings.map((b) => ({
    uid: `booking-${b.id}`,
    start: b.start_date,
    end: b.end_date,
    summary: `${b.name}: ${serviceText(b)}`,
    location: b.address ? `${b.address}${b.zip ? `, ${b.zip}` : ""}` : [b.town, b.zip].filter(Boolean).join(" "),
    description: [
      `${petSummary((b.pet_types || "").split(",").filter(Boolean))}${b.pets ? `: ${b.pets}` : ""}`,
      `Phone: ${b.phone}`,
      b.notes && `Notes: ${b.notes}`,
      b.home_notes && `Getting in: ${b.home_notes}`,
      `Booking #${b.id} · walksforlucy.com/admin`,
    ]
      .filter(Boolean)
      .join("\n"),
  }));
  for (const d of blocked) events.push({ uid: `blocked-${d.date}`, start: d.date, end: d.date, summary: `Blocked${d.note ? `: ${d.note}` : ""}` });

  return icsResponse(calendar("Walks for Lucy bookings", events, { refreshHours: 1 }), "walks-for-lucy.ics");
}
