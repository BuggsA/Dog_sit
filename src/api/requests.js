// POST /api/requests: a client submits a booking request.
import { json, notify, clean, isDate } from "../util.js";
import { estimate, PETS } from "../../public/js/pricing.js";
import { classifyZip } from "../../public/js/zones.js";

export async function onRequestPost({ request, env, waitUntil }) {
  let d;
  try {
    d = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  // Honeypot: bots fill the hidden "website" field. Pretend success.
  if (d.website) return json({ ok: true });

  const name = clean(d.name, 100);
  const phone = clean(d.phone, 30);
  const email = clean(d.email, 200);
  const zip = clean(d.zip, 5);
  const service = ["visit", "overnight", "meet"].includes(d.service) ? d.service : null;
  const petTypes = (Array.isArray(d.petTypes) ? d.petTypes : []).filter((p) => PETS[p]).slice(0, 6);
  const start = clean(d.start, 10);
  const end = clean(d.end, 10) || start;

  if (!name || !/\d{3}.*\d{3}.*\d{4}/.test(phone) || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{5}$/.test(zip))
    return json({ error: "Please check your name, phone, email and ZIP" }, 400);
  if (!service || !petTypes.length) return json({ error: "Please pick a service and pet type" }, 400);
  if (!isDate(start) || !isDate(end) || end < start) return json({ error: "Please check your dates" }, 400);
  if (!d.consent) return json({ error: "Please OK being contacted about your request" }, 400);

  const zone = classifyZip(zip);
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + (service === "overnight" ? 0 : 1);
  // Cats & small pets need at least 30 min, so bump the length if needed
  const petMin = Math.max(...petTypes.map((p) => PETS[p].minVisit));
  const asked = [15, 30, 60].includes(Number(d.minutes)) ? Number(d.minutes) : 30;
  const minutes = Math.max(asked, petMin);
  const hours = [10, 12, 20, 24].includes(Number(d.hours)) ? Number(d.hours) : 12;
  const perDay = Math.min(6, Math.max(1, Number(d.perDay) || 1));
  const ageFlag = !!d.ageFlag;

  let est = null;
  if (service !== "meet") {
    // Price by the pet with the longest minimum visit (e.g. dog + cat → cat rules)
    const pet = petTypes.slice().sort((a, b) => PETS[b].minVisit - PETS[a].minVisit)[0];
    const r = estimate({ service, pet, minutes, hours, perDay, days: Math.max(1, days), feeding: false, zone, ageFlag });
    est = r.total;
  }

  const row = await env.DB.prepare(
    `INSERT INTO requests (name, phone, email, zip, town, county, pet_types, pets, age_flag, service,
       start_date, end_date, minutes, per_day, hours, notes, new_client, estimate)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`
  )
    .bind(
      name, phone, email, zip, zone?.town || null, zone?.county || null, petTypes.join(","), clean(d.pets, 500),
      ageFlag ? 1 : 0, service, start, end,
      service === "visit" ? minutes : null, service === "visit" ? perDay : null, service === "overnight" ? hours : null,
      clean(d.notes, 2000), d.newClient ? 1 : 0, est
    )
    .first();

  const what =
    service === "overnight" ? `Overnight ${hours}h` : service === "visit" ? `${perDay}x ${minutes}min visits/day` : "Meet & greet";
  const petNames = petTypes.map((p) => PETS[p].label).join(" + ");
  const text =
    `New request #${row.id}\n${name} ${phone}\n${petNames}: ${what}\n${start}${end !== start ? ` → ${end}` : ""}\n` +
    `${zone?.town || zip}${zone?.area === "dc" ? " (DC)" : ""}${d.newClient ? " · NEW client" : ""}` +
    `${ageFlag ? " · puppy/senior" : ""}${est != null ? ` · est $${est}` : ""}\nwalksforlucy.com/admin`;

  waitUntil(notify(env, text, "New booking request"));

  return json({ ok: true, id: row.id });
}
