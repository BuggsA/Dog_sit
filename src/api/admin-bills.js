// GET   /api/admin/bills?status=unpaid|paid|void  → bills + what's still owed
// GET   /api/admin/bills?email=…                   → one client's bills
// POST  /api/admin/bills {email, request_id?, lines[{label, amount}], note?, due_date?} → { id }
// PATCH /api/admin/bills {id, status: paid|unpaid|void, paid_method?}
import { json } from "../util.js";
import { listBills, billsFor, createBill, setBillStatus } from "../bills.js";

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  if (q.get("email")) return json({ bills: await billsFor(env, q.get("email").toLowerCase()) });
  return json(await listBills(env, q.get("status")));
}

export async function onRequestPost({ request, env }) {
  const r = await createBill(env, await request.json().catch(() => ({})));
  return r.error ? json(r, 400) : json({ ok: true, ...r });
}

export async function onRequestPatch({ request, env }) {
  const r = await setBillStatus(env, await request.json().catch(() => ({})));
  return r.error ? json(r, 400) : json(r);
}
