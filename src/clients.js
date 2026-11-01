// Client accounts: shared by the client's own API and Anissa's dashboard.
import { text } from "./util.js";
import { PETS } from "../public/js/pricing.js";

export const PROFILE_FIELDS = {
  name: 100, phone: 30, address: 300, zip: 5,
  emergency_name: 100, emergency_phone: 30, vet_name: 150, vet_phone: 30, home_notes: 2000,
};
export const PET_FIELDS = { name: 60, breed: 100, age: 40, feeding: 1000, medications: 1000, behavior: 1000, notes: 1000 };

/** The client row for this email, created on first login (pre-filled from their latest booking request). */
export async function getOrCreateClient(env, email) {
  let client = await env.DB.prepare("SELECT * FROM clients WHERE email = ?").bind(email).first();
  if (client) return client;
  const last = await env.DB.prepare("SELECT name, phone, zip FROM requests WHERE lower(email) = ? ORDER BY id DESC LIMIT 1")
    .bind(email)
    .first();
  await env.DB.prepare("INSERT INTO clients (email, name, phone, zip) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING")
    .bind(email, last?.name || null, last?.phone || null, last?.zip || null)
    .run();
  return env.DB.prepare("SELECT * FROM clients WHERE email = ?").bind(email).first();
}

export const petsFor = async (env, clientId) =>
  (await env.DB.prepare("SELECT * FROM pets WHERE client_id = ? ORDER BY id").bind(clientId).all()).results;

/** A client's booking requests (never includes Anissa's private notes). */
export const bookingsFor = async (env, email) =>
  (
    await env.DB.prepare(
      `SELECT id, created_at, status, service, start_date, end_date, minutes, per_day, hours, pet_types, pets, notes, estimate
         FROM requests WHERE lower(email) = ? ORDER BY start_date DESC, id DESC LIMIT 200`
    )
      .bind(email)
      .all()
  ).results;

export async function updateProfile(env, clientId, d) {
  const keys = Object.keys(PROFILE_FIELDS);
  if (!text(d.name)) return "Please add your name";
  if (d.zip && !/^\d{5}$/.test(String(d.zip).trim())) return "Please use a 5-digit ZIP code";
  await env.DB.prepare(`UPDATE clients SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...keys.map((k) => text(d[k], PROFILE_FIELDS[k])), clientId)
    .run();
  return null;
}

/** Add (no id) or update a pet. Returns { id } or { error }. */
export async function savePet(env, clientId, d) {
  const name = text(d.name, PET_FIELDS.name);
  if (!name) return { error: "Please add your pet's name" };
  if (!PETS[d.type]) return { error: "Please pick what kind of pet" };
  const keys = Object.keys(PET_FIELDS).filter((k) => k !== "name");
  const values = keys.map((k) => text(d[k], PET_FIELDS[k]));
  const id = Number(d.id) || null;
  if (id) {
    const r = await env.DB.prepare(
      `UPDATE pets SET name = ?, type = ?, ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now')
        WHERE id = ? AND client_id = ?`
    )
      .bind(name, d.type, ...values, id, clientId)
      .run();
    if (!r.meta.changes) return { error: "Pet not found" };
    return { id };
  }
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM pets WHERE client_id = ?").bind(clientId).first();
  if (n >= 20) return { error: "That's a lot of pets! Please text Anissa to add more." };
  const row = await env.DB.prepare(
    `INSERT INTO pets (client_id, name, type, ${keys.join(", ")}) VALUES (?, ?, ?, ${keys.map(() => "?").join(", ")}) RETURNING id`
  )
    .bind(clientId, name, d.type, ...values)
    .first();
  return { id: row.id };
}
