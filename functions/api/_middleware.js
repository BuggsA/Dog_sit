// If the database isn't connected yet, answer clearly instead of crashing.
import { json } from "../_lib/util.js";

export async function onRequest(ctx) {
  if (!ctx.env.DB) {
    return json({ error: "Online booking isn't switched on yet. Please text Anissa at (541) 801-1068" }, 503);
  }
  return ctx.next();
}
