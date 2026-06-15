# Feature Reference — Registration & Account Approval

> **Status:** Implemented (Phase 1, slices 1 & 2 · `P0-F001` + user side of `P0-F002`)
> **Related:** [`DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md) · Swagger UI at `http://localhost:4000/api/v1/docs`

This document is the single reference for how a person goes from "I want an account"
to "I can use the app", and how a super-admin manages that. It records **what we built,
why, and where the code lives**.

---

## 1. User story

> **As a** tester/engineer, **I want to** register for KmmRepo, **so that** I can access
> the test repository — but only after a super-admin has approved me, so access stays
> controlled and no account is active without review.
>
> **As a** super-admin, **I want to** review registrations and manage accounts (approve,
> reject, deactivate, delete, restore), **so that** only authorized people have access and
> I can revoke it at any time.

---

## 2. The flow (end-to-end)

```
                 ┌─────────────┐
  Register  ───▶ │   PENDING   │  (cannot log in)
                 └──────┬──────┘
                        │ super-admin reviews on the Admin page
          ┌─────────────┼──────────────┐
       Approve        Reject         (later)
          │             │
          ▼             ▼
     ┌─────────┐   ┌──────────┐
     │ ACTIVE  │   │ DISABLED │  ◀── Deactivate an ACTIVE user
     └────┬────┘   └────┬─────┘
          │             │ Activate
   can log in    cannot log in
          │
          │  Delete (soft) ──▶ isDeleted=true (hidden, recoverable)
          │                          │ Restore
          └──────────────◀───────────┘
```

**Status model:** `PENDING → ACTIVE → DISABLED` (reversible between ACTIVE/DISABLED).
**Soft delete** is an orthogonal flag (`isDeleted`), never a hard row delete.

### Rules
- Registration always creates a `PENDING` user with `globalRole = USER`. No token is issued.
- **Only `ACTIVE` users can log in.** `PENDING` → 403 "awaiting approval"; `DISABLED` → 403 "disabled".
- **Approve** sets `ACTIVE` + `USER`. Promotion to `SUPER_ADMIN` is manual/out of scope here.
- **Reject** and **Set Not Active** both set `DISABLED` (one shared state).
- **Disabling or deleting** a user revokes all their refresh tokens, so they cannot renew
  a session (their current access token still works until it expires, ≤ 15 min).
- **Super-admin accounts are protected:** no admin can change the status/role, delete, or
  reject any `SUPER_ADMIN` (covers the system-seeded admin and self) → 403.

---

## 3. Data model

`User` (`backend/prisma/schema.prisma`, table `users`):

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `name`, `email` | `String` | `email` unique, stored lowercased |
| `passwordHash` | `String` | argon2; never logged or returned |
| `status` | `UserStatus` | `PENDING` \| `ACTIVE` \| `DISABLED` (default `PENDING`) |
| `globalRole` | `GlobalRole` | `SUPER_ADMIN` \| `USER` (default `USER`) |
| `isDeleted`, `deletedAt`, `deletedBy` | soft delete | recoverable; set by admin delete |
| `createdAt`, `updatedAt` | timestamps | |

Migrations: `init_user`, then `user_soft_delete`.
First super-admin is created by the seed (`backend/prisma/seed.ts`, run via `npm run seed`).

---

## 4. API reference

Base path `/api/v1`. Errors use `{ "error": { code, message, fields? } }`.
Full, interactive contract: **Swagger UI** `/api/v1/docs` (raw: `/api/v1/openapi.json`).

### Auth (public)
| Method | Path | Purpose | Key responses |
|---|---|---|---|
| POST | `/auth/register` | Create a `PENDING` account | `201` user; `400` validation; `409` duplicate email |
| POST | `/auth/login` | Log in (ACTIVE only) | `200` accessToken + refresh cookie; `401` bad creds; `403` PENDING/DISABLED |
| POST | `/auth/refresh` | Rotate refresh → new access token | `200`; `401` missing/invalid/rotated |
| POST | `/auth/logout` | Revoke refresh token | `200` |

### Admin (require `Authorization: Bearer <token>` **and** `SUPER_ADMIN`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/users?status=&deleted=` | List/filter users |
| PATCH | `/admin/users/:id` | `{ status: "ACTIVE" \| "DISABLED" }` → approve/reject/activate/deactivate |
| DELETE | `/admin/users/:id` | Soft-delete |
| POST | `/admin/users/:id/restore` | Restore a soft-deleted user |

Admin routes return `401` (no/invalid token), `403` (not super-admin, or protected target),
`404` (missing user), `400` (bad status value).

---

## 5. Token & session design

- **Access token** — JWT, ~15 min, payload `{ sub, role, status }`, sent as
  `Authorization: Bearer`. Held in memory on the client (never localStorage).
- **Refresh token** — JWT, ~7 days, carries a `jti`. Delivered as an **httpOnly, secure,
  sameSite cookie** scoped to `/api/v1/auth`.
- **Rotation** — each `/auth/refresh` validates the `jti` against Redis
  (`refresh:<userId>:<jti>`), revokes it, and issues a new pair. Reusing a rotated token → 401.
- **Bulk revoke** — disabling/deleting a user clears `refresh:<userId>:*`.

---

## 6. Code map

### Backend (`backend/src`)
| Area | Files |
|---|---|
| Auth endpoints | `routes/auth.ts`, `controllers/auth.controller.ts`, `services/auth.service.ts`, `routes/auth.schemas.ts` |
| Admin endpoints | `routes/admin.ts`, `controllers/admin.controller.ts`, `services/admin.service.ts`, `routes/admin.schemas.ts` |
| Auth libs | `lib/jwt.ts`, `lib/password.ts` (argon2), `lib/refreshTokenStore.ts` (Redis rotation + bulk revoke) |
| Middleware | `middleware/requireAuth.ts`, `middleware/requireSuperAdmin.ts`, `middleware/validate.ts`, `middleware/errorHandler.ts` |
| Cross-cutting | `lib/errors.ts` (ApiError), `lib/audit.ts`, `lib/asyncHandler.ts`, `docs/openapi.ts` |
| Wiring | `app.ts`, `routes/index.ts` (`/admin` mounted behind `requireAuth` + `requireSuperAdmin`) |
| Tests | `__tests__/auth.test.ts` (8), `__tests__/admin.test.ts` (10) |

### Frontend (`frontend/src`)
| Area | Files |
|---|---|
| API client | `api/client.ts` (axios + single-flight refresh interceptor), `api/auth.ts`, `api/admin.ts`, `api/token.ts` |
| Auth state | `features/auth/AuthContext.tsx` (login/logout, session bootstrap via refresh) |
| Guards | `components/ProtectedRoute.tsx` (logged-in), `components/AdminRoute.tsx` (SUPER_ADMIN) |
| Pages / shell | `pages/Login.tsx`, `pages/Register.tsx`, `pages/Admin.tsx`, `pages/Dashboard.tsx`, `components/AppLayout.tsx` |
| Routing | `App.tsx` (`/login`, `/register` public; `/` + `/admin` protected) |

---

## 7. Edge cases handled

| Condition | Behavior | Feedback |
|---|---|---|
| Empty/invalid register fields | Block (400) | Inline field errors (client + server) |
| Duplicate email | Reject (409) | "An account with this email already exists" |
| Login while PENDING | Reject (403) | "awaiting administrator approval" |
| Login while DISABLED | Reject (403) | "Your account has been disabled" |
| Access token expired | Silent refresh + retry (interceptor) | Transparent; logout if refresh fails |
| Non-admin hits `/admin/*` | Reject (403) | — |
| Non-admin opens `/admin` page | Redirect to `/` | — |
| Action on a super-admin | Reject (403) | UI shows a "Protected" chip, no action buttons |
| Empty list in a tab | Empty state | "No users in this view." |
| Any admin action fails | — | Error snackbar with the API message |

---

## 8. How to verify

```bash
docker compose up -d                       # Postgres + Redis
cd backend && npm install && npx prisma migrate dev && npm run seed && npm run dev
cd frontend && npm install && npm run dev  # http://localhost:5173
```

1. **Register** a user → "awaiting approval"; DB row is `PENDING`.
2. Log in as the seeded super-admin (`admin@kmmrepo.local` / `ChangeMe!123`) → **Admin** link appears.
3. On **/admin**: **Approve** the user → they can log in. **Reject** another → login blocked.
4. **Set Not Active** / **Activate** toggles login access; **Delete** moves them to the
   **Deleted** tab; **Restore** brings them back.
5. The seeded super-admin row shows **Protected** — no destructive actions.
6. Automated: `cd backend && npm test` (18 tests) and `npm run typecheck`; `cd frontend && npm run build`.

---

## 9. Deferred / out of scope

- Per-project roles (`TEST_LEAD`, `AUTOMATION_TESTER`, …) and project-access assignment
  (needs Projects — `P0-F003`).
- Promoting a user to `SUPER_ADMIN` from the UI.
- "Change password on first login" for the seeded admin.
- Persisted `AuditLog` table (currently structured-log only, via `lib/audit.ts`).
