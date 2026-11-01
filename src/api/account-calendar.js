// GET /api/account/calendar?id=12 → one of the client's confirmed bookings as a calendar file
// GET /api/account/calendar        → all their upcoming confirmed bookings
import { json } from "../util.js";
import { calendar, icsResponse, serviceText } from "../ics.js";

export async function onRequestGet({ request, env, email }) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  const today = new Date().toISOString().slice(0, 10);
  const { results } = await env.DB.prepare(
    `SELECT * FROM requests WHERE lower(email) = ? AND status = 'approved' AND ${id ? "id = ?" : "end_date >= ?"} ORDER BY start_date`
  )
    .bind(email, id || today)
    .all();
  if (!results.length) return json({ error: "No confirmed bookings to add yet" }, 404);
  const events = results.map((b) => ({
    uid: `booking-${b.id}`,
    start: b.start_date,
    end: b.end_date,
    summary: `Walks for Lucy: Anissa (${serviceText(b)})`,
    description: `${b.pets || ""}\nQuestions? Text Anissa at (541) 801-1068 or message her at walksforlucy.com/account`.trim(),
  }));
  return icsResponse(calendar("Walks for Lucy", events), id ? `walks-for-lucy-${id}.ics` : "walks-for-lucy.ics");
}
