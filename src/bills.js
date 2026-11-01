// Bills: created by Anissa, paid to her directly, marked paid by her.
import { text, isDate } from "./util.js";
import { PAY_METHODS } from "../public/js/pricing.js";

const parse = (b) => ({ ...b, lines: JSON.parse(b.lines || "[]") });

export async function billsFor(env, email) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM bills WHERE email = ? AND status != 'void' ORDER BY status = 'paid', id DESC LIMIT 200"
  )
    .bind(email)
    .all();
  return results.map(parse);
}

export async function listBills(env, status) {
  const where = ["unpaid", "paid", "void"].includes(status) ? "WHERE b.status = ?" : "WHERE b.status != 'void'";
  const stmt = env.DB.prepare(
    `SELECT b.*, COALESCE(c.name, (SELECT name FROM requests r WHERE lower(r.email) = b.email ORDER BY r.id DESC LIMIT 1)) AS name
       FROM bills b LEFT JOIN clients c ON c.email = b.email ${where} ORDER BY b.id DESC LIMIT 300`
  );
  const { results } = await (where.includes("?") ? stmt.bind(status) : stmt).all();
  const owed = await env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS total FROM bills WHERE status = 'unpaid'").first();
  return { bills: results.map(parse), unpaid: owed };
}

export async function createBill(env, d) {
  const email = String(d.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Missing client" };
  const lines = (Array.isArray(d.lines) ? d.lines : [])
    .map((l) => ({ label: text(l.label, 140), amount: Math.round(Number(l.amount) * 100) / 100 }))
    .filter((l) => l.label && Number.isFinite(l.amount) && Math.abs(l.amount) <= 20000)
    .slice(0, 25);
  if (!lines.length) return { error: "Add at least one line with a description and amount" };
  const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  if (total < 0) return { error: "The total can't be below $0" };
  if (d.due_date && !isDate(d.due_date)) return { error: "Please check the due date" };
  const row = await env.DB.prepare(
    "INSERT INTO bills (email, request_id, lines, total, note, due_date) VALUES (?, ?, ?, ?, ?, ?) RETURNING id"
  )
    .bind(email, Number(d.request_id) || null, JSON.stringify(lines), total, text(d.note, 1000), d.due_date || null)
    .first();
  return { id: row.id, total };
}

export async function setBillStatus(env, d) {
  const id = Number(d.id);
  if (!id) return { error: "Missing bill" };
  if (d.status === "paid") {
    const method = PAY_METHODS.includes(d.paid_method) ? d.paid_method : "Other";
    await env.DB.prepare("UPDATE bills SET status = 'paid', paid_at = datetime('now'), paid_method = ? WHERE id = ?").bind(method, id).run();
  } else if (d.status === "unpaid" || d.status === "void") {
    await env.DB.prepare("UPDATE bills SET status = ?, paid_at = NULL, paid_method = NULL WHERE id = ?").bind(d.status, id).run();
  } else return { error: "Bad status" };
  return { ok: true };
}
