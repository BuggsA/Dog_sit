// Every /api/admin/* call must come from Anissa (verified Cloudflare Access login).
import { adminEmail, json } from "../../_lib/util.js";

export async function onRequest(ctx) {
  const email = await adminEmail(ctx.request, ctx.env);
  if (!email) return json({ error: "Not authorized" }, 401);
  ctx.data.adminEmail = email;
  return ctx.next();
}
