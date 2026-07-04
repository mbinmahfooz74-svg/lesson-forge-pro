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

## The engine (Stage A, complete)

Ten agents run on the Claude Agent SDK via a pg-boss queue. LLM agents call Claude when
`ANTHROPIC_API_KEY` is set and fall back to deterministic output otherwise, so the whole
pipeline runs offline and turns live the moment a key is added.

| Agent | Does |
|---|---|
| Ingestion | URL → extract (web/YouTube/PDF, fallbacks) → quality gate → pgvector embeddings |
| Vertical Architect | Field name → taxonomy, source map, glossary (EN/AR), course catalog |
| Curriculum Planner | Topic → multi-session arc, Bloom's objectives, prerequisites |
| Lesson Drafter | Session → minute-by-minute educator guide (uses skill memory + sources) |
| Materials Generator | Session → PPTX slides, assessment+rubric (DOCX), handout (DOCX+PDF) |
| Localizer | Session → RTL Arabic handout |
| Market Scout | Weekly field scan → classified proposals (needs TAVILY/BRAVE key) |
| Briefing Writer | Weekly briefing (Investment disclaimer; autonomy dial: publish vs review) |
| Advisor | Weekly cross-vertical synthesis + AI-spend estimate |
| Feedback Analyzer | Transcript/ratings/debrief → versioned skill memory (the learning loop) |

Run any agent from the CLI:

```bash
npm run agent --workspace=packages/engine -- <agent> <verticalSlug> ['{"json":"input"}']
# e.g. curriculum-planner ai-emerging-tech '{"title":"Prompt engineering","sessions":4}'
```

The weekly autonomous cycle (scout → briefing → advisor) runs on cron (Mon 06:00 UTC) in
the worker, or on demand via the "Run weekly cycle" button on the dashboard.

### Optional keys (in `.env`)
- `ANTHROPIC_API_KEY` — turns on real LLM generation for all agents.
- `TAVILY_API_KEY` or `BRAVE_API_KEY` — lets the Market Scout scan the web.

## Stage flags

`subscribers_enabled` and `b2b_enabled` are OFF (Stage A — owner mode). They are flipped in Stages B and C; the schema for plans, subscriptions, and entitlements is already in place.

## Cloud deploy (later, config-only)

Set `DATABASE_URL` to a managed Postgres with pgvector (Neon/Supabase), `AUTH_SECRET`, and deploy `apps/web` to Vercel; run `packages/engine` as a worker (Railway/Fly/ECS). No code changes required.
