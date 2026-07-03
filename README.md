# Lesson Forge Pro

Autonomous education-intelligence platform. See [BLUEPRINT.md](BLUEPRINT.md) (architecture, confirmed v2.1) and [ROADMAP.md](ROADMAP.md) (sprints & outcomes).

## Monorepo layout

```
apps/web          Ops Studio — Next.js 15, Auth.js, EN/AR with RTL
packages/db       Prisma schema (multi-tenant), seed, client
packages/engine   Agent workers — pg-boss queue, 10-agent registry
packages/shared   Shared types & constants (flags, locales, agents)
```

## Local development

Prereqs: Node 20+, Docker Desktop.

```bash
cp .env.example .env      # then edit OWNER_PASSWORD / AUTH_SECRET
npm install
npm run db:up             # Postgres 16 + pgvector on localhost:5433
npm run db:push           # create schema
npm run db:seed           # owner user, 4 verticals, plans, flags
npm run dev               # Ops Studio on http://localhost:3000
npm run dev:worker        # engine worker (separate terminal)
```

Log in at http://localhost:3000/en (or /ar for Arabic RTL) with `OWNER_EMAIL` / `OWNER_PASSWORD` from `.env`.

Verify the queue round-trip: with the worker running,

```bash
npm run ping --workspace=packages/engine
```

## Stage flags

`subscribers_enabled` and `b2b_enabled` are OFF (Stage A — owner mode). They are flipped in Stages B and C; the schema for plans, subscriptions, and entitlements is already in place.

## Cloud deploy (later, config-only)

Set `DATABASE_URL` to a managed Postgres with pgvector (Neon/Supabase), `AUTH_SECRET`, and deploy `apps/web` to Vercel; run `packages/engine` as a worker (Railway/Fly/ECS). No code changes required.
