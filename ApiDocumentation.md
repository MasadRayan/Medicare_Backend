# MediCare Backend — API Documentation

Complete list of every endpoint, its source file, sample request, and possible error messages.

---

## Table of Contents

1. [Base Info & Conventions](#1-base-info--conventions)
2. [Source File Map](#2-source-file-map)
3. [Base Routes](#3-base-routes)
4. [Auth — `/api/auth`](#4-auth--apiauth)
5. [User — `/api/user`](#5-user--apiuser)
6. [Doctor — `/api/doctor`](#6-doctor--apidoctor)
7. [Schedule — `/api/schedule`](#7-schedule--apischedule)
8. [Appointment — `/api/appointment`](#8-appointment--apiappointment)
9. [Payment — `/api/payment`](#9-payment--apipayment)
10. [Prescription — `/api/prescription`](#10-prescription--apiprescription)
11. [Analytics — `/api/analytics`](#11-analytics--apianalytics)
12. [Global Error Reference](#12-global-error-reference)

---

## 1. Base Info & Conventions

| Item | Value |
| --- | --- |
| Base URL (dev) | `http://localhost:8000` |
| Port | `8000` (`PORT` env) |
| API prefix | `/api` |
| Stack | Node + Express 5 + TypeScript + Prisma (PostgreSQL) |
| Auth | JWT access + refresh tokens |
| Validation | Zod v4 |
| Payment gateway | bKash tokenized checkout |
| File storage | Cloudinary |
| OTP store | Redis (5 min for auth, 60 min for doctor application) |

### Authentication

Two equivalent ways to send the access token (read in this order by `src/app/middleware/checkAuth.ts:30`):

1. **Cookie** `accessToken` (httpOnly, set on login / verify-email / google / refresh)
2. **Header** `Authorization: Bearer <accessToken>`

Cookies are also set with `secure: true, sameSite: "none"` in non-development environments.

Tokens are returned in the JSON body **and** set as cookies.

### Standard success response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human readable message",
  "data": {},
  "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
}
```

`meta` is only present on paginated list endpoints. Produced by `src/app/utils/sendResponse.ts:18`.

### Standard error response

```json
{
  "success": false,
  "statusCode": 400,
  "name": "ZodError",
  "message": "Invalid email address",
  "error": {},
  "stack": "..."
}
```

> **Important:** `name`, real `message`, `error` and `stack` are only exposed when `NODE_ENV=development`. In production every error is masked to:
> `{ "success": false, "statusCode": 500, "name": "Internal Server Error", "message": "Internal Server Error" }`
> See `src/app/middleware/globalErrorHandler.ts:56`.

### Route not found (404)

```json
{
  "message": "Route not found",
  "path": "/api/unknown",
  "date": "2026-01-01T00:00:00.000Z"
}
```

### Pagination / sorting query parameters

Used by most `GET` list endpoints.

| Param | Default | Notes |
| --- | --- | --- |
| `page` | `1` | |
| `limit` | `10` | |
| `sortBy` | `createdAt` | (or `startDateTime` on some) |
| `sortOrder` | `desc` | `asc` / `desc` |
| `searchTerm` | – | free-text search, case-insensitive |

### Roles

`SUPER_ADMIN` · `ADMIN` · `DOCTOR` · `PATIENT`

### Common auth errors (apply to every protected route)

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No `accessToken` cookie and no `Authorization` header |
| 401 | `jwt expired` / `jwt malformed` / `invalid signature` | Access token invalid or expired (raw jwt error text in dev) |
| 403 | `Forbidden. You don't have permission to access this resource.` | Authenticated but role not allowed |
| 404 | `User not found. Please log in again.` | Token valid but user row missing |
| 403 | `Your account has been blocked. Please contact support.` | `user.status === BLOCKED` |

---

## 2. Source File Map

| Module | Base path | Route file | Controller | Service | Validation | Interface |
| --- | --- | --- | --- | --- | --- | --- |
| Base | `/` | `src/app.ts` | – | – | – | – |
| Auth | `/api/auth` | `src/app/module/auth/auth.route.ts` | `auth.controller.ts` | `auth.service.ts` | `auth.validation.ts` | `auth.interface.ts` |
| User | `/api/user` | `src/app/module/user/user.route.ts` | `user.controller.ts` | `user.service.ts` | – | – |
| Doctor | `/api/doctor` | `src/app/module/doctor/doctor.route.ts` | `doctor.controller.ts` | `doctor.service.ts` | `doctor.validation.ts` | `doctor.inetrface.ts` |
| Schedule | `/api/schedule` | `src/app/module/schedule/schedule.route.ts` | `schedule.controller.ts` | `schedule.service.ts` | `schedule.validation.ts` | `schedule.interface.ts` |
| Appointment | `/api/appointment` | `src/app/module/appointment/appointment.route.ts` | `appointment.controller.ts` | `appointment.service.ts` | `appointment.validation.ts` | `appointment.interface.ts` |
| Payment | `/api/payment` | `src/app/module/payment/payment.route.ts` | `payment.controller.ts` | `payment.service.ts` | – | `payment.interface.ts` |
| Prescription | `/api/prescription` | `src/app/module/prescription/prescription.route.ts` | `prescription.controller.ts` | `prescription.service.ts` | `prescription.validation.ts` | `prescription.interface.ts` |
| Analytics | `/api/analytics` | `src/app/module/analytics/analytics.route.ts` | `analytics.controller.ts` | `analytics.service.ts` | – | – |

Shared files:

| File | Purpose |
| --- | --- |
| `src/server.ts` | HTTP server bootstrap |
| `src/app.ts` | Express app, route mounting, CORS, body parsers |
| `src/app/middleware/checkAuth.ts` | JWT verification + role guard |
| `src/app/middleware/validateRequest.ts` | Zod body validation → 400 |
| `src/app/middleware/globalErrorHandler.ts` | Maps errors to status codes |
| `src/app/middleware/notFound.ts` | 404 for unknown routes |
| `src/app/utils/sendResponse.ts` | Standard success envelope |
| `src/app/utils/AppError.ts` | Operational error with `statusCode` |
| `src/app/utils/catchAsync.ts` | Async error forwarding |
| `src/app/lib/multer.ts` | `memoryStorage` multer instance |
| `src/app/lib/cloudinary.ts` | Cloudinary uploader |
| `src/app/lib/redis.ts` | Redis client (OTP cache) |
| `src/app/lib/nodemailer.ts` | SMTP transport |
| `src/app/lib/bkash.ts` | bKash token fetch |
| `src/app/lib/googleAuth.ts` | Google ID token client |
| `src/app/lib/prisma.ts` | Prisma client instance |
| `src/app/config/index.ts` | Env config loader |
| `src/app/templates/*.ejs` | Email templates |
| `prisma/schema/*.prisma` | Database schema |

### Endpoint index

| # | Method | Path | Access | File |
| --- | --- | --- | --- | --- |
| 1 | GET | `/` | Public | `src/app.ts:67` |
| 2 | GET | `/test` | Public | `src/app.ts:48` |
| 3 | POST | `/api/auth/register` | Public | `auth.route.ts:10` |
| 4 | POST | `/api/auth/verify-email` | Public | `auth.route.ts:37` |
| 5 | POST | `/api/auth/login` | Public | `auth.route.ts:15` |
| 6 | POST | `/api/auth/google` | Public | `auth.route.ts:26` |
| 7 | POST | `/api/auth/forget-password` | Public | `auth.route.ts:27` |
| 8 | POST | `/api/auth/reset-password` | Public | `auth.route.ts:32` |
| 9 | POST | `/api/auth/refresh-token` | Cookie | `auth.route.ts:25` |
| 10 | POST | `/api/auth/logout` | Public | `auth.route.ts:43` |
| 11 | GET | `/api/auth/me` | Any role | `auth.route.ts:20` |
| 12 | PATCH | `/api/user/profile-image` | Any role | `user.route.ts:9` |
| 13 | POST | `/api/doctor/apply-as-doctor` | Public | `doctor.route.ts:11` |
| 14 | POST | `/api/doctor/apply-as-doctor/verify-email` | Public | `doctor.route.ts:26` |
| 15 | POST | `/api/doctor/approve-doctor` | ADMIN, SUPER_ADMIN | `doctor.route.ts:31` |
| 16 | GET | `/api/doctor/all-doctors` | ADMIN, SUPER_ADMIN | `doctor.route.ts:37` |
| 17 | PATCH | `/api/doctor/update-my-profile` | DOCTOR | `doctor.route.ts:43` |
| 18 | GET | `/api/doctor/public/available-today` | Public | `doctor.route.ts:50` |
| 19 | GET | `/api/doctor/public/all-doctors` | Public | `doctor.route.ts:55` |
| 20 | GET | `/api/doctor/public/:doctorId` | Public | `doctor.route.ts:60` |
| 21 | POST | `/api/schedule/create-schedule` | DOCTOR | `schedule.route.ts:13` |
| 22 | GET | `/api/schedule/my-schedules` | DOCTOR | `schedule.route.ts:20` |
| 23 | GET | `/api/schedule/all-schedules` | ADMIN, SUPER_ADMIN | `schedule.route.ts:26` |
| 24 | GET | `/api/schedule/todays-schedule` | Public | `schedule.route.ts:32` |
| 25 | PATCH | `/api/schedule/update-schedule/:scheduleId` | DOCTOR | `schedule.route.ts:34` |
| 26 | PATCH | `/api/schedule/publish-schedule/:scheduleId` | DOCTOR | `schedule.route.ts:41` |
| 27 | GET | `/api/schedule/:scheduleId` | DOCTOR, ADMIN, SUPER_ADMIN | `schedule.route.ts:47` |
| 28 | DELETE | `/api/schedule/:scheduleId` | DOCTOR | `schedule.route.ts:53` |
| 29 | POST | `/api/appointment/book-appointment` | PATIENT | `appointment.route.ts:13` |
| 30 | POST | `/api/appointment/pay-appointment` | PATIENT | `appointment.route.ts:19` |
| 31 | POST | `/api/appointment/cancel-appointment` | PATIENT | `appointment.route.ts:24` |
| 32 | GET | `/api/appointment/book-appointment/payment/callback` | Public (bKash) | `appointment.route.ts:29` |
| 33 | PATCH | `/api/appointment/update-status/:appointmentId` | DOCTOR | `appointment.route.ts:33` |
| 34 | GET | `/api/appointment/my-appointments` | PATIENT | `appointment.route.ts:39` |
| 35 | GET | `/api/appointment/doctor-appointments` | DOCTOR | `appointment.route.ts:45` |
| 36 | GET | `/api/appointment/all-appointments` | ADMIN, SUPER_ADMIN | `appointment.route.ts:51` |
| 37 | GET | `/api/appointment/:appointmentId` | PATIENT, DOCTOR, ADMIN, SUPER_ADMIN | `appointment.route.ts:57` |
| 38 | GET | `/api/payment/my-payments` | PATIENT | `payment.route.ts:8` |
| 39 | GET | `/api/payment/all-payments` | ADMIN, SUPER_ADMIN | `payment.route.ts:10` |
| 40 | GET | `/api/payment/:paymentId` | PATIENT, ADMIN, SUPER_ADMIN | `payment.route.ts:16` |
| 41 | POST | `/api/prescription/create-prescription` | DOCTOR | `prescription.route.ts:10` |
| 42 | GET | `/api/prescription/:appointmentId` | PATIENT, DOCTOR, ADMIN, SUPER_ADMIN | `prescription.route.ts:17` |
| 43 | GET | `/api/analytics/patient-analytics` | PATIENT | `analytics.route.ts:8` |
| 44 | GET | `/api/analytics/doctor-analytics` | DOCTOR | `analytics.route.ts:14` |
| 45 | GET | `/api/analytics/admin-analytics` | ADMIN, SUPER_ADMIN | `analytics.route.ts:20` |

---

## 3. Base Routes

### 3.1 `GET /`

**File:** `src/app.ts:67` · **Auth:** Public · **Body:** none

**Sample response — 200**
```json
{
  "success": true,
  "message": "Welcome to MediCare System Backend"
}
```

**Errors:** none handled (always 200).

---

### 3.2 `GET /test`

**File:** `src/app.ts:48` · **Auth:** Public · **Body:** none

Health check that also requests a bKash ID token (side effect).

**Sample response — 200**
```json
{
  "success": true,
  "message": "Test route is working"
}
```

**Sample response — 500**
```json
{
  "success": false,
  "message": "Test route is not working",
  "data": {}
}
```

| Status | Message | Cause |
| --- | --- | --- |
| 500 | `Test route is not working` | bKash token fetch failed (credentials/network) |

---

## 4. Auth — `/api/auth`

Route file: `src/app/module/auth/auth.route.ts` · Validation: `auth.validation.ts` · Service: `auth.service.ts`

### 4.1 `POST /api/auth/register`

**Access:** Public · **Validation:** `PatientRegistrationZodSchema`

Registers a patient by staging data in Redis and emailing a 6-digit OTP (valid **5 minutes**). The user is not created until `verify-email` succeeds.

**Sample request**
```json
{
  "name": "Masad Rayan",
  "email": "masadrayan2002@gmail.com",
  "password": "@Masad12#",
  "patient": {
    "contactNumber": "+8801712345678"
  }
}
```

**Sample response — 201**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Email verification OTP sent successfully. Please check your email.",
  "data": null
}
```

**Field rules**

| Field | Type | Required | Rule / Error message |
| --- | --- | --- | --- |
| `name` | string | yes | min 1 → `Name is required` |
| `email` | string | yes | valid email → `Invalid email address` |
| `password` | string | yes | min 5 → `Password must be at least 5 characters long`; `/[A-Z]/` → `Password must contain at least one uppercase letter`; `/[a-z]/` → `Password must contain at least one lowercase letter`; `/[0-9]/` → `Password must contain at least one number`; `/[^A-Za-z0-9]/` → `Password must contain at least one special character` |
| `patient.contactNumber` | string | no | any string |

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `Invalid input: expected string, received undefined` | `name` or `password` key missing entirely (first Zod issue is returned) |
| 400 | `Name is required` | `name` is `""` |
| 400 | `Invalid email address` | `email` malformed |
| 400 | `Password must be at least 5 characters long` | Password too short |
| 400 | `Password must contain at least one uppercase letter` | No uppercase |
| 400 | `Password must contain at least one lowercase letter` | No lowercase |
| 400 | `Password must contain at least one number` | No digit |
| 400 | `Password must contain at least one special character` | No symbol |
| 409 | `User with this email already exists` | Email already registered |

---

### 4.2 `POST /api/auth/verify-email`

**Access:** Public · **Validation:** `VerifyEmailZodSchema`

Consumes the OTP, creates the `User` + `Patient` rows, marks email verified, sends a welcome email, and issues tokens. Sets `accessToken` (24 h) and `refreshToken` (7 d) httpOnly cookies.

**Sample request**
```json
{
  "email": "masadrayan2002@gmail.com",
  "otp": "714993"
}
```

**Sample response — 201**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "0f9a...",
      "name": "Masad Rayan",
      "email": "masadrayan2002@gmail.com",
      "emailVerified": true,
      "role": "PATIENT",
      "status": "ACTIVE",
      "authProivider": "CREDENTIAL",
      "imageURL": "",
      "imagePublicId": "",
      "needPasswordChange": false,
      "isDeleted": false,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    },
    "patient": {
      "id": "01H...",
      "name": "Masad Rayan",
      "email": "masadrayan2002@gmail.com",
      "contactNumber": "+8801712345678",
      "address": null,
      "isDeleted": false,
      "deletedAt": null,
      "userId": "0f9a...",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

> `password` is omitted from the response.

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `Invalid email address` | Malformed email |
| 400 | `OTP must be 6 digits long` | `otp` not exactly 6 characters |
| 400 | `Invalid input: expected string, received undefined` | `email` or `otp` key missing |
| 400 | `OTP is invalid or has expired` | No OTP in Redis (expired after 5 min or never requested) |
| 400 | `OTP is incorrect` | OTP mismatch |
| 400 | `User has registered with Google account` | Account created via Google |
| 400 | `User email is already verified` | Already verified |
| 403 | `User is blocked` | `user.status === BLOCKED` |
| 404 | `User is deleted` | `isDeleted` or `status === DELETED` |
| 404 | `Patient registration data not found` | Staged payload expired in Redis |
| 400 | `Duplicate Key Error` | Prisma `P2002` — email raced into existence |

---

### 4.3 `POST /api/auth/login`

**Access:** Public · **Validation:** `PatientLoginZodSchema`

**Sample request**
```json
{
  "email": "masadrayan2002@gmail.com",
  "password": "@Masad12#"
}
```

**Sample response — 200** (also sets cookies)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User logged in successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `Invalid email address` | Malformed email |
| 400 | `Password is required` | `password` is `""` |
| 400 | `Invalid input: expected string, received undefined` | `email`/`password` key missing |
| 404 | `User not found` | No user with that email |
| 403 | `User is blocked` | `status === BLOCKED` |
| 404 | `User is deleted` | Soft-deleted |
| 400 | `User registered with Google. Please login with Google.` | `password === null` and `googleid !== null` |
| 401 | `Invalid credentials` | Wrong password |

---

### 4.4 `POST /api/auth/google`

**Access:** Public · **Validation:** none (raw body)

Verifies a Google ID token. Creates a patient on first login, or links `googleid` to an existing credential account. Sets cookies + returns tokens.

**Sample request**
```json
{
  "idToken": "GOOGLE_ID_TOKEN_FROM_CLIENT"
}
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User logged in successfully",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `Google ID token varification failed` | `idToken` missing/invalid/expired, or `GOOGLE_CLIENT_ID` mismatch |
| 401 | `Google ID token payload is empty` | Ticket returned without payload |
| 400 | `Google ID token payload does not contain email` | No `email` claim |
| 400 | `Google ID token payload does not contain name` | No `name` claim |
| 403 | `User email is not verified` | Existing credential account with unverified email |
| 403 | `User is blocked` | Blocked account |
| 404 | `User is deleted` | Soft-deleted account |
| 500 | `User creation or retrieval failed` | Internal guard failure |

---

### 4.5 `POST /api/auth/forget-password`

**Access:** Public · **Validation:** `ForgetPasswordZodSchema`

Sends a 6-digit OTP to the registered email (valid **5 minutes**).

**Sample request**
```json
{
  "email": "masadrayan2002@gmail.com"
}
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "OTP sent to masadrayan2002@gmail.com successfully",
  "data": null
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `Invalid email address` | Malformed email |
| 404 | `User not found` | Email not registered |
| 403 | `User is blocked` | Blocked |
| 404 | `User is deleted` | Soft-deleted |
| 400 | `User has registered with Google account` | Google-only account |
| 403 | `User email is not verified` | Email not verified yet |

---

### 4.6 `POST /api/auth/reset-password`

**Access:** Public · **Validation:** `ResetPasswordZodSchema`

**Sample request**
```json
{
  "email": "masadrayan2002@gmail.com",
  "otp": "279768",
  "newPassword": "@Masad12#New1"
}
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password reset successfully",
  "data": null
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `Invalid email address` | Malformed email |
| 400 | `Invalid input: expected string, received undefined` | `email`/`newPassword`/`otp` key missing |
| 400 | `OTP must be 6 digits long` | `otp` not 6 chars |
| 400 | `Password must be at least 5 characters long` | New password too short |
| 400 | `Password must contain at least one uppercase letter` | – |
| 400 | `Password must contain at least one lowercase letter` | – |
| 400 | `Password must contain at least one number` | – |
| 400 | `Password must contain at least one special character` | – |
| 404 | `User not found` | Email not registered |
| 403 | `User is blocked` | Blocked |
| 404 | `User is deleted` | Soft-deleted |
| 400 | `User has registered with Google account` | Google-only account |
| 403 | `User email is not verified` | Email not verified |
| 400 | `OTP is invalid or has expired` | No/forgotten OTP in Redis |
| 400 | `OTP is incorrect` | OTP mismatch |

---

### 4.7 `POST /api/auth/refresh-token`

**Access:** Cookie only (`refreshToken`) · **Validation:** none

**Sample request** — no body; requires the `refreshToken` cookie.

```bash
curl -X POST http://localhost:8000/api/auth/refresh-token \
  -H "Cookie: refreshToken=<refresh_token>"
```

**Sample response — 200** (rotates both cookies)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "New tokens generated successfully",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `Refresh token is missing` | No `refreshToken` cookie |
| 401 | `Invalid refresh token` | Token failed verification (production). In dev the raw jwt error is returned instead, e.g. `jwt expired`, `invalid signature`, `jwt malformed` |
| 401 | `User is inactive or not found` | User deleted or `status !== ACTIVE` |

---

### 4.8 `POST /api/auth/logout`

**Access:** Public · **Body:** none

Clears both cookies.

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User logged out successfully",
  "data": null
}
```

**Errors:** none.

---

### 4.9 `GET /api/auth/me`

**Access:** `ADMIN` · `DOCTOR` · `PATIENT` · `SUPER_ADMIN`

**Sample request** — no body.

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User profile fetched successfully",
  "data": {
    "id": "0f9a...",
    "name": "Masad Rayan",
    "email": "masadrayan2002@gmail.com",
    "emailVerified": true,
    "role": "PATIENT",
    "status": "ACTIVE",
    "authProivider": "CREDENTIAL",
    "imageURL": "https://res.cloudinary.com/...",
    "imagePublicId": "profile/abc123",
    "patient": { "id": "01H...", "name": "Masad Rayan", "contactNumber": "+8801712345678" },
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 401 | jwt error text | Invalid/expired access token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not allowed |
| 404 | `User not found` | Authenticated user no longer exists |
| 404 | `User not found. Please log in again.` | Token subject no longer in DB |
| 401 | `User information is missing in the request` | `req.user` unexpectedly empty |
| 403 | `Your account has been blocked. Please contact support.` | Blocked |

---

## 5. User — `/api/user`

Route file: `src/app/module/user/user.route.ts`

### 5.1 `PATCH /api/user/profile-image`

**Access:** `PATIENT` · `DOCTOR` · `ADMIN` · `SUPER_ADMIN` · **Content-Type:** `multipart/form-data`

Uploads to Cloudinary, replaces the previous image (old public id is destroyed), and updates the user row.

**Sample request** — field name must be `profileImage`

```bash
curl -X PATCH http://localhost:8000/api/user/profile-image \
  -H "Authorization: Bearer <accessToken>" \
  -F "profileImage=@/path/to/profile.jpg"
```

**Sample response — 201**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Profile image uploaded successfully",
  "data": {
    "id": "0f9a...",
    "name": "Masad Rayan",
    "email": "masadrayan2002@gmail.com",
    "imageURL": "https://res.cloudinary.com/medicare/image/upload/v1730000000/profile/abc123.jpg",
    "imagePublicId": "profile/abc123",
    "role": "PATIENT"
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `No file uploaded` | `profileImage` part missing or empty |
| 400 | `LIMIT_UNEXPECTED_FILE` (multer) | Wrong field name (must be `profileImage`) |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | – |
| 500 | `No result returned` | Cloudinary returned no result |
| 500 | `Internal Server Error` | Cloudinary upload error (raw error propagated) |
| 400 | `An operation failed because it depends on one or more records that were required but not found.` | Prisma `P2025` — user deleted mid-request |

---

## 6. Doctor — `/api/doctor`

Route file: `src/app/module/doctor/doctor.route.ts` · Validation: `doctor.validation.ts` · Service: `doctor.service.ts`

### 6.1 `POST /api/doctor/apply-as-doctor`

**Access:** Public · **Content-Type:** `multipart/form-data`

> The JSON body must be sent as a **text field named `data`** (it is `JSON.parse`d server-side at `doctor.controller.ts:16`). Files: `resume` (max 1) and `additionalFiles` (max 10). Uploads to Cloudinary, creates a `User` (role `DOCTOR`, random temp password, `needPasswordChange: true`, status `PENDING`) and a `Doctor` row, then emails a 6-digit OTP valid **60 minutes**.

**Sample request**

```bash
curl -X POST http://localhost:8000/api/doctor/apply-as-doctor \
  -F 'data={"user":{"name":"Dr. John Doe","email":"johndoe@example.com"},"doctor":{"address":"123 Medical Center Plaza, Suite 400","specialization":"Cardiology","licenseNumber":"MD-987654321","qualifications":"MD, FACC - Harvard Medical School","experienceYears":12,"bio":"Dedicated cardiologist with over a decade of experience.","consultationFee":1500,"contactNumber":"+8801712345678"}}' \
  -F "resume=@/path/to/resume.pdf" \
  -F "additionalFiles=@/path/to/certificate.pdf"
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Applied As Doctor Successfuly",
  "data": {
    "id": "0f9a...",
    "name": "Dr. John Doe",
    "email": "johndoe@example.com",
    "role": "DOCTOR",
    "needPasswordChange": true,
    "doctor": {
      "id": "0d1c...",
      "name": "Dr. John Doe",
      "email": "johndoe@example.com",
      "specialization": "Cardiology",
      "licenseNumber": "MD-987654321",
      "qualifications": "MD, FACC - Harvard Medical School",
      "experienceYears": 12,
      "consultationFee": "1500.00",
      "verificationStatus": "PENDING",
      "resume": "https://res.cloudinary.com/.../resume.pdf",
      "resumePublicId": "resume/abc",
      "additionalFiles": [
        { "url": "https://res.cloudinary.com/.../certificate.pdf", "publicId": "certificate/xyz" }
      ]
    }
  }
}
```

**Validation messages** (from `ApplyAsDoctorValidationZodSchema`, first issue only)

| Field | Message |
| --- | --- |
| `user.name` | `Name must be at least 2 characters long` / `Invalid input: expected string, received undefined` |
| `user.email` | `Invalid email address` |
| `doctor.address` | `Address must be at least 5 characters long` |
| `doctor.specialization` | `Specialization is required` |
| `doctor.licenseNumber` | `License number is required` |
| `doctor.qualifications` | `Qualifications are required` |
| `doctor.experienceYears` | `Experience years must be an integer`, `Experience years cannot be negative`, `Invalid input: expected number, received undefined` |
| `doctor.bio` | `Bio cannot exceed 1000 characters` |
| `doctor.consultationFee` | `Consultation fee cannot be negative`, `Invalid input: expected number, received undefined` |
| `doctor.contactNumber` | `Contact number is invalid` |

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | *(any Zod message above)* | `data` field failed validation |
| 500 | `Unexpected end of JSON input` | `data` field missing or empty (raw `JSON.parse` failure) |
| 409 | `User Already Exists With This Email` | Email already used |
| 500 | `No result returned from Cloudinary` | Cloudinary returned no result for a file |
| 400 | `Duplicate Key Error` | Prisma `P2002` — duplicate email or license number |
| 500 | `Internal Server Error` | Cloudinary or mail error |

---

### 6.2 `POST /api/doctor/apply-as-doctor/verify-email`

**Access:** Public · **Validation:** none (raw body)

Confirms the doctor application email. OTP valid **60 minutes** from apply.

**Sample request**
```json
{
  "email": "johndoe@example.com",
  "otp": "582341"
}
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Applied As Doctor Successfuly",
  "data": {
    "id": "0f9a...",
    "emailVerified": true,
    "doctor": { "id": "0d1c...", "verificationStatus": "PENDING" }
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 404 | `Doctor Application Not Found. Please Apply Again.` | No doctor user with that email |
| 400 | `Email Already Verified` | Already verified |
| 400 | `OTP Expired. Your Application Window Has Closed, Please Apply Again.` | No OTP in Redis (60 min elapsed) |
| 400 | `OTP Does Not Match` | OTP mismatch |
| 400 | `An operation failed because it depends on one or more records that were required but not found.` | Prisma `P2025` |
| 500 | `Cannot read properties of undefined (reading 'trim')` | `email` key missing (raw `payload.email.trim()`) |

---

### 6.3 `POST /api/doctor/approve-doctor`

**Access:** `ADMIN` · `SUPER_ADMIN` · **Validation:** none (raw body)

Sets `verificationStatus` to `APPROVED` or `REJECTED`, records reviewer + timestamp, and emails the doctor.

**Sample request — approve**
```json
{
  "doctorId": "0d1c2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
  "verificationStatus": "APPROVED",
  "rejectionReason": ""
}
```

**Sample request — reject**
```json
{
  "doctorId": "0d1c2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f",
  "verificationStatus": "REJECTED",
  "rejectionReason": "License number could not be verified with the medical council."
}
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Applied As Doctor Successfuly",
  "data": {
    "id": "0d1c...",
    "verificationStatus": "APPROVED",
    "rejectionReason": null,
    "reviewedBy": "1a2b...",
    "reviewedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role is not ADMIN/SUPER_ADMIN |
| 403 | `Your account has been blocked. Please contact support.` | Blocked admin |
| 400 | `You have provided incorrect field type or missing fields` | `doctorId` missing → Prisma validation error |
| 404 | `Doctor Not Found` | No doctor with that id |
| 404 | `Doctor is Deleted` | Soft-deleted doctor |
| 400 | `Email Not Verified` | Doctor has not verified email yet |
| 400 | `Doctor Application Already approved` / `Doctor Application Already rejected` / `Doctor Application Already verified` | `verificationStatus !== PENDING` |
| 400 | `Rejection Reason is Required` | `REJECTED` without `rejectionReason` |

---

### 6.4 `GET /api/doctor/all-doctors`

**Access:** `ADMIN` · `SUPER_ADMIN`

**Query params**

| Param | Example | Notes |
| --- | --- | --- |
| `searchTerm` | `cardio` | Matches `name`, `email`, `specialization`, `licenseNumber` (case-insensitive contains) |
| `specialization` | `Cardiology` | Exact, case-insensitive |
| `email` | `johndoe@example.com` | Contains, case-insensitive |
| `licenseNumber` | `MD-987654321` | Exact, case-insensitive |
| `verificationStatus` | `PENDING` | `PENDING` / `VERIFIED` / `REJECTED` / `APPROVED` |
| `page` | `1` | |
| `limit` | `10` | |
| `sortBy` | `createdAt` | Any `Doctor` column |
| `sortOrder` | `desc` | `asc` / `desc` |

Only non-deleted doctors are returned.

**Sample request**
```
GET /api/doctor/all-doctors?searchTerm=cardio&specialization=Cardiology&email=johndoe@example.com&licenseNumber=MD-987654321&verificationStatus=PENDING&page=1&limit=10&sortBy=createdAt&sortOrder=desc
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Doctors Retrieved Successfully",
  "data": [
    {
      "id": "0d1c...",
      "name": "Dr. John Doe",
      "email": "johndoe@example.com",
      "specialization": "Cardiology",
      "licenseNumber": "MD-987654321",
      "qualifications": "MD, FACC",
      "experienceYears": 12,
      "consultationFee": "1500.00",
      "verificationStatus": "PENDING",
      "resume": "https://res.cloudinary.com/...",
      "user": { "id": "0f9a...", "emailVerified": true, "status": "ACTIVE" }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not allowed |
| 400 | `An operation failed because it depends on one or more records that were required but not found.` | Prisma `P2025` (invalid `sortBy` column) |
| 500 | `Error occurred during query execution` | Prisma unknown request error |

---

### 6.5 `PATCH /api/doctor/update-my-profile`

**Access:** `DOCTOR` · **Validation:** `UpdateDoctorProfileValidationZodSchema`

All fields optional; updates the `Doctor` record of the authenticated doctor.

**Sample request**
```json
{
  "address": "123 Medical Center Plaza, Suite 400",
  "bio": "Dedicated cardiologist with over a decade of experience.",
  "consultationFee": 1800,
  "contactNumber": "+8801712345678"
}
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Doctor Profile Updated Successfully",
  "data": {
    "id": "0d1c...",
    "name": "Dr. John Doe",
    "email": "johndoe@example.com",
    "address": "123 Medical Center Plaza, Suite 400",
    "bio": "Dedicated cardiologist with over a decade of experience.",
    "consultationFee": "1800.00",
    "contactNumber": "+8801712345678",
    "specialization": "Cardiology",
    "licenseNumber": "MD-987654321",
    "qualifications": "MD, FACC",
    "experienceYears": 12,
    "verificationStatus": "APPROVED"
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `Address must be at least 5 characters long` | `address` shorter than 5 chars |
| 400 | `Bio cannot exceed 1000 characters` | `bio` too long |
| 400 | `Consultation fee cannot be negative` | `consultationFee < 0` |
| 400 | `Invalid input: expected number, received string` | `consultationFee` sent as `"1800"` (must be a JSON number) |
| 400 | `Contact number is invalid` | `contactNumber` shorter than 5 chars |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not DOCTOR |
| 404 | `Doctor not found` | Token has no linked `Doctor` record |

---

### 6.6 `GET /api/doctor/public/available-today`

**Access:** Public

Returns `APPROVED`, non-deleted doctors that have at least one `PUBLISHED` schedule **today** (not yet started) with `availableSlots > 0`.

**Query params:** `searchTerm` (matches `name`, `specialization`), `specialization`, `page`, `limit`, `sortBy`, `sortOrder`

**Sample request**
```
GET /api/doctor/public/available-today?searchTerm=John&specialization=Cardiology&page=1&limit=10
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Today's Available Doctors Retrieved Successfully",
  "data": [
    {
      "id": "0d1c...",
      "name": "Dr. John Doe",
      "specialization": "Cardiology",
      "licenseNumber": "MD-987654321",
      "qualifications": "MD, FACC",
      "experienceYears": 12,
      "bio": "Dedicated cardiologist...",
      "consultationFee": "1500.00",
      "schedules": [
        {
          "id": "0s9f...",
          "startDateTime": "2026-09-12T09:00:00.000Z",
          "endDateTime": "2026-09-12T13:00:00.000Z",
          "availableSlots": 5,
          "totalSlots": 12
        }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `An operation failed because it depends on one or more records that were required but not found.` | Invalid `sortBy` column |
| 500 | `Error occurred during query execution` | Prisma unknown request error |

---

### 6.7 `GET /api/doctor/public/all-doctors`

**Access:** Public

All `APPROVED`, non-deleted doctors (no schedules attached).

**Query params:** `searchTerm` (matches `name`, `specialization`, `qualifications`), `specialization`, `page`, `limit`, `sortBy`, `sortOrder`

**Sample request**
```
GET /api/doctor/public/all-doctors?searchTerm=John&specialization=Cardiology&page=1&limit=10
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Doctors Retrieved Successfully",
  "data": [
    {
      "id": "0d1c...",
      "name": "Dr. John Doe",
      "specialization": "Cardiology",
      "licenseNumber": "MD-987654321",
      "qualifications": "MD, FACC",
      "experienceYears": 12,
      "bio": "Dedicated cardiologist...",
      "consultationFee": "1500.00",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors:** same as [6.6](#66-get-apidoctorpublicavailable-today).

---

### 6.8 `GET /api/doctor/public/:doctorId`

**Access:** Public

**Path params:** `doctorId` (Doctor `id`)

**Sample request**
```
GET /api/doctor/public/0d1c2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Doctor Profile Retrieved Successfully",
  "data": {
    "id": "0d1c...",
    "name": "Dr. John Doe",
    "specialization": "Cardiology",
    "licenseNumber": "MD-987654321",
    "qualifications": "MD, FACC",
    "experienceYears": 12,
    "bio": "Dedicated cardiologist...",
    "consultationFee": "1500.00",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 404 | `Doctor Not Found` | Not found, deleted, or not `APPROVED` |

---

## 7. Schedule — `/api/schedule`

Route file: `src/app/module/schedule/schedule.route.ts` · Validation: `schedule.validation.ts` · Service: `schedule.service.ts`

**Business rules:** start and end must be on the same calendar day, start must be before end, one schedule per doctor per day, slots are auto-computed at **20 minutes each** (`floor(duration / 20)`).

### 7.1 `POST /api/schedule/create-schedule`

**Access:** `DOCTOR` · **Validation:** `CreateScheduleValidationZodSchema`

**Sample request**
```json
{
  "startDateTime": "2026-09-12T09:00:00.000Z",
  "endDateTime": "2026-09-12T13:00:00.000Z",
  "meetingLink": "https://meet.google.com/abc-defg-hij"
}
```

**Sample response — 201** (4 h → 12 slots)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Schedule Created Successfully",
  "data": {
    "id": "0s9f...",
    "startDateTime": "2026-09-12T09:00:00.000Z",
    "endDateTime": "2026-09-12T13:00:00.000Z",
    "meetingLink": "https://meet.google.com/abc-defg-hij",
    "totalSlots": 12,
    "availableSlots": 12,
    "status": "DRAFT",
    "isDeleted": false,
    "doctor": { "name": "Dr. John Doe", "email": "johndoe@example.com", "contactNumber": "+8801712345678" }
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `Invalid Start Date Time` | Missing or unparseable `startDateTime` |
| 400 | `Invalid End Date Time` | Missing or unparseable `endDateTime` |
| 400 | `Invalid Meeting Link` | Not a valid URL |
| 400 | `Start and end times must be on the same day` | Crosses midnight |
| 400 | `Start time must be before end time` | `startDateTime > endDateTime` |
| 409 | `Schedule already exists for the given date` | Doctor already has a schedule that day |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not DOCTOR |
| 404 | `Doctor not found` | Token has no `Doctor` record |
| 400 | `Duplicate Key Error` | Prisma `P2002` on `unique_schedule` |

---

### 7.2 `GET /api/schedule/my-schedules`

**Access:** `DOCTOR`

**Query params:** `status` (`DRAFT`/`PUBLISHED`/`CANCELLED`), `page`, `limit` — sorted by `startDateTime desc`

**Sample request**
```
GET /api/schedule/my-schedules?status=DRAFT&page=1&limit=10
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Schedules Retrieved Successfully",
  "data": [
    {
      "id": "0s9f...",
      "startDateTime": "2026-09-12T09:00:00.000Z",
      "endDateTime": "2026-09-12T13:00:00.000Z",
      "meetingLink": "https://meet.google.com/abc-defg-hij",
      "totalSlots": 12,
      "availableSlots": 10,
      "status": "PUBLISHED",
      "appointments": [
        { "id": "0a1b...", "status": "CONFIRMED", "serialNumber": 1, "patient": { "id": "01H...", "name": "Masad Rayan", "email": "masadrayan2002@gmail.com" } }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not DOCTOR |
| 404 | `Doctor not found` | No `Doctor` record for token |

---

### 7.3 `GET /api/schedule/all-schedules`

**Access:** `ADMIN` · `SUPER_ADMIN`

**Query params:** `doctorId`, `email` (doctor email), `status`, `searchTerm` (doctor `name`, `email`, `specialization`), `page`, `limit`, `sortBy`, `sortOrder`

**Sample request**
```
GET /api/schedule/all-schedules?doctorId=0d1c...&email=johndoe@example.com&status=PUBLISHED&searchTerm=John&page=1&limit=10
```

**Sample response — 200** — same shape as [7.2](#72-get-apischedulemy-schedules).

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not ADMIN/SUPER_ADMIN |
| 400 | `An operation failed because it depends on one or more records that were required but not found.` | Invalid `sortBy` column |

---

### 7.4 `GET /api/schedule/todays-schedule`

**Access:** Public

Returns the doctor's `PUBLISHED`, non-deleted schedules for **today** with `availableSlots > 0` and `startDateTime > now`.

**Query params**

| Param | Required | Notes |
| --- | --- | --- |
| `doctorId` | **yes** | Doctor `id` |
| `page` | no | default `1` |
| `limit` | no | default `10` |
| `sortBy` | no | default `createdAt` |
| `sortOrder` | no | default `desc` |

**Sample request**
```
GET /api/schedule/todays-schedule?doctorId=0d1c2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f&page=1&limit=10
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Today's Schedules Retrieved Successfully",
  "data": [
    {
      "id": "0s9f...",
      "startDateTime": "2026-09-27T09:00:00.000Z",
      "endDateTime": "2026-09-27T13:00:00.000Z",
      "meetingLink": "https://meet.google.com/abc-defg-hij",
      "totalSlots": 12,
      "availableSlots": 8,
      "status": "PUBLISHED"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 404 | `Doctor ID is required` | `doctorId` query param missing |
| 404 | `Doctor not found` | No doctor with that id |

---

### 7.5 `PATCH /api/schedule/update-schedule/:scheduleId`

**Access:** `DOCTOR` · **Validation:** `UpdateScheduleValidationZodSchema` (all fields optional)

Missing fields fall back to the existing values. Changing the window **recomputes** `totalSlots` and **resets** `availableSlots` to that value.

**Path params:** `scheduleId`

**Sample request**
```json
{
  "startDateTime": "2026-09-12T10:00:00.000Z",
  "endDateTime": "2026-09-12T14:00:00.000Z",
  "meetingLink": "https://meet.google.com/new-room"
}
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Schedule Updated Successfully",
  "data": {
    "id": "0s9f...",
    "startDateTime": "2026-09-12T10:00:00.000Z",
    "endDateTime": "2026-09-12T14:00:00.000Z",
    "meetingLink": "https://meet.google.com/new-room",
    "totalSlots": 12,
    "availableSlots": 12,
    "status": "DRAFT",
    "doctor": { "name": "Dr. John Doe", "email": "johndoe@example.com", "contactNumber": "+8801712345678" }
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `Invalid Start Date Time` | Unparseable `startDateTime` |
| 400 | `Invalid End Date Time` | Unparseable `endDateTime` |
| 400 | `Invalid Meeting Link` | Not a valid URL |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not DOCTOR |
| 404 | `Doctor not found` | No `Doctor` record |
| 404 | `Schedule not found` | Unknown id or soft-deleted |
| 403 | `You are not authorized to update this schedule` | Schedule belongs to another doctor |
| 403 | `Cannot update schedule that has already been published and has booked appointments` | `PUBLISHED` and `totalSlots !== availableSlots` |
| 400 | `Start and end times must be on the same day` | Crosses midnight |
| 400 | `Start time must be before end time` | Inverted range |
| 409 | `Schedule already exists for the given date` | Another schedule on the target day |

> **Known behaviour:** the duplicate-day check runs even when updating a schedule to the same day it already occupies, so re-saving an existing schedule with only `meetingLink` returns 409 `Schedule already exists for the given date`.

---

### 7.6 `PATCH /api/schedule/publish-schedule/:scheduleId`

**Access:** `DOCTOR` · **Body:** none

Flips `DRAFT` → `PUBLISHED`. Only published schedules are bookable by patients.

**Sample request**
```
PATCH /api/schedule/publish-schedule/0s9f...
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Schedule Published Successfully",
  "data": {
    "id": "0s9f...",
    "startDateTime": "2026-09-12T09:00:00.000Z",
    "endDateTime": "2026-09-12T13:00:00.000Z",
    "totalSlots": 12,
    "availableSlots": 12,
    "status": "PUBLISHED"
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not DOCTOR |
| 404 | `Doctor not found` | No `Doctor` record |
| 404 | `Schedule not found` | Unknown id or soft-deleted |
| 403 | `You are not authorized to publish this schedule` | Schedule belongs to another doctor |
| 409 | `Schedule is already published` | `status === PUBLISHED` |

---

### 7.7 `GET /api/schedule/:scheduleId`

**Access:** `DOCTOR` · `ADMIN` · `SUPER_ADMIN`

**Sample request**
```
GET /api/schedule/0s9f2e3d-4c5b-6a79-8e01-2d3c4b5a6978
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Schedule Retrieved Successfully",
  "data": {
    "id": "0s9f...",
    "startDateTime": "2026-09-12T09:00:00.000Z",
    "endDateTime": "2026-09-12T13:00:00.000Z",
    "meetingLink": "https://meet.google.com/abc-defg-hij",
    "totalSlots": 12,
    "availableSlots": 8,
    "status": "PUBLISHED",
    "doctor": {
      "id": "0d1c...",
      "name": "Dr. John Doe",
      "email": "johndoe@example.com",
      "specialization": "Cardiology",
      "contactNumber": "+8801712345678",
      "userId": "0f9a..."
    },
    "appointments": [
      { "id": "0a1b...", "status": "CONFIRMED", "serialNumber": 1, "joiningTime": "2026-09-12T09:00:00.000Z", "patient": { "id": "01H...", "name": "Masad Rayan", "email": "masadrayan2002@gmail.com" } }
    ]
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not allowed |
| 404 | `Schedule not found` | Unknown id or soft-deleted |

---

### 7.8 `DELETE /api/schedule/:scheduleId`

**Access:** `DOCTOR` · **Body:** none

Soft delete (`isDeleted: true`, `deletedAt` set).

**Sample request**
```
DELETE /api/schedule/0s9f2e3d-4c5b-6a79-8e01-2d3c4b5a6978
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Schedule Deleted Successfully",
  "data": {
    "id": "0s9f...",
    "isDeleted": true,
    "deletedAt": "2026-09-27T10:15:00.000Z"
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not DOCTOR |
| 404 | `Doctor not found` | No `Doctor` record |
| 404 | `Schedule not found` | Unknown id or already deleted |
| 403 | `You are not authorized to delete this schedule` | Schedule belongs to another doctor |
| 409 | `Cannot delete schedule that has already been published and has booked appointments` | `PUBLISHED` with `totalSlots !== availableSlots` |

---

## 8. Appointment — `/api/appointment`

Route file: `src/app/module/appointment/appointment.route.ts` · Validation: `appointment.validation.ts` · Service: `appointment.service.ts`

Status flow: `PENDING` → `CONFIRMED` (after payment) → `ONGOING` → `COMPLETED`, plus `CANCELLED`.

### 8.1 `POST /api/appointment/book-appointment`

**Access:** `PATIENT` · **Validation:** `BookAppointmentValidationZodSchema`

Creates a `PENDING` appointment, initiates a bKash tokenized checkout (`mode: 0011`, currency `BDT`), stores a `Payment` row, and returns the redirect URL.

**Sample request**
```json
{
  "scheduleId": "0s9f2e3d-4c5b-6a79-8e01-2d3c4b5a6978"
}
```

**Sample response — 201**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Appointment booked successfully",
  "data": {
    "paymentURL": "https://secure.bkash.com/checkout/tokenized/checkout?token=..."
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `Schedule Id Is Required` | `scheduleId` is `""` |
| 400 | `Invalid input: expected string, received undefined` | `scheduleId` key missing |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not PATIENT |
| 404 | `Patient not found` | Token has no `Patient` record |
| 404 | `Schedule not found` | Unknown id or soft-deleted |
| 400 | `Schedule is not published` | `status !== PUBLISHED` |
| 400 | `Schedule is not for today` | `startDateTime` is on another day |
| 400 | `Schedule is in the past` | `startDateTime` already started |
| 400 | `Schedule is fully booked` | `totalSlots === availableSlots` |
| 400 | `You already have a pending appointment for this schedule` | Duplicate active booking |
| 400 | `You already have a completed appointment for this schedule` | – |
| 400 | `You already have an ongoing appointment for this schedule` | – |
| 400 | `You already have a confirmed appointment for this schedule` | – |
| 400 | `Consultation fee is not set for this doctor` | Doctor `consultationFee` is null |
| 500 | `Failed to get bKash ID token` | bKash token endpoint failed |
| 502 | `Failed to create bKash payment: <bKash message>` | bKash `create` call rejected |
| 400 | `Duplicate Key Error` | Prisma `P2002` on `unique_appointment` |

---

### 8.2 `POST /api/appointment/pay-appointment`

**Access:** `PATIENT` · **Validation:** none (raw body)

Retry payment for a `PENDING` appointment; updates the existing `Payment` row.

**Sample request**
```json
{
  "appointmentId": "0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d"
}
```

**Sample response — 201**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Appointment paid successfully",
  "data": {
    "paymentURL": "https://secure.bkash.com/checkout/tokenized/checkout?token=..."
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `You have provided incorrect field type or missing fields` | `appointmentId` missing → Prisma validation error |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not PATIENT |
| 404 | `Appointment not found` | Unknown id |
| 400 | `Appointment is not pending` | `status !== PENDING` |
| 400 | `Consultation fee not found` | Doctor `consultationFee` is null |
| 500 | `Failed to get bKash ID token` | bKash token endpoint failed |
| 502 | `Failed to create bKash payment: <bKash message>` | bKash `create` call rejected |
| 400 | `An operation failed because it depends on one or more records that were required but not found.` | Prisma `P2025` — no `Payment` row for the appointment |

---

### 8.3 `POST /api/appointment/cancel-appointment`

**Access:** `PATIENT` · **Validation:** none (raw body)

Soft-cancels the appointment, releases the slot (`availableSlots + 1`), and issues a bKash refund **if now is more than 1 hour before `startDateTime`**.

**Sample request**
```json
{
  "appointmentId": "0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d"
}
```

**Sample response — 201**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Appointment cancelled successfully",
  "data": {
    "appointment": { "id": "0a1b...", "status": "CANCELLED" },
    "payment": {
      "id": "0p1a...",
      "status": "REFUNDED",
      "amount": "1500.00",
      "refundTrxId": "TRXREFUND123",
      "refundAmount": "1500.00",
      "refundReason": "Appointment cancelled by user",
      "refundAt": "2026-09-27T10:20:00.000Z"
    }
  }
}
```

If the refund window has passed, `payment.status` stays as-is (no refund fields populated).

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `You have provided incorrect field type or missing fields` | `appointmentId` missing |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not PATIENT |
| 404 | `Appointment not found` | Unknown id **or** the appointment belongs to a different patient email |
| 400 | `Cannot cancel an ongoing or completed appointment` | `status` is `ONGOING` or `COMPLETED` |
| 400 | `Appointment is already cancelled` | `status === CANCELLED` |
| 500 | `Failed to get bKash ID token` | Refund eligible but bKash token failed |

---

### 8.4 `GET /api/appointment/book-appointment/payment/callback`

**Access:** Public (bKash server redirect) · **Validation:** none

Executes the bKash payment, then redirects the browser to the frontend. **No JSON response** — the response is a `302` to the `redirectURL`.

**Query params** (supplied by bKash)

| Param | Example | Notes |
| --- | --- | --- |
| `paymentID` | `TRX123456789` | bKash payment id (required) |
| `status` | `success` | `success` \| `failure` \| `cancel` \| anything else |

**Sample request**
```
GET /api/appointment/book-appointment/payment/callback?paymentID=TRX123456789&status=success
```

**Sample response — 302**
```
Location: http://localhost:3000/dashboard/my-appointments?status=success&paymentID=TRX123456789
```

| `status` | Effect | Redirect query |
| --- | --- | --- |
| `success` | Appointment → `CONFIRMED`, slot decremented, serial + joining time assigned, invoice PDF emailed, `Payment` → `PAID` | `?status=success&paymentID=...` |
| `failure` | `Payment` → `FAILED` | `?status=failure&paymentID=...` |
| `cancel` | `Payment` → `CANCELLED` | `?status=cancel&paymentID=...` |
| other | Nothing persisted | `?error=payment-failed&paymentID=...` |

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `Missing required query parameters` | `paymentID` or `status` absent |
| 500 | `Failed to get bKash ID token` | bKash token endpoint failed |
| 502 | `Failed to execute bKash payment: <bKash message>` | bKash `execute` call rejected |
| 404 | `Appointment not found for the given merchantInvoiceNumber` | Invoice id does not map to an appointment |
| 400 | `An operation failed because it depends on one or more records that were required but not found.` | Prisma `P2025` on payment/appointment update |

---

### 8.5 `PATCH /api/appointment/update-status/:appointmentId`

**Access:** `DOCTOR` · **Validation:** `UpdateAppointmentStatusValidationZodSchema`

Allowed transitions: `CONFIRMED → ONGOING`, `ONGOING → COMPLETED`.

**Sample request**
```json
{
  "status": "ONGOING"
}
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Appointment Status Updated Successfully",
  "data": {
    "id": "0a1b...",
    "status": "ONGOING",
    "serialNumber": 3,
    "joiningTime": "2026-09-12T09:40:00.000Z",
    "prescriptionUrl": null
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `Status Must Be Either ONGOING Or COMPLETED` | `status` not in `ONGOING`/`COMPLETED` |
| 400 | `Invalid input: expected 'ONGOING' \| 'COMPLETED', received ...` | `status` key missing / wrong type |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not DOCTOR |
| 404 | `Doctor not found` | Token has no `Doctor` record |
| 404 | `Appointment not found` | Unknown id |
| 403 | `You are not authorized to update this appointment` | Appointment belongs to another doctor |
| 400 | `Cannot update a completed appointment` | `status === COMPLETED` |
| 400 | `Cannot update a cancelled appointment` | `status === CANCELLED` |
| 400 | `Cannot update a pending appointment` | `status === PENDING` (not paid yet) |
| 400 | `You can only update a confirmed appointment to ongoing` | `CONFIRMED` + `status: "COMPLETED"` |
| 400 | `You can only update an ongoing appointment to completed` | `ONGOING` + `status: "ONGOING"` |

---

### 8.6 `GET /api/appointment/my-appointments`

**Access:** `PATIENT`

**Query params:** `status` (`PENDING`/`CONFIRMED`/`ONGOING`/`COMPLETED`/`CANCELLED`), `page`, `limit`, `sortBy`, `sortOrder`

**Sample request**
```
GET /api/appointment/my-appointments?status=CONFIRMED&page=1&limit=10&sortBy=createdAt&sortOrder=desc
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Appointments Retrieved Successfully",
  "data": [
    {
      "id": "0a1b...",
      "status": "CONFIRMED",
      "serialNumber": 3,
      "joiningTime": "2026-09-12T09:40:00.000Z",
      "doctor": { "id": "0d1c...", "name": "Dr. John Doe", "specialization": "Cardiology" },
      "schedule": { "id": "0s9f...", "startDateTime": "2026-09-12T09:00:00.000Z", "endDateTime": "2026-09-12T13:00:00.000Z", "meetingLink": "https://meet.google.com/abc-defg-hij" },
      "payment": { "id": "0p1a...", "status": "PAID", "amount": "1500.00", "currency": "BDT" }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not PATIENT |
| 404 | `Patient not found` | Token has no `Patient` record |
| 400 | `An operation failed because it depends on one or more records that were required but not found.` | Invalid `sortBy` column |

---

### 8.7 `GET /api/appointment/doctor-appointments`

**Access:** `DOCTOR`

**Query params:** `status`, `page`, `limit`, `sortBy`, `sortOrder`

**Sample request**
```
GET /api/appointment/doctor-appointments?status=CONFIRMED&page=1&limit=10
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Appointments Retrieved Successfully",
  "data": [
    {
      "id": "0a1b...",
      "status": "CONFIRMED",
      "serialNumber": 3,
      "joiningTime": "2026-09-12T09:40:00.000Z",
      "patient": { "id": "01H...", "name": "Masad Rayan", "email": "masadrayan2002@gmail.com", "contactNumber": "+8801712345678" },
      "schedule": { "id": "0s9f...", "startDateTime": "2026-09-12T09:00:00.000Z", "meetingLink": "https://meet.google.com/abc-defg-hij" },
      "payment": { "id": "0p1a...", "status": "PAID", "amount": "1500.00" }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not DOCTOR |
| 404 | `Doctor Profile Not Found` | Token has no `Doctor` record |
| 400 | `An operation failed because it depends on one or more records that were required but not found.` | Invalid `sortBy` column |

---

### 8.8 `GET /api/appointment/all-appointments`

**Access:** `ADMIN` · `SUPER_ADMIN`

**Query params:** `status`, `doctorId`, `patientId`, `doctorEmail`, `patientEmail`, `page`, `limit`, `sortBy`, `sortOrder`

**Sample request**
```
GET /api/appointment/all-appointments?status=COMPLETED&doctorId=0d1c...&patientId=01H...&doctorEmail=johndoe@example.com&patientEmail=patient@example.com&page=1&limit=10
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Appointments Retrieved Successfully",
  "data": [
    {
      "id": "0a1b...",
      "status": "COMPLETED",
      "serialNumber": 3,
      "joiningTime": "2026-09-12T09:40:00.000Z",
      "patient": { "id": "01H...", "name": "Masad Rayan", "email": "patient@example.com" },
      "doctor": { "id": "0d1c...", "name": "Dr. John Doe", "specialization": "Cardiology" },
      "schedule": { "id": "0s9f...", "startDateTime": "2026-09-12T09:00:00.000Z" },
      "payment": { "id": "0p1a...", "status": "PAID", "amount": "1500.00" }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not ADMIN/SUPER_ADMIN |
| 400 | `An operation failed because it depends on one or more records that were required but not found.` | Invalid `sortBy` column |

---

### 8.9 `GET /api/appointment/:appointmentId`

**Access:** `PATIENT` · `DOCTOR` · `ADMIN` · `SUPER_ADMIN`

A `PATIENT` may only view their own appointments; a `DOCTOR` only their own.

**Sample request**
```
GET /api/appointment/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Appointment Retrieved Successfully",
  "data": {
    "id": "0a1b...",
    "status": "COMPLETED",
    "serialNumber": 3,
    "joiningTime": "2026-09-12T09:40:00.000Z",
    "prescriptionUrl": "https://res.cloudinary.com/.../prescription.pdf",
    "patient": { "id": "01H...", "name": "Masad Rayan", "email": "patient@example.com", "userId": "0f9a..." },
    "doctor": { "id": "0d1c...", "name": "Dr. John Doe", "specialization": "Cardiology", "userId": "1b2c..." },
    "schedule": { "id": "0s9f...", "startDateTime": "2026-09-12T09:00:00.000Z", "meetingLink": "https://meet.google.com/abc-defg-hij" },
    "payment": { "id": "0p1a...", "status": "PAID", "amount": "1500.00" }
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not allowed |
| 404 | `Appointment Not Found` | Unknown id |
| 403 | `You are not authorized to view this appointment` | Patient/doctor is not the owner |

---

## 9. Payment — `/api/payment`

Route file: `src/app/module/payment/payment.route.ts` · Service: `payment.service.ts`

### 9.1 `GET /api/payment/my-payments`

**Access:** `PATIENT`

**Query params:** `page`, `limit`, `sortBy`, `sortOrder`

**Sample request**
```
GET /api/payment/my-payments?page=1&limit=10
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Payments Retrieved Successfully",
  "data": [
    {
      "id": "0p1a...",
      "status": "PAID",
      "amount": "1500.00",
      "currency": "BDT",
      "paymentGateway": "Bkash",
      "merchantInvoiceNumber": "INV-1730000000",
      "bkashPaymentId": "TRX123456789",
      "bkashTrxId": "TRXEXEC987654",
      "payerReference": "patient@example.com",
      "paidAt": "2026-09-12T08:55:00.000+06:00",
      "refundTrxId": null,
      "refundAmount": null,
      "appointment": {
        "id": "0a1b...",
        "status": "CONFIRMED",
        "doctor": { "id": "0d1c...", "name": "Dr. John Doe", "email": "johndoe@example.com", "specialization": "Cardiology" },
        "schedule": { "id": "0s9f...", "startDateTime": "2026-09-12T09:00:00.000Z" }
      }
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not PATIENT |
| 404 | `Patient not found` | Token has no `Patient` record |
| 400 | `An operation failed because it depends on one or more records that were required but not found.` | Invalid `sortBy` column |

---

### 9.2 `GET /api/payment/all-payments`

**Access:** `ADMIN` · `SUPER_ADMIN`

**Query params:** `patientEmail` (note: implemented against `query.email` — send `email`), `page`, `limit`, `sortBy`, `sortOrder`

**Sample request**
```
GET /api/payment/all-payments?patientEmail=patient@example.com&page=1&limit=10
```

**Sample response — 200** — same shape as [9.1](#91-get-apipaymentmy-payments).

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not ADMIN/SUPER_ADMIN |
| 400 | `An operation failed because it depends on one or more records that were required but not found.` | Invalid `sortBy` column |

---

### 9.3 `GET /api/payment/:paymentId`

**Access:** `PATIENT` · `ADMIN` · `SUPER_ADMIN`

A `PATIENT` may only view their own payments.

**Sample request**
```
GET /api/payment/0p1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8
```

**Sample response — 200** — single payment object, same shape as one element of [9.1](#91-get-apipaymentmy-payments).

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not allowed |
| 404 | `Payment Not Found` | Unknown id |
| 403 | `You Are Not Allowed To View This Payment` | Patient is not the payer |

---

## 10. Prescription — `/api/prescription`

Route file: `src/app/module/prescription/prescription.route.ts` · Validation: `prescription.validation.ts` · Service: `prescription.service.ts`

### 10.1 `POST /api/prescription/create-prescription`

**Access:** `DOCTOR` · **Validation:** `CreatePrescriptionValidationZodSchema`

Generates a PDF, uploads it to Cloudinary, stores the URL on the appointment, and emails it to the patient. Only allowed for **COMPLETED** appointments and only once.

**Sample request**
```json
{
  "appointmentId": "0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
  "findings": "Patient shows mild hypertension and elevated cholesterol. Advised lifestyle modifications.",
  "medicines": [
    {
      "name": "Amlodipine",
      "dosage": "5mg once daily",
      "duration": "30 days",
      "instructions": "Take after breakfast"
    },
    {
      "name": "Atorvastatin",
      "dosage": "10mg once daily",
      "duration": "30 days",
      "instructions": "Take at night"
    }
  ]
}
```

**Sample response — 201**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Prescription Created And Emailed To Patient Successfully",
  "data": {
    "id": "0a1b...",
    "status": "COMPLETED",
    "prescriptionUrl": "https://res.cloudinary.com/medicare/raw/upload/v1730000000/prescription/abc.pdf",
    "prescriptionPublicId": "prescription/abc"
  }
}
```

**Validation messages**

| Field | Message |
| --- | --- |
| `appointmentId` | `Appointment Id Is Required` / `Invalid input: expected string, received undefined` |
| `findings` | `Findings Must Be At Least 5 Characters Long` |
| `medicines` | `At Least One Medicine Is Required` |
| `medicines[].name` | `Medicine Name Is Required` |
| `medicines[].dosage` | `Dosage Is Required` |
| `medicines[].duration` | `Duration Is Required` |
| `medicines[].instructions` | optional |

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | *(any validation message above)* | Body failed Zod |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not DOCTOR |
| 404 | `Doctor not found` | Token has no `Doctor` record |
| 404 | `Appointment not found` | Unknown `appointmentId` |
| 403 | `You are not authorized to create prescription for this appointment` | Appointment belongs to another doctor |
| 400 | `Prescription can only be created for completed appointments` | `status !== COMPLETED` |
| 400 | `Prescription already exists for this appointment` | `prescriptionUrl` already set |
| 500 | `No Result Returned From Cloudinary` | Cloudinary returned no result |
| 500 | `Internal Server Error` | Cloudinary / SMTP failure |

---

### 10.2 `GET /api/prescription/:appointmentId`

**Access:** `PATIENT` · `DOCTOR` · `ADMIN` · `SUPER_ADMIN`

Ownership is enforced for `PATIENT` (must own the appointment) and `DOCTOR` (must be the treating doctor).

**Sample request**
```
GET /api/prescription/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d
```

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Prescription Retrieved Successfully",
  "data": {
    "appointment": {
      "id": "0a1b...",
      "status": "COMPLETED",
      "doctor": { "id": "0d1c...", "name": "Dr. John Doe", "specialization": "Cardiology" },
      "patient": { "id": "01H...", "name": "Masad Rayan", "email": "patient@example.com" }
    },
    "prescription": "https://res.cloudinary.com/medicare/raw/upload/v1730000000/prescription/abc.pdf"
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not allowed |
| 404 | `Appointment not found` | Unknown id |
| 403 | `You Are Not Allowed To View This Appointment` | Patient/doctor is not the owner |
| 404 | `No Prescription Has Been Written Yet` | `prescriptionUrl` is null |

---

## 11. Analytics — `/api/analytics`

Route file: `src/app/module/analytics/analytics.route.ts` · Service: `analytics.service.ts`

### 11.1 `GET /api/analytics/patient-analytics`

**Access:** `PATIENT` · **Body:** none

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Patient Analytics Retrieved Successfully",
  "data": {
    "totalAppointments": 5,
    "upcomingAppointments": 2,
    "completedAppointments": 2,
    "cancelledAppointments": 1,
    "totalAmountSpent": 6000,
    "totalRefunded": 1500
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not PATIENT |
| 404 | `Patient not found` | Token has no `Patient` record |

---

### 11.2 `GET /api/analytics/doctor-analytics`

**Access:** `DOCTOR` · **Body:** none

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Doctor Analytics Retrieved Successfully",
  "data": {
    "totalSchedules": 12,
    "publishedSchedules": 10,
    "totalAppointments": 40,
    "upcomingAppointments": 8,
    "ongoingAppointments": 1,
    "completedAppointments": 28,
    "cancelledAppointments": 3,
    "totalDoctorEarnings": 42000,
    "totalDoctorRefunded": 3000
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not DOCTOR |
| 404 | `Doctor not found` | Token has no `Doctor` record |

---

### 11.3 `GET /api/analytics/admin-analytics`

**Access:** `ADMIN` · `SUPER_ADMIN` · **Body:** none

**Sample response — 200**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Admin Analytics Retrieved Successfully",
  "data": {
    "totalDoctors": 25,
    "totalPendingDoctorApplication": 4,
    "totalapprovedDoctors": 18,
    "totalRejectedDoctors": 3,
    "totalPatients": 310,
    "totalAppointments": 890,
    "totalcompletedAppointments": 640,
    "totalcancelledAppointments": 90,
    "totalpendingAppointments": 20,
    "totalRefund": 45000,
    "totalRevenue": 1335000
  }
}
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 401 | `You are not logged in. Please log in to access this resource.` | No token |
| 403 | `Forbidden. You don't have permission to access this resource.` | Role not ADMIN/SUPER_ADMIN |
| 403 | `Your account has been blocked. Please contact support.` | Blocked admin |
| 401 | `Authentication failed against database server. Please Check Your Credentials` | Prisma `P1000` |
| 400 | `Can't reach database server` | Prisma `P1001` |

---

## 12. Global Error Reference

Produced by `src/app/middleware/globalErrorHandler.ts`. All bodies have this shape (dev-only extras in parentheses):

```json
{
  "success": false,
  "statusCode": 400,
  "name": "AppError",
  "message": "<message>",
  "error": {},   // dev only
  "stack": "..."  // dev only
}
```

| Trigger | Status | Message |
| --- | --- | --- |
| Zod validation (`validateRequest`, controllers, services) | 400 | First Zod issue message |
| `AppError` | `err.statusCode` | `err.message` |
| `PrismaClientValidationError` | 400 | `You have provided incorrect field type or missing fields` |
| Prisma `P2002` | 400 | `Duplicate Key Error` |
| Prisma `P2003` | 400 | `Foreign key constraint failed` |
| Prisma `P2025` | 400 | `An operation failed because it depends on one or more records that were required but not found.` |
| Prisma `P1000` | 401 | `Authentication failed against database server. Please Check Your Credentials` |
| Prisma `P1001` | 400 | `Can't reach database server` |
| `PrismaClientUnknownRequestError` | 500 | `Error occurred during query execution` |
| Any other `Error` | 500 | `err.message` |
| Unknown route (after `globalErrorHandler`) | 404 | `Route not found` (different shape — see [1](#1-base-info--conventions)) |

### Quick status code cheat-sheet

| Status | Common meaning in this API |
| --- | --- |
| 200 | Successful read / update |
| 201 | Successful create (register, book, upload, schedule, prescription) |
| 302 | bKash payment callback redirect to frontend |
| 400 | Zod validation, business-rule violation, Prisma P2002/P2003/P2025 |
| 401 | Missing / invalid / expired token, missing refresh cookie |
| 403 | Wrong role, blocked account, ownership check failed |
| 404 | Resource not found, deleted, or already applied |
| 409 | Conflict — duplicate resource (email, schedule per day, already published/cancelled) |
| 502 | bKash gateway rejected the request |
| 500 | Unexpected server error (masked in production) |
