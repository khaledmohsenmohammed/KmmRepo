# KmmRepo — Development Guide

> Companion to `docs/PRD.md`. This guide turns the PRD into an actionable build plan: how to set up the project, how it is structured, what to build in what order, and the conventions every contributor follows.

- **Project:** KmmRepo — self-hosted, role-based test repository management
- **Owner:** khaled mohsen
- **Stack:** React 18 + TypeScript + MUI · Node.js + Express + TypeScript + Prisma · PostgreSQL + Redis
- **Hosting:** Self-hosted via Docker inside the company environment (no data leaves it)

---

## 1. Core Principles

These are non-negotiable and apply to every line of code.

1. **Self-hosted only.** No test data, attachment, or AI request ever leaves the company environment. AI assistance routes through the company-hosted gateway exclusively.
2. **Server-side authorization.** Every endpoint enforces global role (`SUPER_ADMIN` / `USER`) plus per-project membership role. Never trust the client.
3. **Soft delete, never hard delete.** Deletions only set flags. Only a super admin restores.
4. **Audit everything.** Create, update, delete, restore, and move actions write an `AuditLog` entry.
5. **Consistent UX.** Every form validates inline, every async action shows a loading state, every error is shown inline, every save confirms success.

---

## 2. Prerequisites

- Node.js 20 LTS
- Docker + Docker Compose
- PostgreSQL 15+ and Redis 7+ (provided via Docker Compose)
- pnpm or npm

---

## 3. Local Setup

```bash
# 1. Clone
git clone <repo-url> kmmrepo && cd kmmrepo

# 2. Environment
cp .env.example .env        # fill in secrets (see section 5)

# 3. Start infra (Postgres + Redis + storage)
docker compose up -d

# 4. Backend
cd backend
npm install
npx prisma migrate dev      # apply schema
npm run seed                # seeds first super-admin account
npm run dev                 # http://localhost:4000/api/v1

# 5. Frontend
cd ../frontend
npm install
npm run dev                 # http://localhost:5173
```

First super-admin credentials are created by the seed script — change the password on first login.

---

## 4. Suggested Project Structure

```
kmmrepo/
├─ docs/
│  ├─ PRD.md
│  └─ DEVELOPMENT_GUIDE.md
├─ docker-compose.yml
├─ backend/
│  ├─ prisma/
│  │  └─ schema.prisma
│  └─ src/
│     ├─ routes/            # /api/v1 route definitions
│     ├─ controllers/       # request/response handling
│     ├─ services/          # business logic
│     ├─ repositories/      # Prisma data access
│     ├─ middleware/        # auth, role guards, validation, error handler
│     ├─ lib/               # ai-gateway, storage, audit, jwt
│     ├─ docs/              # openapi.ts — OpenAPI 3 spec served via Swagger UI
│     └─ index.ts
└─ frontend/
   └─ src/
      ├─ pages/             # Projects, Project, Profile, Admin, Recycle
      ├─ components/        # MUI components, folder tree, case editor
      ├─ features/          # auth, projects, testcases, bugs, export
      ├─ theme/             # MUI dark/light theme tokens
      ├─ hooks/
      └─ api/               # typed API client
```

---

## 5. Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` | Access-token signing secret |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret |
| `STORAGE_PATH` / `STORAGE_ENDPOINT` | Local volume or self-hosted object storage for images/avatars |
| `AI_GATEWAY_URL` | Company-hosted AI endpoint (in-environment only) |
| `SEED_SUPERADMIN_EMAIL` | First super-admin email for the seed script |

Never commit a real `.env`. Keep `.env.example` with placeholders only.

---

## 6. Build Order (by Phase)

Build in this order — each phase ends with a validation gate that must pass before moving on.

### Phase 1 — Foundation & Repository (~2 weeks)
- [x] Scaffold backend (Express + Prisma + Postgres/Redis) and frontend (React + MUI) in Docker
- [x] Registration + login + JWT refresh rotation (`P0-F001`)
- [~] Super-admin console: approve users + activate/deactivate/soft-delete/restore (`P0-F002`) — _user approval & management done; per-project role + project-access assignment deferred until Projects (`P0-F003`) exist_
- [ ] Projects + nested folders + tree view (`P0-F003`)
- [ ] Audit logging + created/edited metadata (`P0-F008`)
- [ ] Responsive MUI shell + persisted dark/light toggle (`P0-F009`)
- **Gate:** A super admin approves a user, assigns a project, and that user sees only their project's empty folder tree.

### Phase 2 — Profiles & Project Access (~1.5 weeks)
- [ ] Profile page: avatar upload, edit name/bio, view role (`P1-F004`)
- [ ] Projects page lists only accessible projects with their repositories
- [ ] Role display wired into navigation and guards
- **Gate:** A logged-in user edits their profile and sees exactly the projects assigned to them.

### Phase 3 — Repository Management (~2 weeks)
- [ ] Test-case CRUD: title (required), description, steps, expected, type (`P0-F004`)
- [ ] Move cases between folders (`P0-F004`)
- [ ] Soft delete + super-admin restore (`P0-F007`)
- [ ] Search + duplicate-check + navigate-to-existing (`P1-F001`)
- **Gate:** A tester creates, edits, moves, and soft-deletes a case; a super admin restores it.

### Phase 4 — Status & Bug Generation (~2 weeks)
- [ ] Status tracking: Passed / Failed / Hold / In Progress + execution history (`P0-F005`)
- [ ] Bug form on failure: environment, account, image (`P0-F006`)
- [ ] Auto-title prefixed with `[FE]` / `[BE]` / `[MO]` (`P0-F006`)
- **Gate:** Failing a case opens the bug form and produces a tagged bug report linked to the execution.

### Phase 5 — Export, Import & AI/Playwright (~2 weeks)
- [ ] JSON/Excel export of selected cases or folders (`P1-F005`)
- [ ] Folder upload/import with validation preview (`P1-F006`)
- [ ] AI-assisted drafting & bug description via company gateway (`P1-F002`)
- [ ] Playwright reference linkage for automation cases (`P1-F003`)
- **Gate:** A user exports a folder, imports a folder, AI-drafts a case, and links a Playwright reference.

---

## 7. Data Model Reference

```
User              : id, name, email, password_hash, bio, avatar_url,
                    status(PENDING|ACTIVE|DISABLED), global_role(SUPER_ADMIN|USER),
                    created_at, updated_at
ProjectMembership : id, user_id, project_id, role, granted_by, granted_at
Project           : id, name, description, created_by, created_at, updated_at
Folder            : id, project_id, parent_folder_id?, name, created_by,
                    created_at, updated_by, updated_at,
                    is_deleted, deleted_at, deleted_by
TestCase          : id, project_id, folder_id, title, description,
                    type(MANUAL|AUTOMATION), playwright_ref?,
                    created_by, created_at, updated_by, updated_at,
                    is_deleted, deleted_at, deleted_by
TestStep          : id, test_case_id, order, action, expected
TestExecution     : id, test_case_id, status(PASSED|FAILED|HOLD|IN_PROGRESS),
                    environment, executed_by, executed_at, notes
BugReport         : id, test_execution_id, test_case_id, platform_tag(FE|BE|MO),
                    title(auto), description, environment, account, image_url,
                    status, created_by, created_at
AuditLog          : id, entity_type, entity_id,
                    action(CREATE|UPDATE|DELETE|RESTORE|MOVE),
                    performed_by, performed_at, changes(JSON)
```

**Per-project roles:** `TEST_LEAD`, `AUTOMATION_TESTER`, `MANUAL_TESTER`, `PENTESTER`, `PROJECT_LEAD`.

---

## 8. API Conventions

- Base path: `/api/v1/`, REST resources, plural nouns.
- Methods: `GET` (read), `POST` (create), `PUT` (replace), `PATCH` (partial), `DELETE` (soft delete).
- Auth: `Authorization: Bearer <accessToken>`; refresh via `POST /api/v1/auth/refresh`.
- Errors: consistent JSON `{ "error": { "code": string, "message": string, "fields"?: object } }`.
- Status codes: `400` validation, `401` unauthenticated, `403` unauthorized, `404` not found, `409` conflict/duplicate.
- **Documented:** every endpoint is described in the OpenAPI spec and browsable via Swagger UI (see §8.1). Add a `paths` entry whenever you add or change an endpoint.

Key endpoints (full list in PRD §9):

```
POST   /api/v1/auth/register | login | refresh | logout
GET    /api/v1/admin/users?status=PENDING
PATCH  /api/v1/admin/users/:id
POST   /api/v1/admin/test-cases/:id/restore
POST   /api/v1/projects/:projectId/folders
POST   /api/v1/folders/:folderId/test-cases
POST   /api/v1/test-cases/:id/move
POST   /api/v1/test-cases/:id/executions
POST   /api/v1/executions/:id/bug
POST   /api/v1/export
POST   /api/v1/folders/import
```

### 8.1 API Documentation (Swagger / OpenAPI)

The API is documented with **OpenAPI 3** and served through **Swagger UI**, so the
contract is always browsable and testable from the running backend.

| URL | What it is |
|---|---|
| `http://localhost:4000/api/v1/docs` | Interactive Swagger UI — read endpoints, see request/response schemas, and "Try it out". |
| `http://localhost:4000/api/v1/openapi.json` | Raw OpenAPI 3 document (for client generation, Postman/Insomnia import, CI checks). |

**Where it lives:** the spec is a typed object in `backend/src/docs/openapi.ts` and is
mounted in `backend/src/app.ts` via `swagger-ui-express`. It is defined as a plain
object (not scanned from JSDoc globs) so it is type-checked and behaves identically
under `tsx` (dev) and compiled `dist` (prod).

**Keeping it accurate (part of Definition of Done):**

- When you add or change an endpoint, add/update its entry under `paths` and any shared
  shapes under `components.schemas` in `openapi.ts`.
- Reuse `$ref: '#/components/schemas/...'` for shared shapes (e.g. `ErrorResponse`,
  `AuthUser`) instead of redefining them inline.
- Endpoints that require auth must list `security: [{ bearerAuth: [] }]`; public ones
  (register, login, refresh, logout, health) set `security: []`.

> Note: `try it out` for `/auth/refresh` and `/auth/logout` relies on the httpOnly
> `refreshToken` cookie set by `/auth/login`, so log in first in the same browser.

---

## 9. Bug Title Rule

When an execution is set to **Failed**, the bug title is generated automatically and prefixed by platform tag:

```
[FE] <test case title> failed on <environment>   # Frontend
[BE] <test case title> failed on <environment>   # Backend
[MO] <test case title> failed on <environment>   # Mobile
```

The bug report must capture: platform tag, environment, account, attached image, and a description (manual or AI-drafted). It is linked to both the execution and the test case.

---

## 10. Coding Conventions

- **Language:** TypeScript everywhere; `strict` mode on.
- **Validation:** Validate all inputs server-side (e.g., zod) and mirror inline on the client.
- **Branching:** `NNN-feature-name` (e.g., `004-soft-delete-restore`).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).
- **State/data fetching (frontend):** React Query; keep server state out of local component state.
- **Theming:** Use MUI theme tokens only — no hardcoded colors — so dark/light works everywhere.
- **Large lists:** Paginate/virtualize the folder tree and case lists (target 5,000+ cases).

---

## 11. Edge Cases to Handle (Condition → Behavior → Feedback)

- Empty title → block save → inline field error.
- Empty folder → render empty view → "Create test case" CTA.
- Network/API failure → retry with backoff → toast "Action failed, retry".
- No project access → reject `403` → "You don't have access".
- Duplicate folder name / similar case title → reject or warn → inline message with link to existing.
- Restore into a missing folder → restore to project root → notice shown.
- AI gateway down → disable AI assist → "AI unavailable, enter manually".

---

## 12. Definition of Done (per feature)

- [ ] Endpoint(s) implemented with server-side validation and role guard
- [ ] OpenAPI spec updated (`backend/src/docs/openapi.ts`) and visible in Swagger UI
- [ ] Soft-delete and audit behavior applied where relevant
- [ ] Frontend: loading, error, empty, and success states all handled
- [ ] Responsive on mobile/tablet/desktop in both themes
- [ ] Acceptance criteria from PRD §7 verified
- [ ] Tests written (unit + key integration paths)
- [ ] No data leaves the company environment

---

## 13. Testing & Quality

- **Backend:** unit tests on services + integration tests on critical endpoints (auth, CRUD, soft delete/restore, bug generation).
- **Frontend:** component tests for the case editor, folder tree, and bug form.
- **Performance targets:** page load < 2s, API p95 < 500ms, error rate < 0.1%.
- **Logging:** structured JSON; alert when error rate > 1%.

---

## 14. Security Checklist

- [ ] Passwords hashed (argon2/bcrypt), never logged
- [ ] JWT access + rotating refresh tokens
- [ ] Role + project authorization enforced on every endpoint
- [ ] All inputs validated and sanitized
- [ ] AES-256 at rest, TLS 1.3 in transit
- [ ] Daily backups, 30-day retention
- [ ] All services and data confined to the company environment

---

_For full requirements, acceptance criteria, personas, risks, and metrics, see `docs/PRD.md`._
