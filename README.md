# Walks for Lucy · walksforlucy.com

Anissa's dog walking & pet sitting site for Reston, Fairfax & Loudoun County, named in memory of Lucy.

**Stack:** a Cloudflare Worker with static assets (website + API) + D1 (database) + Cloudflare Access (admin login).
Plain HTML/CSS/JS with no build step, so you can edit any page directly.

## What's where

| Path | What it is |
|---|---|
| `public/index.html` | Home page |
| `public/services.html` | Services in detail |
| `public/pricing.html` | Prices + interactive estimator |
| `public/area.html` | Drive-time service-area map + ZIP checker |
| `public/about.html` | About Anissa + Lucy's story |
| `public/book.html` | Booking request form |
| `public/faq.html` | Frequently asked questions |
| `public/lucy.html` | Lucy's full story |
| `public/dream.html` | Anissa's dream: a pet hotel or rescue for older dogs |
| `public/admin/` | Anissa's dashboard: requests, approve/decline, calendar, clients |
| `public/account/` | Clients' "My account": their bookings, pet profiles, contact/vet/home details |
| `public/js/pricing.js` | **All prices & rules. Edit prices here only.** |
| `public/js/zones.js` | Service-area logic + map town labels |
| `public/js/zone-data.js` | Generated drive-time areas + ZIP codes (see below) |
| `scripts/build-zones.mjs` | Rebuilds `zone-data.js` |
| `public/sitemap.xml`, `public/robots.txt` | For Google. Add any new page to the sitemap |
| `public/img/icons.svg` | Custom icon set (one file, all icons) |
| `public/img/` | Photos (location data removed) |
| `src/worker.js` | Worker entry: routes `/api/*`, locks `/admin` |
| `src/api/` | Server code: booking requests, availability, admin |
| `wrangler.toml` | Cloudflare config (Worker name `dog-sit`) |
| `schema.sql` | Database tables. New tables are created automatically by the Worker, so no manual step is needed after changes |
| `src/reports.js` | Visit reports and their photos (stored privately in the R2 bucket `walks-for-lucy-photos`) |
| `public/js/visits.js` | Visit report checklist, report cards, photo viewer and photo shrinking (shared by admin and client pages) |
| `src/clients.js` | Client accounts and pet profiles (shared by `/api/account` and the admin Clients tab) |

## Run it on your computer

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev
```

Local booking needs the D1 block in `wrangler.toml` uncommented (see step 2 below). Then open http://localhost:8787 (admin: http://localhost:8787/admin/; `DEV_ADMIN_BYPASS=1` skips login locally).

Run the pricing tests with `npm test`.

## Put it live on Cloudflare (one-time setup)

1. **Worker project:** the `dog-sit` Worker is connected to this GitHub repo (Workers & Pages → `dog-sit` → Settings → Build).
   - Deploy command: `npx wrangler deploy` (the default)
   - Build command: leave empty
   - Production branch: `main`

   Every push to `main` deploys automatically. The site works right away. Booking requests show a "text Anissa" message until step 2 is done.
2. **Database for booking requests:**
   - Dashboard → Storage & databases → **D1** → Create → name it `walks-for-lucy`.
   - Open it → **Console** → paste the contents of `schema.sql` → Execute.
   - Copy its **Database ID**, then in `wrangler.toml` uncomment the `[[d1_databases]]` block and paste the ID. Push to `main` and it redeploys with booking switched on.
3. **Custom domain:** `dog-sit` Worker → Settings → Domains & Routes → Add → Custom domain → `walksforlucy.com` (and `www.walksforlucy.com`). The domain's DNS needs to be on Cloudflare. To keep the old `purfect-pet.com` working, add a Cloudflare *Redirect Rule* on that zone that sends everything to `https://walksforlucy.com`.
4. **Lock the admin page (Cloudflare Access, free):**
   - Zero Trust dashboard → Access → Applications → Add → *Self-hosted*.
   - Domain: `walksforlucy.com`, paths `admin/*` **and** `api/admin/*`.
   - Policy: *Allow* → Emails → Anissa's email (and yours). She logs in with a one-time code sent to her email.
   - Copy the **Application Audience (AUD) tag**. Then in the `dog-sit` Worker → Settings → Variables and secrets, add:
     - `ACCESS_TEAM_DOMAIN` = `yourteam.cloudflareaccess.com`
     - `ACCESS_AUD` = the AUD tag
     - `ADMIN_EMAILS` = Anissa's email
5. **Client logins ("My account", free):** a second Access application, open to any email.
   - Cloudflare One → Access controls → Applications → Add → *Self-hosted*. Name it `Walks for Lucy clients`.
   - Destinations: `walksforlucy.com` with paths `account`, `account/*`, `api/account` **and** `api/account/*`.
   - Authentication: only **One-time PIN**, with *Apply instant authentication* on.
   - Policy: *Allow* → Include → **Everyone**. (Anyone can log in, but they only ever see the bookings and pets for the email they proved they own.)
   - Copy this app's **AUD tag** and add it to the `dog-sit` Worker as `CLIENT_ACCESS_AUD`.
   - The free plan covers 50 people at a time. In Cloudflare One's account settings, turn on removing inactive users from seats so past clients free up their seat.
6. **Notifications to Anissa's phone.** `dog-sit` Worker → Settings → Variables and secrets (mark tokens as *Secret*). Pick one:
   - **Free and instant:** install the **ntfy** app on her phone, subscribe to a long random topic name, and set `NTFY_TOPIC` to that name.
   - **Real SMS:** with a Twilio account, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (your Twilio number) and `NOTIFY_TO=+15418011068`. US business texting needs A2P 10DLC registration in Twilio first (about 1–3 weeks).

## Changing things

- **Prices:** edit `public/js/pricing.js`. The site, estimator and booking estimates all update.
- **Service area:** the shaded map areas are real drive times from Reston on local roads (OpenStreetMap + Valhalla), clipped to Fairfax & Loudoun County, with nothing west of Aldie. To change the minutes or add ZIP codes, edit the top of `scripts/build-zones.mjs` and run `node scripts/build-zones.mjs`. It takes about a minute and is polite to the free map servers.
- **Photos:** drop new ones into `public/img/`. Resize them to about 1000px wide and strip GPS location first.
- **Lucy's photo:** save it as `public/img/lucy.jpg` and follow the note in `about.html`. Lucy's story there is a short draft for Anissa to personalize.
- **Icons:** all icons are original line drawings in `public/img/icons.svg`. Use one with `<svg class="i"><use href="/img/icons.svg#paw"/></svg>`.

- **New page / SEO:** copy the `<head>` of an existing page and change the title, description, canonical URL and `og:` tags. Add the page to `public/sitemap.xml`. Business details for Google (prices, towns served) are in the JSON-LD block in `index.html`. Update it if prices in `pricing.js` change. The FAQ page (`faq.html`) also mentions prices and rules in plain text, both in the visible answers and in the JSON-LD block at the top, so update both there too.

## Photo credits

Pet photos in `public/img/stock/` are from [Unsplash](https://unsplash.com/license), free for commercial use. All other photos are Anissa's own.

## Roadmap

- [x] Phase 1: site, estimator, map, booking requests → phone alerts, admin approve/decline + calendar
- [x] Phase 2a: client logins (emailed code), pet profiles, contact/vet/home details, clients see their bookings, admin Clients tab
- [x] Phase 2b: visit reports with checklist, notes & photos (R2 storage), shown in clients' accounts
- [ ] Phase 2c: message threads, calendar of upcoming visits for clients, videos
- [ ] Phase 2d: bills, with Anissa marking them paid
- [ ] Phase 3: online invoices/payments (Stripe), automatic reminders, reviews page
- [ ] Spam protection with Cloudflare Turnstile if bots show up
