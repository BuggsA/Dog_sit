// GET /api/admin/clients        → every client: account holders plus anyone who has sent a booking request
// GET /api/admin/clients?id=5   → one client with pets and bookings
// GET /api/admin/clients?email= → same, looked up by email (for people without an account yet)
import { json } from "../util.js";
import { petsFor, bookingsFor } from "../clients.js";

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  if (q.get("id") || q.get("email")) {
    const client = q.get("id")
      ? await env.DB.prepare("SELECT * FROM clients WHERE id = ?").bind(Number(q.get("id"))).first()
      : await env.DB.prepare("SELECT * FROM clients WHERE email = ?").bind(q.get("email").toLowerCase()).first();
    const email = client?.email || q.get("email")?.toLowerCase();
    if (!email) return json({ error: "Client not found" }, 404);
    const bookings = await bookingsFor(env, email);
    if (!client && !bookings.length) return json({ error: "Client not found" }, 404);
    const last = bookings.length
      ? await env.DB.prepare("SELECT name, phone, zip, town FROM requests WHERE lower(email) = ? ORDER BY id DESC LIMIT 1").bind(email).first()
      : null;
    return json({ email, client, fromBookings: last, pets: client ? await petsFor(env, client.id) : [], bookings });
  }

  const { results } = await env.DB.prepare(
    `WITH people AS (
       SELECT email FROM clients
       UNION SELECT lower(email) FROM requests
     ),
     latest AS (
       SELECT lower(email) AS email, name, phone, town, MAX(id) AS last_id, COUNT(*) AS bookings,
              SUM(status = 'pending') AS pending, MAX(start_date) AS last_date
         FROM requests GROUP BY lower(email)
     )
     SELECT p.email, c.id AS client_id, COALESCE(c.name, l.name) AS name, COALESCE(c.phone, l.phone) AS phone,
            l.town, COALESCE(l.bookings, 0) AS bookings, COALESCE(l.pending, 0) AS pending, l.last_date,
            (SELECT json_group_array(json_object('name', name, 'type', type)) FROM pets WHERE client_id = c.id) AS pet_list
       FROM people p
       LEFT JOIN clients c ON c.email = p.email
       LEFT JOIN latest l ON l.email = p.email
      ORDER BY COALESCE(l.last_id, 0) DESC, c.id DESC
      LIMIT 500`
  ).all();
  for (const r of results) {
    r.pets = JSON.parse(r.pet_list || "[]");
    delete r.pet_list;
  }
  return json({ clients: results });
}
