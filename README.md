# MediCare Backend — PH Healthcare System

REST API for **MediCare**, a doctor-appointment platform where patients book consultations with doctors, handle payments via bKash, join video consultations, and receive digital prescriptions. Doctors manage schedules and prescriptions, while Admins / Super Admins manage users and platform operations.

> **Repository:** [`github.com/MasadRayan/Medicare_Backend`](https://github.com/MasadRayan/Medicare_Backend)
> **Spec:** See [`Project Requirements.md`](./Project%20Requirements.md) for the full product specification.

---

## 1. Project Description

MediCare connects **Patients** with **Doctors** for online consultations:

- **Patients** register (email/password or Google), verify email via OTP, book time slots on a doctor's published schedule for **today only**, pay upfront, receive an invoice PDF by email, join via meet link, and get prescription PDFs after completion.
- **Doctors** apply with credentials, get verified/approved by Admins, publish daily schedules (3–8 hours, 20-min slots), set meet links, manage appointments (`PENDING → CONFIRMED → ONGOING → COMPLETED → CANCELLED`), and issue prescriptions.
- **Admin / Super Admin** manage doctor applications, block/unblock users, create new Admins (Super Admin alone can create/block Super Admins & Admins), and view analytics.
- **Payments** are processed through **bKash Tokenized Checkout** (sandbox). Cancellation refunds depend on timing (>1 hour before schedule start = refund).
- Cross-cutting features: JWT auth (access + refresh via cookies), Google OAuth (patients only), OTP email verification, password reset/change/set-password flows, Cloudinary uploads (profile images, doctor resumes), Redis caching/OTP store, scheduled cron cleanup, and PDF generation.

Four roles: `SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `PATIENT`.

---

## 2. Live Link

| Service | URL |
|---------|-----|
| **API (Production)** | `Not deployed yet` — run locally on `http://localhost:8000` |
| **API (Local)** | `http://localhost:8000` — `GET /` returns `{ success, message: "Welcome to MediCare System Backend" }` |
| **Frontend** | `http://localhost:3000` (set via `FRONTEND_URL` for CORS) |

> When you deploy (e.g. Render / Vercel / Railway), replace the production URL here and set `FRONTEND_URL` / `BACKEND_URL` accordingly.

---

## 3. How to Install & Run

### Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node -v` |
| PostgreSQL | 14+ | `psql -V` |
| Redis | 6+ (cloud or local) | `redis-cli ping` |
| npm / pnpm / yarn / bun | any | `npm -v` |

### Steps

**1. Clone & install**

```bash
git clone https://github.com/MasadRayan/Medicare_Backend.git
cd Medicare_Backend
npm install
```

**2. Create environment file**

```bash
cp .env.example .env
# then edit .env — see Section 6 for all variables
```

**3. Generate Prisma Client**

```bash
npx prisma generate
```

> The client is written to `src/generated/prisma` (git-ignored). Must be regenerated after any `prisma/schema/*.prisma` change. App will not compile without it.

**4. Run database migrations**

```bash
npx prisma migrate dev
```

This creates tables `users`, `patients`, `doctors`, `schedules`, `appointments`, `payments`, etc.

**5. Start the server**

```bash
npm run dev      # watch mode via tsx — recommended for development
```

Expected logs:

```
Connected to the database successfully.
Connected to Redis successfully.
Nodemailer is connected successfully.
Super Admin Created ...  (or Already Exists)
Server is running on port 8000
```

Verify:

```bash
curl http://localhost:8000/
# {"success":true,"message":"Welcome to MediCare System Backend"}
```

### Other Scripts

```bash
npm run build        # tsc typecheck + emit to dist/
npm start            # runs built output (uses tsx under the hood in this repo)
npm run format:check # Biome format check
npm run format:fix   # Biome format fix
npm run lint:check   # Biome lint check
npm run lint:fix     # Biome lint fix

npx prisma studio    # GUI at http://localhost:5555
npx prisma migrate dev
npx prisma generate
```

> **Note on `npm run build`:** The project uses extensionless imports (`from './app'`) resolved by `tsx`. Running `node dist/src/server.js` directly fails with `ERR_UNSUPPORTED_DIR_IMPORT`; use `npm start` which runs via `tsx`.

---

## 4. Folder Structure

```
.
├── prisma/
│   ├── config.ts               # Prisma config — loads .env, points to schema/migrations
│   ├── schema/
│   │   ├── schema.prisma       # generator + datasource
│   │   ├── enums.prisma        # Role, UserStatus, Gender, AuthProvider, AppointmentStatus, PaymentStatus, DoctorverificationStatus, ScheduleStatus
│   │   ├── user.prisma         # User model
│   │   ├── patient.prisma      # Patient model
│   │   ├── doctor.prisma       # Doctor model
│   │   ├── schedule.prisma     # Schedule model
│   │   ├── appointment.prisma  # Appointment model
│   │   └── payment.prisma      # Payment model
│   └── migrations/             # generated SQL (git-ignored per .gitignore in this repo)
│
├── src/
│   ├── server.ts               # bootstrap: prisma + redis + nodemailer + seed + cron → app.listen
│   ├── app.ts                  # Express app: CORS, parsers, routes, error handlers
│   ├── generated/prisma/       # Prisma client output (git-ignored)
│   └── app/
│       ├── config/index.ts     # single place reading process.env via dotenv
│       ├── interfaces/index.ts # shared TypeScript interfaces
│       ├── lib/
│       │   ├── prisma.ts       # shared PrismaClient (adapter-pg) — always import this
│       │   ├── redis.ts        # Redis client
│       │   ├── nodemailer.ts   # email transporter
│       │   ├── cloudinary.ts   # Cloudinary config
│       │   ├── multer.ts       # file upload handling
│       │   ├── googleAuth.ts   # Google OAuth verification
│       │   ├── bkash.ts        # bKash token & payment helpers
│       │   └── corn.ts         # cron: deleteUnverifiedDoctors etc.
│       ├── middleware/
│       │   ├── checkAuth.ts        # auth(...roles) — JWT + role guard
│       │   ├── validateRequest.ts  # Zod validation wrapper
│       │   ├── globalErrorHandler.ts
│       │   └── notFound.ts
│       ├── utils/
│       │   ├── catchAsync.ts
│       │   ├── sendResponse.ts     # standard { success, statusCode, message, data } envelope
│       │   ├── jwt.ts              # sign / verify helpers
│       │   ├── AppError.ts
│       │   └── seed.ts             # seedSuperAdmin / seedTesterAdmin / seedTesterDoctor
│       ├── templates/              # EJS email templates
│       │   ├── patient-welcome-email.ejs
│       │   ├── user-registration.ejs
│       │   ├── doctor-application-approved.ejs
│       │   ├── doctor-application-rejected.ejs
│       │   ├── forget-password.ejs
│       │   └── reset-password-success.ejs
│       └── module/
│           ├── auth/           # register, login, google, me, refresh-token, forget/reset/verify
│           │   ├── auth.route.ts
│           │   ├── auth.controller.ts
│           │   ├── auth.service.ts
│           │   ├── auth.validation.ts
│           │   └── auth.interface.ts
│           ├── user/           # profile image upload
│           ├── doctor/         # apply, approval, listing, profile
│           ├── schedule/       # create/publish/update, availability
│           ├── appointment/    # book, list (my/doctor/all), single, status transitions, cancel
│           ├── payment/        # bKash flows, list payments
│           ├── prescription/   # create + fetch, PDF + email
│           └── analytics/      # role-based analytics
│
├── biome.json
├── tsconfig.json
├── package.json
├── .env.example
└── Project Requirements.md
```

**Module convention** — each feature under `src/app/module/<name>/`:

| File | Responsibility |
|------|---------------|
| `<name>.route.ts` | Wires `auth(...roles)` + `validateRequest` to controllers |
| `<name>.controller.ts` | Reads `req`, calls service, sends `sendResponse` |
| `<name>.service.ts` | Business logic + all Prisma calls |
| `<name>.validation.ts` | Zod schemas |
| `<name>.interface.ts` | TypeScript types for payloads |

Routes are mounted in `src/app.ts:39-46` as `/api/auth`, `/api/user`, `/api/doctor`, `/api/schedule`, `/api/appointment`, `/api/payment`, `/api/prescription`, `/api/analytics`.

---

## 5. Tech Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js 20+, TypeScript 7, `tsx` |
| **Framework** | Express 5 |
| **Database** | PostgreSQL + Prisma 7 (Prisma Client, `@prisma/adapter-pg`, `pg`) |
| **Auth** | JWT (`jsonwebtoken`), `bcryptjs`, Google OAuth (`google-auth-library`) |
| **Validation** | Zod |
| **Cache / OTP** | Redis (`redis` client) |
| **Email** | Nodemailer + EJS templates |
| **File Upload** | Multer + Cloudinary |
| **Payments** | bKash Tokenized Checkout (`BKASH_*` env) |
| **PDF** | PDFKit (invoices & prescriptions) |
| **Scheduling** | node-cron (cleanup of unverified doctors) |
| **Utilities** | `date-fns`, `cors`, `cookie-parser`, `dotenv`, `http-status` |
| **Code Quality** | Biome (format & lint) |
| **Build** | `tsc` → `dist/`, `tsx watch` for dev |

---

## 6. Environment Variables

All variables are read in `src/app/config/index.ts:6-43` via `dotenv`. The app does **not** validate them on boot — missing values surface as runtime errors (e.g. JWT sign fails on first login).

Copy `.env.example` to `.env` and fill every value:

```env
# ── Core ──────────────────────────────────────────────
NODE_ENV=development
PORT=8000
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/medicare?schema=public"
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# ── Auth ──────────────────────────────────────────────
JWT_ACCESS_SECRET=change-me-generate-with-crypto-randomBytes-32-hex
JWT_REFRESH_SECRET=change-me-generate-with-crypto-randomBytes-32-hex
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com

# ── Seed Accounts (created on server boot if not exist) ──
SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_EMAIL=superadmin@example.com
SUPER_ADMIN_PASSWORD=Super@admin12345

TESTER_ADMIN_NAME=Tester Admin
TESTER_ADMIN_EMAIL=testeradmin@example.com
TESTER_ADMIN_PASSWORD=Tester@admin12345

TESTER_DOCTOR_NAME=Tester Doctor
TESTER_DOCTOR_EMAIL=testerdoctor@example.com
TESTER_DOCTOR_PASSWORD=Tester@doctor12345

# ── Redis ─────────────────────────────────────────────
REDIS_USERNAME=default
REDIS_PASSWORD=your-redis-password
REDIS_HOST=your-redis-host.db.redis.io
REDIS_PORT=14125

# ── Email (Nodemailer / Gmail App Password) ───────────
SMTP_USER=youremail@gmail.com
EMAIL_SENDER=youremail@gmail.com
SMTP_PASSWORD=your-gmail-app-password

# ── Cloudinary ────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# ── bKash (Sandbox) ───────────────────────────────────
BKASH_BASE_URL=https://tokenized.sandbox.bka.sh/v1.2.0-beta
BKASH_USERNAME=sandboxTokenizedUser02
BKASH_PASSWORD=sandboxTokenizedUser02@12345
BKASH_APP_KEY=your-bkash-app-key
BKASH_APP_SECRET=your-bkash-app-secret
BKASH_CALLBACK_URL=http://localhost:8000/api/payment/callback
```

Generate strong JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Tip:** `src/app/config/index.ts` reads `APP_URL` as `bak_url` — set `BACKEND_URL` in `.env` but the code expects `APP_URL`. Ensure your `.env` key matches what `config` reads, or align them.

---

## 7. API Overview

Base URL: `http://localhost:8000`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | — | Health check |
| `POST` | `/api/auth/register` | — | Patient registration |
| `POST` | `/api/auth/login` | — | Login (any role, email/password) |
| `POST` | `/api/auth/google` | — | Google login (patients only) |
| `GET` | `/api/auth/me` | JWT | Current user profile |
| `POST` | `/api/auth/refresh-token` | cookie | Refresh access token |
| `POST` | `/api/auth/forget-password` | — | Send OTP to email |
| `POST` | `/api/auth/reset-password` | — | Reset with OTP |
| `POST` | `/api/auth/verify-email` | — | Verify email OTP |
| `PATCH` | `/api/user/profile-image` | JWT | Upload profile image |
| `*` | `/api/doctor/*` | varies | Doctor application, approval, listing |
| `*` | `/api/schedule/*` | varies | Create / publish / update schedules |
| `*` | `/api/appointment/*` | JWT | Book & manage appointments |
| `*` | `/api/payment/*` | JWT | bKash payment & refund flows |
| `*` | `/api/prescription/*` | JWT | Create / fetch prescriptions |
| `*` | `/api/analytics/*` | JWT | Role-based analytics |
| `GET` | `/test` | — | bKash connectivity test |

Standard success envelope (via `sendResponse`):

```json
{ "success": true, "statusCode": 200, "message": "...", "data": {} }
```

Auth: `Authorization: Bearer <accessToken>` or `accessToken` cookie. Tokens are issued on login/register (access + refresh).

---

## 8. Creator Details

| Field | Info |
|-------|------|
| **Name** | Masad Rayan |
| **Email** | masadrayan2002@gmail.com |
| **GitHub** | [@MasadRayan](https://github.com/MasadRayan) |
| **Repository** | [github.com/MasadRayan/Medicare_Backend](https://github.com/MasadRayan/Medicare_Backend) |

Built as part of the PH Healthcare / MediCare platform. Contributions and issues welcome via GitHub.

---

## License

ISC
