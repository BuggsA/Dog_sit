// Visit reports & their photos (photos live in the private R2 bucket bound as PHOTOS).
import { text, isDate } from "./util.js";
import { CHECKLIST, MAX_PHOTOS } from "../public/js/visits.js";

const KEYS = new Set(CHECKLIST.map(([k]) => k));

/** Reports (newest first) with their photo ids, for one client email or one report id. */
export async function listReports(env, { email, id }) {
  const { results } = await env.DB.prepare(
    `SELECT r.*, (SELECT group_concat(p.id) FROM report_photos p WHERE p.report_id = r.id) AS photo_ids
       FROM visit_reports r WHERE ${id ? "r.id = ?" : "r.email = ?"}
      ORDER BY r.visit_date DESC, r.id DESC LIMIT 300`
  )
    .bind(id || email)
    .all();
  for (const r of results) {
    r.photos = r.photo_ids ? r.photo_ids.split(",").map(Number).sort((a, b) => a - b) : [];
    r.done = r.done ? r.done.split(",") : [];
    delete r.photo_ids;
  }
  return results;
}

export async function createReport(env, d) {
  const email = String(d.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Missing client" };
  if (!isDate(d.visit_date)) return { error: "Please pick the visit date" };
  const done = (Array.isArray(d.done) ? d.done : []).filter((k) => KEYS.has(k));
  const notes = text(d.notes, 4000);
  if (!done.length && !notes && !d.photoCount) return { error: "Add a note, a photo or tick what you did" };
  const row = await env.DB.prepare(
    "INSERT INTO visit_reports (email, request_id, visit_date, visit_time, done, notes) VALUES (?, ?, ?, ?, ?, ?) RETURNING id"
  )
    .bind(email, Number(d.request_id) || null, d.visit_date, text(d.visit_time, 20), done.join(",") || null, notes)
    .first();
  return { id: row.id };
}

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function addPhoto(env, reportId, request) {
  const type = (request.headers.get("content-type") || "").split(";")[0];
  if (!TYPES[type]) return { error: "Please upload a photo (JPEG, PNG or WebP)" };
  const report = await env.DB.prepare("SELECT id FROM visit_reports WHERE id = ?").bind(reportId).first();
  if (!report) return { error: "Report not found" };
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM report_photos WHERE report_id = ?").bind(reportId).first();
  if (n >= MAX_PHOTOS) return { error: `Up to ${MAX_PHOTOS} photos per visit` };
  const body = await request.arrayBuffer();
  if (!body.byteLength) return { error: "Empty photo" };
  if (body.byteLength > 8 * 1024 * 1024) return { error: "That photo is too large (8 MB max)" };
  const key = `reports/${reportId}/${crypto.randomUUID()}.${TYPES[type]}`;
  await env.PHOTOS.put(key, body, { httpMetadata: { contentType: type } });
  const row = await env.DB.prepare("INSERT INTO report_photos (report_id, r2_key) VALUES (?, ?) RETURNING id").bind(reportId, key).first();
  return { id: row.id };
}

export async function deleteReport(env, id) {
  const { results } = await env.DB.prepare("SELECT r2_key FROM report_photos WHERE report_id = ?").bind(id).all();
  if (results.length) await env.PHOTOS.delete(results.map((r) => r.r2_key));
  await env.DB.batch([
    env.DB.prepare("DELETE FROM report_photos WHERE report_id = ?").bind(id),
    env.DB.prepare("DELETE FROM visit_reports WHERE id = ?").bind(id),
  ]);
}

/** Stream one photo. Pass ownerEmail to only allow that client's photos. */
export async function servePhoto(env, id, ownerEmail = null) {
  const row = await env.DB.prepare(
    `SELECT p.r2_key, r.email FROM report_photos p JOIN visit_reports r ON r.id = p.report_id WHERE p.id = ?`
  )
    .bind(id)
    .first();
  if (!row || (ownerEmail && row.email !== ownerEmail)) return new Response("Not found", { status: 404 });
  const obj = await env.PHOTOS.get(row.r2_key);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType || "image/jpeg",
      "cache-control": "private, max-age=604800, immutable",
      etag: obj.httpEtag,
    },
  });
}
