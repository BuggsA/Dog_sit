// The /admin page itself is also locked to Anissa.
import { adminEmail } from "../_lib/util.js";

export async function onRequest(ctx) {
  const email = await adminEmail(ctx.request, ctx.env);
  if (!email) {
    return new Response("🐾 This area is for Anissa only. Set up Cloudflare Access (see README).", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return ctx.next();
}
