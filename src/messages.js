// Messages: one thread per client email. sender = "client" | "anissa".
import { text } from "./util.js";

export async function thread(env, email, viewer) {
  // Opening the thread marks the other side's messages as read
  await env.DB.prepare("UPDATE messages SET read_at = datetime('now') WHERE email = ? AND sender != ? AND read_at IS NULL")
    .bind(email, viewer)
    .run();
  const { results } = await env.DB.prepare(
    "SELECT id, sender, body, created_at, read_at FROM messages WHERE email = ? ORDER BY id DESC LIMIT 300"
  )
    .bind(email)
    .all();
  return results.reverse();
}

export async function send(env, email, sender, body) {
  body = text(body, 4000);
  if (!body) return { error: "Please write a message" };
  const row = await env.DB.prepare("INSERT INTO messages (email, sender, body) VALUES (?, ?, ?) RETURNING id, created_at")
    .bind(email, sender, body)
    .first();
  return { id: row.id, created_at: row.created_at, body };
}

export const unreadFor = async (env, email, viewer) =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE email = ? AND sender != ? AND read_at IS NULL").bind(email, viewer).first()).n;
