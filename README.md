# Elegant Moments — Full-Stack Website

Your original website (unchanged design, animations and pages) now has a real backend:

- **Node.js + Express** server that also serves the website
- **MySQL** database for booking requests, contact messages and blocked dates
- **Admin dashboard** at `/admin/` to view, confirm, search, export and delete bookings and messages
- Booking & contact forms now **save to the database** (WhatsApp stays as a backup button)

```
Browser ──► Express (server.js) ──► MySQL
              │  serves /public (your website)
              │  /api/*        public JSON API (forms)
              └  /api/admin/*  protected JSON API (dashboard)
```

---

## 1. Requirements

| Tool | Version | Check |
|---|---|---|
| Node.js | 18 or newer | `node -v` |
| MySQL | 5.7+ / 8.x (MariaDB 10.3+ also works) | `mysql --version` |

## 2. Setup (5 steps)

```bash
# 1. Open a terminal in this folder, install packages
npm install

# 2. Create your settings file
cp .env.example .env          # Windows: copy .env.example .env

# 3. Edit .env  → set DB_PASSWORD, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
#    (generate a secret:  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")

# 4. Create the database, tables and your admin login
npm run db:setup

# 5. Start
npm start
```

Open **http://localhost:3000** (website) and **http://localhost:3000/admin/** (dashboard).
Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you put in `.env`.

> Prefer phpMyAdmin / MySQL Workbench? Import `database/schema.sql` instead of step 4, then run
> `npm run admin:create -- "Your Name" you@email.com "StrongPassword123"` to add the admin.

## 3. What changed in the website

| File | Change |
|---|---|
| `public/booking/booking.html`, `assets/js/booking.js` | Form posts to `/api/bookings`. Optional email field added. Shows a reference number (e.g. `EM-K7P2QX`). "Send on WhatsApp instead" button kept. |
| `public/contact.html`, `assets/js/contact.js` | Form posts to `/api/contact`. Optional email field added. WhatsApp button kept. |
| `public/robots.txt` | `/admin/` and `/api/` hidden from search engines |
| `public/admin/` | **New** — dashboard (login, overview, bookings, messages, blocked dates, change password) |

Every other page, image, CSS and animation file is exactly as you sent it.

## 4. How booking works

1. Customer submits the form → saved as **pending** (a *request*, not a confirmed booking).
2. You get an email alert (if SMTP is configured) and see it in **Admin → Bookings**.
3. Call/WhatsApp the customer (the dashboard has one-click call + WhatsApp links), then set status to **confirmed**.
4. A confirmed booking fills its date: Weddings **1 per day**, Photography **4 per day** (change in `.env`). Customers then cannot request that date, and you cannot confirm over capacity.
5. **Blocked dates** tab: block holidays/days off (for everything, or Weddings/Photography only).

Statuses: `pending → confirmed → completed` or `cancelled`. Bookings table can be filtered, searched and **exported to CSV** (opens in Excel).

## 5. API reference

**Public**

| Method | URL | Purpose |
|---|---|---|
| POST | `/api/bookings` | Create booking request |
| POST | `/api/contact` | Send contact message |
| GET | `/api/availability?brand=weddings&date=YYYY-MM-DD` | Is a date free? |
| GET | `/api/health` | Server + database status |

**Admin** (needs sign-in cookie) — all under `/api/admin`

`POST /login` · `POST /logout` · `GET /me` · `POST /password` · `GET /stats` ·
`GET /bookings` · `GET /bookings.csv` · `GET|PATCH|DELETE /bookings/:id` ·
`GET /messages` · `PATCH|DELETE /messages/:id` · `GET|POST /blocked-dates` · `DELETE /blocked-dates/:id`

Booking body: `{ brand: "weddings"|"photography", service, name, phone, email?, date: "YYYY-MM-DD", place?, kind?, note? }`

## 6. Database tables (`database/schema.sql`)

- `admins` — dashboard users (passwords stored as bcrypt hashes)
- `bookings` — reference, brand, service, name, phone, email, event_date, location, shoot_type, note, status, admin_notes …
- `contact_messages` — name, phone, email, topic, message, status
- `blocked_dates` — date, brand, reason

## 7. Email notifications (optional)

Fill the `SMTP_*` lines in `.env`. For Gmail use `smtp.gmail.com`, port `587`, your address as user and a
**Google App Password** (not your normal password). You get an alert for each booking/message, and
customers who typed an email get an "we received your enquiry" email. If SMTP is empty, nothing is sent
and nothing breaks.

## 8. Security built in

- Passwords hashed with bcrypt; login rate-limited (10 tries / 15 min); same error for wrong email or password
- Admin session in an **httpOnly, SameSite=Strict** cookie (8 h); admin writes must be JSON
- All SQL is parameterised (no SQL injection); all dashboard output is HTML-escaped (no XSS)
- Server-side validation of every field (the browser checks are only for convenience)
- Rate limit on forms (default 15/hour per visitor — `RATE_LIMIT_FORMS_PER_HOUR`) + hidden honeypot field against bots
- Helmet security headers + Content-Security-Policy; CSV export neutralises spreadsheet formula injection
- Server refuses to start with a missing/short `JWT_SECRET`

## 9. Deploying to a real server

1. Upload the project (everything except `node_modules` and your local `.env`), create `.env` on the server.
2. In `.env`: `NODE_ENV=production`, `SITE_URL=https://yourdomain.com`, `COOKIE_SECURE=true` (HTTPS required),
   `TRUST_PROXY=true` if behind nginx/Cloudflare/cPanel proxy, strong `DB_PASSWORD`, `JWT_SECRET`.
3. `npm install --omit=dev && npm run db:setup`
4. Keep it running: `npm i -g pm2 && pm2 start server.js --name elegant-moments && pm2 save`
5. Put nginx / Apache / your host's Node.js app manager in front for HTTPS.
6. Optional: `python3 tools/seo.py https://yourdomain.com` (from the project root) stamps canonical URLs
   and writes `sitemap.xml` + `robots.txt` into `public/` (admin pages are excluded).

Hosts that work: any VPS (DigitalOcean, Hetzner, AWS Lightsail…), cPanel with "Setup Node.js App", Render/Railway (+ a managed MySQL).
Plain static hosts (Netlify, GitHub Pages) **cannot** run this backend.

**Back up** your database regularly: `mysqldump -u root -p elegant_moments > backup.sql`

## 10. Checking everything works

With the server running: `npm run test:smoke` runs ~48 automatic checks (validation, login, capacity rules,
CSV, security) and cleans up after itself. If you run it more than ~15 times an hour, raise
`RATE_LIMIT_FORMS_PER_HOUR` in `.env`.

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| `JWT_SECRET is missing or too short` | Set a long random `JWT_SECRET` in `.env` |
| `Access denied for user` | Wrong `DB_USER` / `DB_PASSWORD` in `.env` |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL is not running — start it (XAMPP/WAMP: press Start on MySQL) |
| `EADDRINUSE` | Port busy — change `PORT` in `.env` |
| Can't sign in to admin | Re-set it: `npm run admin:create -- "Name" email "NewStrongPass123"` |
| Admin cookie not kept on your domain | Set `COOKIE_SECURE=true` only when using HTTPS; `false` for http://localhost |
| Opening `index.html` by double-click | Forms need the server — always use `http://localhost:3000` |

## 12. Folder structure

```
server.js              Express app (security, API, static site)
src/config/            env.js, db.js (MySQL pool)
src/routes/            public.js (forms), admin.js (dashboard API)
src/middleware/        auth.js (JWT cookie), errors.js
src/utils/             validation.js, mailer.js, availability.js
database/schema.sql    MySQL tables
scripts/               setup-db.js, create-admin.js, smoke-test.js
tools/seo.py           optional SEO helper (canonical URLs + sitemap)
public/                YOUR WEBSITE + public/admin/ dashboard
docs/                  original audit/test reports + frontend README
```








assets/images/weddings/pre-shoot/pre-shoot-23.webp
