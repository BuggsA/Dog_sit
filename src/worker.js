// Walks for Lucy: Cloudflare Worker.
// Static pages come from /public (served by Cloudflare's asset handler).
// This file only runs for /api/* and /admin/* (see run_worker_first in wrangler.toml).
import { json, adminEmail } from "./util.js";
import * as requests from "./api/requests.js";
import * as availability from "./api/availability.js";
import * as adminRequests from "./api/admin-requests.js";
import * as adminAvailability from "./api/admin-availability.js";

const ROUTES = {
  "/api/requests": requests,
  "/api/availability": availability,
  "/api/admin/requests": adminRequests,
  "/api/admin/availability": adminAvailability,
};

// GET → onRequestGet, POST → onRequestPost, …
const handlerFor = (mod, method) =>
  mod[`onRequest${method.charAt(0)}${method.slice(1).toLowerCase()}`];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const isAdmin = path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/");

    // Anissa-only areas: verified Cloudflare Access login required
    if (isAdmin && !(await adminEmail(request, env))) {
      return path.startsWith("/api/")
        ? json({ error: "Not authorized" }, 401)
        : new Response("This area is for Anissa only. Set up Cloudflare Access (see README).", {
            status: 401,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
    }

    if (path.startsWith("/api/")) {
      const mod = ROUTES[path];
      if (!mod) return json({ error: "Not found" }, 404);
      const handler = handlerFor(mod, request.method);
      if (!handler) return json({ error: "Method not allowed" }, 405);
      if (!env.DB) {
        return json({ error: "Online booking isn't switched on yet. Please text Anissa at (541) 801-1068" }, 503);
      }
      try {
        return await handler({ request, env, waitUntil: (p) => ctx.waitUntil(p) });
      } catch (err) {
        console.error(err);
        return json({ error: "Something went wrong" }, 500);
      }
    }

    // Everything else (including the /admin page once authorized) is a static file
    return env.ASSETS.fetch(request);
  },
};
