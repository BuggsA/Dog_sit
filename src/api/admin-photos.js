// POST /api/admin/photos?report=12  (body: the image, content-type image/jpeg) → { id }
// GET  /api/admin/photos?id=34      → the image
import { json } from "../util.js";
import { addPhoto, servePhoto } from "../reports.js";

export async function onRequestPost({ request, env }) {
  const reportId = Number(new URL(request.url).searchParams.get("report"));
  if (!reportId) return json({ error: "Missing report" }, 400);
  const r = await addPhoto(env, reportId, request);
  return r.error ? json(r, 400) : json({ ok: true, id: r.id });
}

export const onRequestGet = ({ request, env }) => servePhoto(env, Number(new URL(request.url).searchParams.get("id")));
