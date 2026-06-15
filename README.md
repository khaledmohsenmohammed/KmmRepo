# KmmRepo

Self-hosted, role-based **test repository management**.

- **Frontend:** React 18 + TypeScript + MUI
- **Backend:** Node.js + Express + TypeScript + Prisma
- **Data:** PostgreSQL + Redis
- **Hosting:** Self-hosted via Docker (no data leaves the company environment)

See [`docs/DEVELOPMENT_GUIDE.md`](docs/DEVELOPMENT_GUIDE.md) for the full build plan and conventions.

## Quick start

```bash
# 1. Environment
cp .env.example .env        # fill in secrets

# 2. Infra (Postgres + Redis)
docker compose up -d

# 3. Install everything (npm workspaces)
npm install

# 4. Backend
cd backend
npx prisma migrate dev      # apply schema
npm run seed                # creates first super-admin (see .env)
npm run dev                 # http://localhost:4000/api/v1

# 5. Frontend (new terminal)
cd frontend
npm run dev                 # http://localhost:5173
```

## Current status

**Phase 1, slice 1** — repo configuration + authentication & registration
(self-register → `PENDING` → super-admin approves → `ACTIVE`).
