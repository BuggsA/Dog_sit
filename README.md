# 🐾 Purfect Pet · purfect-pet.com

Anissa's dog walking & pet sitting site for Reston, Fairfax & Loudoun County.

**Stack:** Cloudflare Pages (website) + Pages Functions (API) + D1 (database) + Cloudflare Access (admin login).
Plain HTML/CSS/JS with no build step, so you can edit any page directly.

## What's where

| Path | What it is |
|---|---|
| `public/index.html` | Home page |
| `public/pricing.html` | Prices + interactive estimator |
| `public/area.html` | Service-area map + ZIP checker |
| `public/about.html` | Meet Anissa + Lucy memorial |
| `public/book.html` | Booking request form |
| `public/admin/` | Anissa's dashboard: requests, approve/decline, calendar |
| `public/js/pricing.js` | **All prices & rules. Edit prices here only.** |
| `public/js/zones.js` | ZIP codes, towns, map outline |
| `public/img/` | Photos (location data removed) |
| `functions/api/` | Server code: booking requests, availability, admin |
| `schema.sql` | Database tables |

## Run it on your computer

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev
```

Then open http://localhost:8788 (admin: http://localhost:8788/admin/; `DEV_ADMIN_BYPASS=1` skips login locally).

Run the pricing tests with `npm test`.

## Put it live on Cloudflare (one-time setup)

1. **Log in:** `npx wrangler login`
2. **Create the database:** `npx wrangler d1 create purfect-pet`, then paste the printed `database_id` into `wrangler.toml`. Then run `npm run db:remote`.
3. **Create the Pages project:** Cloudflare dashboard → Workers & Pages → Create → Pages → *Connect to Git* → pick this repo.
   - Build command: *(leave empty)*
   - Build output directory: `public`
   - Production branch: `main`

   Every push to GitHub then deploys automatically, and every branch gets its own preview URL.
4. **Custom domain:** Pages project → Custom domains → add `purfect-pet.com` and `www.purfect-pet.com`. This is easiest if the domain's DNS is already on Cloudflare.
5. **Lock the admin page (Cloudflare Access, free):**
   - Zero Trust dashboard → Access → Applications → Add → *Self-hosted*.
   - Domain: `purfect-pet.com`, paths `admin/*` **and** `api/admin/*`.
   - Policy: *Allow* → Emails → Anissa's email (and yours). She logs in with a one-time code sent to her email.
   - Copy the **Application Audience (AUD) tag**. Then in Pages → Settings → Variables, set:
     - `ACCESS_TEAM_DOMAIN` = `yourteam.cloudflareaccess.com`
     - `ACCESS_AUD` = the AUD tag
     - `ADMIN_EMAILS` = Anissa's email
6. **Notifications to Anissa's phone.** Pages → Settings → Variables (mark tokens as *Secret*). Pick one:
   - **Free and instant:** install the **ntfy** app on her phone, subscribe to a long random topic name, and set `NTFY_TOPIC` to that name.
   - **Real SMS:** with a Twilio account, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (your Twilio number) and `NOTIFY_TO=+15418011068`. US business texting needs A2P 10DLC registration in Twilio first (about 1–3 weeks).

## Changing things

- **Prices:** edit `public/js/pricing.js`. The site, estimator and booking estimates all update.
- **Service area:** add ZIP codes in `public/js/zones.js`.
- **Photos:** drop new ones into `public/img/`. Resize them to about 1000px wide and strip GPS location first.
- **Lucy's photo:** save it as `public/img/lucy.jpg` and follow the note in `about.html`.

## Roadmap

- [x] Phase 1: site, estimator, map, booking requests → phone alerts, admin approve/decline + calendar
- [ ] Phase 2: client logins (email magic link), pet profiles, message threads, visit photo/video galleries (R2 storage)
- [ ] Phase 3: online invoices/payments (Stripe), automatic reminders, reviews page
- [ ] Spam protection with Cloudflare Turnstile if bots show up
