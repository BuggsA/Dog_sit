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
| `public/admin/` | Anissa's dashboard: requests, approve/decline, calendar |
| `public/js/pricing.js` | **All prices & rules. Edit prices here only.** |
| `public/js/zones.js` | Service-area logic + map town labels |
| `public/js/zone-data.js` | Generated drive-time areas + ZIP codes (see below) |
| `scripts/build-zones.mjs` | Rebuilds `zone-data.js` |
| `public/img/icons.svg` | Custom icon set (one file, all icons) |
| `public/img/` | Photos (location data removed) |
| `src/worker.js` | Worker entry: routes `/api/*`, locks `/admin` |
| `src/api/` | Server code: booking requests, availability, admin |
| `wrangler.toml` | Cloudflare config (Worker name `dog-sit`) |
| `schema.sql` | Database tables |

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
5. **Notifications to Anissa's phone.** `dog-sit` Worker → Settings → Variables and secrets (mark tokens as *Secret*). Pick one:
   - **Free and instant:** install the **ntfy** app on her phone, subscribe to a long random topic name, and set `NTFY_TOPIC` to that name.
   - **Real SMS:** with a Twilio account, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (your Twilio number) and `NOTIFY_TO=+15418011068`. US business texting needs A2P 10DLC registration in Twilio first (about 1–3 weeks).

## Changing things

- **Prices:** edit `public/js/pricing.js`. The site, estimator and booking estimates all update.
- **Service area:** the shaded map areas are real drive times from Reston on local roads (OpenStreetMap + Valhalla), clipped to Fairfax & Loudoun County, with nothing west of Aldie. To change the minutes or add ZIP codes, edit the top of `scripts/build-zones.mjs` and run `node scripts/build-zones.mjs`. It takes about a minute and is polite to the free map servers.
- **Photos:** drop new ones into `public/img/`. Resize them to about 1000px wide and strip GPS location first.
- **Lucy's photo:** save it as `public/img/lucy.jpg` and follow the note in `about.html`. Lucy's story there is a short draft for Anissa to personalize.
- **Icons:** all icons are original line drawings in `public/img/icons.svg`. Use one with `<svg class="i"><use href="/img/icons.svg#paw"/></svg>`.

## Photo credits

Pet photos in `public/img/stock/` are from [Unsplash](https://unsplash.com/license), free for commercial use. All other photos are Anissa's own.

## Roadmap

- [x] Phase 1: site, estimator, map, booking requests → phone alerts, admin approve/decline + calendar
- [ ] Phase 2: client logins (email magic link), pet profiles, message threads, visit photo/video galleries (R2 storage)
- [ ] Phase 3: online invoices/payments (Stripe), automatic reminders, reviews page
- [ ] Spam protection with Cloudflare Turnstile if bots show up
