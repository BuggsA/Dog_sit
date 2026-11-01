// Walks for Lucy: Cloudflare Worker.
// Static pages come from /public (served by Cloudflare's asset handler).
// This file only runs for /api/* and /admin/* (see run_worker_first in wrangler.toml).
import { json, adminEmail, clientEmail, ensureSchema } from "./util.js";
import * as requests from "./api/requests.js";
import * as availability from "./api/availability.js";
import * as adminRequests from "./api/admin-requests.js";
import * as adminAvailability from "./api/admin-availability.js";
import * as adminClients from "./api/admin-clients.js";
import * as account from "./api/account.js";
import * as accountPets from "./api/account-pets.js";
import * as accountReports from "./api/account-reports.js";
import * as adminReports from "./api/admin-reports.js";
import * as adminPhotos from "./api/admin-photos.js";
import * as adminMessages from "./api/admin-messages.js";
import * as adminBills from "./api/admin-bills.js";
import * as accountMessages from "./api/account-messages.js";
import * as accountBills from "./api/account-bills.js";
import * as accountCalendar from "./api/account-calendar.js";
import * as adminCalendarLink from "./api/admin-calendar-link.js";
import { feed as calendarFeed } from "./api/calendar-feed.js";

const ROUTES = {
  "/api/requests": requests,
  "/api/availability": availability,
  "/api/admin/requests": adminRequests,
  "/api/admin/availability": adminAvailability,
  "/api/admin/clients": adminClients,
  "/api/admin/reports": adminReports,
  "/api/admin/photos": adminPhotos,
  "/api/admin/messages": adminMessages,
  "/api/admin/bills": adminBills,
  "/api/admin/calendar-link": adminCalendarLink,
  "/api/account": account,
  "/api/account/pets": accountPets,
  "/api/account/reports": accountReports,
  "/api/account/messages": accountMessages,
  "/api/account/bills": accountBills,
  "/api/account/calendar": accountCalendar,
};

// GET → onRequestGet, POST → onRequestPost, …
const handlerFor = (mod, method) =>
  mod[`onRequest${method.charAt(0)}${method.slice(1).toLowerCase()}`];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const isAdmin = path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/");
    const isAccount = path === "/account" || path.startsWith("/account/") || path === "/api/account" || path.startsWith("/api/account/");
    let email = null;

    // Anissa-only areas: verified Cloudflare Access login required
    if (isAdmin && !(await adminEmail(request, env))) {
      return path.startsWith("/api/")
        ? json({ error: "Not authorized" }, 401)
        : new Response("This area is for Anissa only. Set up Cloudflare Access (see README).", {
            status: 401,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
    }

    // Client "My account" area: verified Cloudflare Access login (any email)
    if (isAccount && !(email = await clientEmail(request, env))) {
      return path.startsWith("/api/")
        ? json({ error: "Please log in" }, 401)
        : new Response("Client accounts aren't switched on yet. Please text Anissa at (541) 801-1068.", {
            status: 401,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
    }

    // Anissa's subscribed phone calendar: the secret in the link is the key (calendar apps can't log in)
    const cal = path.match(/^\/api\/calendar\/([0-9a-f]{32,64})\.ics$/);
    if (cal && env.DB) {
      await ensureSchema(env);
      return calendarFeed({ env, token: cal[1] });
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
        await ensureSchema(env);
        return await handler({ request, env, email, waitUntil: (p) => ctx.waitUntil(p) });
      } catch (err) {
        console.error(err);
        return json({ error: "Something went wrong" }, 500);
      }
    }

    // Everything else (including the /admin page once authorized) is a static file
    return env.ASSETS.fetch(request);
  },
};
