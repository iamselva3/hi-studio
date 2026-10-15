# HI STUDIO — Operational & Deployment Guide (Windows PowerShell)

Welcome to **Hi Studio**, an award-winning luxury South Indian wedding photography atelier, fine art frame & print workshop, and headless Cloudflare CMS suite.

---

## 1. Prerequisites
- **Node.js**: `v20.0.0` or higher (tested on `v24.19.0`)
- **npm**: `v10.0.0` or higher (tested on `v11.17.0`)
- **Cloudflare Account**: With access to Pages, D1 Database, and R2 Object Storage.
- **PowerShell**: Windows PowerShell 5.1+ or PowerShell Core 7+.

---

## 2. Configuration

### Cloudflare resources (all Hi Studio's own — nothing is shared with other projects)
| Binding | Type | Name | Used for |
| :--- | :--- | :--- | :--- |
| `DB` | D1 | `hi-studio-db` | products, variants, orders, photos, enquiries, settings, rate limits |
| `MEDIA` | R2 (public via `/api/media/...`) | `hi-studio-media` | photos uploaded in the admin (`photos/<id>/...`) and product images (`products/...`) |
| `UPLOADS` | R2 (private) | `hi-studio-uploads` | customer photos for orders (`customer/<date>/<uuid>.<ext>`); only downloadable by a signed-in admin |

All three are declared in `wrangler.toml`. The bundled portfolio photos in `public/media` are served as static files by Pages; they do not need R2.

### Secrets
The API refuses to run admin login or payments without these — there are no built-in fallback values.

| Name | Purpose |
| :--- | :--- |
| `JWT_SECRET` | Signs admin sessions. A long random string (e.g. 48+ characters). |
| `ADMIN_PASSWORD_HASH` | The admin password as a PBKDF2 hash: create it with `npm run hash-password`. |
| `ADMIN_PASSWORD` | Plain-text fallback, used **only** when `ADMIN_PASSWORD_HASH` is not set (logs a warning). Local dev only. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay API keys (Dashboard → Account & Settings → API Keys). |
| `RAZORPAY_WEBHOOK_SECRET` | The secret you type when creating the Razorpay webhook. |
| `ALLOWED_ORIGIN` (optional var) | Only if another site must call the API: one exact origin such as `https://admin.example.com`. Never `*`. |

What happens when something is missing:
- no `JWT_SECRET`, or neither password variable → `POST /api/auth/login` returns 503 "Admin login is not configured", and every admin route returns 401;
- no Razorpay keys → checkout (`/api/shop/create-order`) returns 503 "Online payments are not configured yet";
- no webhook secret → the webhook returns 503 (Razorpay retries later).

### Local secrets: `.dev.vars`
`wrangler pages dev` reads `.dev.vars` in the project root (gitignored):
```env
JWT_SECRET="a-long-random-string"
ADMIN_PASSWORD_HASH="pbkdf2_sha256$100000$...$..."   # from npm run hash-password
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="..."
```
For the R2 media upload script (`npm run upload`) also add an R2 API token for the Hi Studio account:
`CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (optionally `HI_MEDIA_BUCKET`, default `hi-studio-media`).
`R2_BUCKET_NAME` / `R2_UPLOADS_BUCKET_NAME` are no longer used by anything; bucket names live in `wrangler.toml`.

### Admin password hash
```powershell
npm run hash-password
```
Type the password twice (it is not shown; at least 10 characters). The command prints one line such as
`pbkdf2_sha256$100000$<salt>$<hash>` — that whole line is the value of `ADMIN_PASSWORD_HASH`.
(100 000 iterations is the maximum PBKDF2 count Cloudflare Workers accepts.)

---

## 3. Local Setup (PowerShell)

```powershell
npm install
npm run migrate      # applies migrations/*.sql to the local D1 database in .wrangler/state
npm run seed         # bundled photos, starter catalogue, shipping/shop settings
```
- Local D1 data lives in `.wrangler/state`. `wrangler.toml` pins it with `preview_database_id = "hi-studio-local-db-001"`,
  so it stays the same after you put the real production `database_id` in.
- **Only migration files belong in `migrations/`.** Wrangler runs every `.sql` file there as a migration.
  The seed script writes its SQL to `.wrangler/seed.sql` instead.
- The seed never changes existing rows (it uses `INSERT OR IGNORE`; bundled photos only get empty columns filled), so
  re-running it keeps every admin edit. It will add back demo rows that an admin deleted, so it's best run once per database.
- Optional: `npm run images` regenerates the responsive images and `public/data/manifest.json` from `originals/`.

---

## 4. Running Locally

```powershell
npm run dev
```
This starts Vite on http://localhost:5180 and the Pages Functions API on http://localhost:8788
(`wrangler pages dev public --port 8788`, using the D1 and R2 bindings from `wrangler.toml` and secrets from `.dev.vars`).
Vite forwards `/api/*` to port 8788. To run only the API: `npm run dev:funcs`.

### Local URLs:
- **Public Studio & Portfolio**: `http://localhost:5180/`
- **Online Fine Art Shop**: `http://localhost:5180/shop`
- **Bespoke Framing Atelier ("Frame Your Own Photo")**: `http://localhost:5180/shop/custom-frame`
- **Admin CMS Login**: `http://localhost:5180/admin/login`
- **API check**: `http://localhost:8788/api/site`

Sign in to the admin with the password whose hash is in `ADMIN_PASSWORD_HASH` (or `ADMIN_PASSWORD` locally).
Five wrong passwords from one IP lock sign-in for 15 minutes. To unlock locally:
`npx wrangler d1 execute hi-studio-db --local --command "DELETE FROM rate_limits"`.

Useful local checks:
```powershell
npx wrangler d1 execute hi-studio-db --local --command "SELECT COUNT(*) FROM photos"
npm run typecheck:functions
```

---

## 5. Production Deployment (first time)

Nothing below has been created yet. Run these logged in to the Cloudflare account that should own Hi Studio
(`npx wrangler login`, then check with `npx wrangler whoami`).

1. **Create the database** and copy the `database_id` it prints:
   ```powershell
   npx wrangler d1 create hi-studio-db
   ```
   In `wrangler.toml`, replace `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID` with that id. Leave `preview_database_id` as it is.
2. **Create the tables and starter data** in the production database:
   ```powershell
   npm run migrate:remote
   npm run seed:remote
   ```
3. **Create the R2 buckets** (both stay private; media is served through `/api/media`):
   ```powershell
   npx wrangler r2 bucket create hi-studio-media
   npx wrangler r2 bucket create hi-studio-uploads
   ```
4. **Optional: copy the bundled media to R2** (needs the R2 API token variables from section 2). The site does not
   depend on this, because `public/media` is deployed with the site.
   ```powershell
   npm run upload
   ```
5. **Create the Pages project and set the secrets** (secrets can only be added once the project exists):
   ```powershell
   npx wrangler pages project create hi-studio --production-branch main
   npx wrangler pages secret put JWT_SECRET --project-name hi-studio
   npx wrangler pages secret put ADMIN_PASSWORD_HASH --project-name hi-studio
   npx wrangler pages secret put RAZORPAY_KEY_ID --project-name hi-studio
   npx wrangler pages secret put RAZORPAY_KEY_SECRET --project-name hi-studio
   npx wrangler pages secret put RAZORPAY_WEBHOOK_SECRET --project-name hi-studio
   ```
   Do not set `ADMIN_PASSWORD` in production. Use live Razorpay keys (`rzp_live_...`) only when you are ready to take real payments.
6. **Build and deploy:**
   ```powershell
   npm run deploy
   ```
   (`build` → type-check the functions → `wrangler pages deploy dist`.) Bindings come from `wrangler.toml`.
7. **Razorpay webhook** (Dashboard → Account & Settings → Webhooks → Add new webhook):
   - URL: `https://<your-domain>/api/shop/webhook/razorpay`
   - Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`
   - Active events: `payment.captured` and `order.paid`
   - Payments are confirmed by the browser (`/api/shop/verify-payment`) and by this webhook; both are safe to repeat,
     and stock is reduced exactly once per order.
8. **Check it:** open `https://<your-domain>/api/site`, sign in to `/admin/login`, place a test order with Razorpay test keys.

Later schema changes: add `migrations/000N_*.sql`, then `npm run migrate` (local) and `npm run migrate:remote`.

---

## 6. Testing the Razorpay Webhook Locally
```powershell
# 1. Expose the local API:
cloudflared tunnel --url http://localhost:8788
# 2. In the Razorpay test-mode dashboard, add a webhook:
#    URL:    https://<tunnel-subdomain>.trycloudflare.com/api/shop/webhook/razorpay
#    Secret: the RAZORPAY_WEBHOOK_SECRET from .dev.vars
#    Events: payment.captured, order.paid
```
Requests without a valid `X-Razorpay-Signature` are rejected with 400.

---

## 7. Troubleshooting

| Issue | Resolution |
| :--- | :--- |
| **Port 5180 or 8788 in use** | `Get-Process -Id (Get-NetTCPConnection -LocalPort 8788).OwningProcess` to see what holds it, then stop it. An old `wrangler pages dev` started with `--d1`/`--binding` flags uses the wrong (empty) database — stop it and run `npm run dev` again. |
| **`/api/site` returns 500 "Something went wrong"** | Details are in the wrangler console. Usually the local database has no tables: run `npm run migrate` and `npm run seed`. |
| **Admin login says "not configured" (503)** | `JWT_SECRET` and `ADMIN_PASSWORD_HASH` (or `ADMIN_PASSWORD`) are missing, or the hash is malformed (the console says which). |
| **Checkout says "Could not start the payment" (502)** | Razorpay rejected the request — usually wrong or test-placeholder keys. The wrangler console logs Razorpay's reply. |
| **Checkout says "Online payments are not configured yet" (503)** | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are not set. |
| **Wrangler login unauthorized** | `npx wrangler logout`, then `npx wrangler login`. An API token needs D1:Edit, R2:Edit and Pages:Edit. |
| **Reset the local database** | Stop `npm run dev`, delete `.wrangler/state/v3/d1`, then `npm run migrate` and `npm run seed`. |
| **Several `wrangler pages dev` at once** | Instances of the same project share wrangler's dev registry; stopping one can crash the others. Run one at a time. |
