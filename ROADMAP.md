# Lesson Forge Pro — Complete Project Roadmap

**Blueprint:** v2.1 CONFIRMED (see [BLUEPRINT.md](BLUEPRINT.md))
**Build started:** 2026-07-03
**Approach:** local-first, cloud-ready — everything runs on the owner's machine (Docker Postgres) and deploys to Vercel/Neon by configuration only, no re-engineering.

---

## The three stages at a glance

| Stage | Outcome | Duration | Gate to next stage |
|---|---|---|---|
| **A — Owner mode** | Engine proven on your own use: 4 verticals live, weekly autonomous cycles running, advisory email arriving | ~6–7 weeks | Two consecutive unattended weekly cycles + quality you'd put your name on |
| **B — Subscriber launch** | Paying individual subscribers: portal, digests, Stripe billing, business KPIs | ~3 weeks | Real test payment end-to-end + security review passed |
| **C — B2B launch** | SMB/enterprise tenant workspaces building their own custom material | ~3–4 weeks | Pilot company onboards with zero owner involvement |

Cumulative: **~13–14 weeks** from today to full platform. Revenue possible at the end of Stage B (~week 10).

---

## Stage A — Cloud-ready engine, owner mode (flags off)

### Sprint 0 — Foundation *(in progress — started 2026-07-03)*
**Builds:** monorepo (Next.js web + Agent SDK engine workers + shared DB package), Dockerized Postgres with pgvector, full multi-tenant schema (tenants, users/roles, verticals, courses, briefings, proposals, plans, subscriptions, entitlements, feature flags), credentials auth, job queue (pg-boss), EN/AR locale routing with RTL.
**Outcome:** the app boots, you can log in, an Arabic RTL page renders correctly, and a trivial agent job runs through the queue. Subscriber/B2B tables exist but flags are OFF.

### Sprint 1 — Ingestion pipeline
**Builds:** URL classifier + extractor chains (web article 3-tier fallback, YouTube captions → Whisper fallback, X threads, PDF/docs), normalization to versioned documents, quality gate scoring, pgvector embeddings, Source Pipeline UI with live status/retry/diagnostics.
**Outcome:** drop any URL or file into any vertical and get clean, indexed, versioned source material — failures are loud and explained, never silent.

### Sprint 2 — Vertical Architect (self-building)
**Builds:** vertical creation flow → the agent self-builds taxonomy, key-source map, search queries, initial course catalog proposal, briefing template, EN↔AR glossary. Stands up the 4 launch verticals: **Investment (premium), AI & emerging tech, Business & professional skills, Finance & economy**.
**Outcome:** describe any new field in one sentence → a credible, editable vertical blueprint in under 10 minutes. This is the "self-build" capability.

### Sprint 3 — Curriculum + lesson drafting
**Builds:** Curriculum Planner (multi-session arcs, Bloom's-mapped objectives, prerequisite ordering) + Lesson Drafter (session plan + minute-by-minute educator guide with timing, talking points, analogies, anticipated questions), per-vertical voice profiles, Course & Briefing Studio UI (edit, regenerate-section, per-section ratings).
**Outcome:** one vertical produces a 4-session curriculum and a complete session you would actually teach.

### Sprint 4 — Materials Generator + Arabic Localizer
**Builds:** PPTX slide generation, assessments + rubrics per Bloom's level, docx/PDF learner handouts, one-click full pack; Localizer agent producing culturally adapted Arabic editions with RTL-correct documents.
**Outcome:** one click → complete bilingual materials pack, zero manual formatting.

### Sprint 5 — Autonomy: Scout + Briefing Writer + Advisor
**Builds:** Market Intelligence Scout on weekly cron per vertical (search → classify: new topic / update / noise → significance scores), Briefing Writer (incl. Investment compliance template + locked disclaimers), Review Queue with diffs, per-vertical autonomy dial (review-first ↔ full-auto), Advisor weekly cross-vertical synthesis + owner advisory email.
**Outcome:** a full unattended weekly cycle across all 4 verticals; your Monday email tells you what happened, what to build, what training to conduct, and what changed.

### Sprint 6 — Feedback loop + Stage-A hardening
**Builds:** transcript/debrief upload, ratings + edit-diff mining → versioned skill memory (voice profile, analogy bank, pacing rules, question patterns); golden-set regression evals so learning never degrades output; per-vertical AI budget caps + token metering; pipeline resilience pass.
**Outcome:** feedback measurably improves the next draft; two consecutive autonomous weekly cycles complete without intervention. **← Stage A exit gate.**

---

## Stage B — Subscriber activation

### Sprint 7 — Subscriber portal
**Builds:** subscriber accounts, briefings feed per subscribed vertical, course library with progress tracking, downloadable packs, EN/AR preference, free-tier preview gating, weekly digest emails.
**Outcome:** a test subscriber experiences the complete content journey on web + email.

### Sprint 8 — Billing + business panel
**Builds:** Stripe integration — free tier, per-vertical monthly plans, Investment premium plan, customer portal, entitlement enforcement; owner business panel — subscriber counts, MRR, churn, engagement per vertical/briefing/course.
**Outcome:** a real test payment grants access end-to-end; the dashboard shows live business numbers.

### Sprint 9 — Launch hardening
**Builds:** multi-tenant isolation security review (RLS), payment-flow review, ToS/privacy/disclaimer pages (EN/AR), onboarding flow, analytics events, load sanity checks, production deploy to Vercel + managed Postgres.
**Outcome:** subscriber flag flipped for real users. **← Revenue begins.**

---

## Stage C — B2B activation

### Sprints 10–11 — Tenant workspaces
**Builds:** self-service workspace onboarding for SMB/enterprise, private custom verticals per tenant, tenant-branded packs, seat management + member roles, workspace plans in Stripe, usage limits.
**Outcome:** a pilot company signs up, defines its own field, and receives custom branded training material with zero involvement from you.

**Enterprise backlog (post-launch, demand-driven):** SSO/SAML, API access, white-label portal, LMS/SCORM export, additional languages.

---

## The weekly autonomous cycle (what "done" looks like in steady state)

1. Scout scans each vertical → classifies market findings with significance scores.
2. Briefing Writer drafts the weekly briefing (EN → Localizer → AR).
3. Curriculum/Drafter/Materials generate or revise affected courses and packs.
4. Autonomy dial: full-auto → publish + subscriber digests; review-first → your Review Queue.
5. Advisor synthesizes everything → your Monday advisory email (+ business KPIs once Stage B is live).
6. Your approvals/edits/ratings feed skill memory → next cycle is smarter.

**Your steady-state effort: read one email, clear one queue.**

## Success metrics per stage

| Stage | Metric | Target |
|---|---|---|
| A | Unattended weekly cycles completed | 2 consecutive |
| A | Time from "new field" sentence → vertical blueprint | < 10 min |
| A | Materials pack generation | 1 click, zero manual formatting |
| B | First paying subscriber | ≤ 2 weeks after flag flip |
| B | Weekly digest open rate | > 40% |
| C | Pilot tenant onboarded without owner help | 1 company |

## Standing risks (tracked every sprint)

Investment-content compliance (locked disclaimers, review-first), AI errors reaching subscribers (autonomy defaults + evals + revert), Arabic quality (Localizer + glossary + owner spot-check before AR flag per vertical), AI cost growth (budget caps + significance thresholds), scraper breakage (swappable extractors + loud failures), tenant data isolation (RLS + Sprint 9 review).
