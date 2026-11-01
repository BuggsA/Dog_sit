// GET /api/account → the logged-in client's profile, pets and bookings
// PUT /api/account {name, phone, address, zip, emergency_*, vet_*, home_notes} → update profile
import { json } from "../util.js";
import { getOrCreateClient, petsFor, bookingsFor, updateProfile } from "../clients.js";

export async function onRequestGet({ env, email }) {
  const client = await getOrCreateClient(env, email);
  return json({ email, client, pets: await petsFor(env, client.id), bookings: await bookingsFor(env, email) });
}

export async function onRequestPut({ request, env, email }) {
  const d = await request.json().catch(() => ({}));
  const client = await getOrCreateClient(env, email);
  const error = await updateProfile(env, client.id, d);
  return error ? json({ error }, 400) : json({ ok: true });
}
