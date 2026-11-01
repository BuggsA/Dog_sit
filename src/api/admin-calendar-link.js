// GET  /api/admin/calendar-link          → Anissa's private calendar-feed link (made on first use)
// POST /api/admin/calendar-link {reset}  → a new link (the old one stops working)
import { json } from "../util.js";

const newToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
const link = (request, token) => `${new URL(request.url).origin}/api/calendar/${token}.ics`;

export async function onRequestGet({ request, env }) {
  let row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'calendar_token'").first();
  if (!row?.value) {
    await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('calendar_token', ?) ON CONFLICT(key) DO NOTHING").bind(newToken()).run();
    row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'calendar_token'").first();
  }
  return json({ url: link(request, row.value) });
}

export async function onRequestPost({ request, env }) {
  const token = newToken();
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('calendar_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(token)
    .run();
  return json({ url: link(request, token) });
}
