// GET /api/account/reports       → the logged-in client's visit reports
// GET /api/account/reports?photo=34 → one of their photos
import { json } from "../util.js";
import { listReports, servePhoto } from "../reports.js";

export async function onRequestGet({ request, env, email }) {
  const photo = Number(new URL(request.url).searchParams.get("photo"));
  if (photo) return servePhoto(env, photo, email);
  return json({ reports: await listReports(env, { email }) });
}
