# Lesson Forge Pro — Engine & Platform Blueprint (v2.1)

**Status:** CONFIRMED 2026-07-03 — build in progress (see [ROADMAP.md](ROADMAP.md)).
**Date:** 2026-06-13, confirmed with local-first build approach 2026-07-03 (supersedes v1 of 2026-06-12)
**Owner:** M. Bin Mahfooz
**Build approach:** local-first, cloud-ready — Docker Postgres locally, deploy to cloud is config-only.

---

## 1. Vision (v2)

An **autonomous education-intelligence platform**. The owner selects fields of interest; the engine then runs with minimal interaction:

- **Watches the market** in each selected field continuously and detects what changed.
- **Self-builds**: given a new field, it constructs the topic taxonomy, source map, course catalog, and briefing cadence on its own.
- **Advises weekly**: a summary per field of what happened, what material should be built, what training should be conducted, and what existing content must change.
- **Produces complete training packages**: curricula, session plans, minute-by-minute educator guides, slides (PPTX), assessments, learner handouts (docx/PDF) — bilingual **English + Arabic**.
- **Earns revenue**: individual subscribers pay per vertical (web portal + email digests + downloadable packs), with **Investment** as a premium briefings-plus-courses vertical. SMB/enterprise tenants later get self-service workspaces to build their own customized material.

### Activation stages (everything built cloud-ready, switched on by feature flags)

| Stage | Who uses it | Flag state |
|---|---|---|
| **A — Owner mode** | You only: test the engine, build verticals, consume briefings & advisories | Subscribers OFF, B2B OFF |
| **B — Subscriber launch** | Individual paying subscribers per vertical | Subscribers ON, B2B OFF |
| **C — B2B launch** | SMB/enterprise workspaces with their own custom fields | All ON |

The data model, auth, and billing tables are multi-tenant from Sprint 0, so activation is configuration — not re-engineering.

---

## 2. Product surfaces

### 2.1 Owner Ops Dashboard (you)
- **Command briefing (home):** this week across all verticals — market signals detected, engine recommendations, pending approvals, business KPIs (subscribers, MRR, churn, engagement) once Stage B is live.
- **Vertical manager:** create/configure a vertical (name, scope, sources, language(s), **autonomy dial**, pricing tier). On creation the engine self-builds it (see Vertical Architect).
- **Source pipeline:** drop any URL/file into any vertical; live ingestion status, quality flags, retries.
- **Course & briefing studio:** browse/edit generated curricula, sessions, briefings; per-section ratings and edits feed the learning loop.
- **Review queue:** items awaiting approval (per the autonomy dial), shown as diffs with one-click approve/publish.
- **Feedback console:** transcripts/debriefs upload; view skill-memory diffs (what the engine learned).
- **Business panel (Stage B+):** plans & pricing, subscriber lists, revenue, content engagement analytics.

### 2.2 Subscriber Portal (Stage B)
- Weekly **briefings feed** per subscribed vertical (free tier sees previews).
- **Course library** per vertical with progress tracking.
- **Downloadable packs** (PPTX/PDF/docx) where the plan allows.
- Account, plan management (Stripe customer portal), language preference (EN/AR, RTL UI).

### 2.3 Tenant Workspaces (Stage C — built ready, activated later)
- SMB/enterprise admins define their own private fields; the engine self-builds custom curricula and material in their workspace (their branding on packs).
- Seat management, member roles, usage limits per plan; enterprise SSO later.

### 2.4 Email delivery
- Weekly **owner advisory** (the "what to do next" summary).
- Weekly **subscriber digests** per vertical (Stage B), localized EN/AR.

---

## 3. The Engine (Claude Agent SDK, TypeScript) — agent roster

All agents run as queued cloud jobs. Each loads the relevant **skill memory** and the vertical's profile before working.

| Agent | Role |
|---|---|
| **Vertical Architect** *(new)* | Given a field name + scope, self-builds the vertical: topic taxonomy, key-source map (sites, channels, feeds), search queries, initial course catalog proposal, briefing template, glossary (EN/AR). This is what makes the platform "self-building". |
| **Ingestion Agent** | Any URL/file → classified → extracted (web 3-tier fallback; YouTube captions → Whisper fallback; threads, PDFs, docs) → normalized, quality-scored, embedded, versioned. |
| **Market Intelligence Scout** *(upgraded Field Scout)* | Scheduled per vertical (weekly default, configurable): searches the field, compares with the knowledge base, classifies findings (new topic / update to existing / noise), and emits proposals with significance scores. |
| **Briefing Writer** *(new)* | Turns scout findings into the weekly briefing per vertical: what moved, why it matters, implications for learners. Investment briefings follow a stricter template with a mandatory educational disclaimer. |
| **Curriculum Planner** | Topic → multi-session arc, Bloom's-mapped objectives, prerequisite ordering, syllabus. |
| **Lesson Drafter** | Session plan + minute-by-minute educator guide (timing, talking points, analogies, anticipated questions) in the vertical's voice profile. |
| **Materials Generator** | PPTX slides, assessments + rubrics, docx/PDF handouts; branded per tenant in Stage C. |
| **Localizer** *(new)* | Produces the Arabic edition of briefings/courses (not literal translation — culturally adapted examples, RTL-correct documents); maintains the EN↔AR glossary per vertical. |
| **Advisor** *(new)* | Weekly cross-vertical synthesis for the owner: what happened, what material to build next, what training to conduct, what to change, plus content-performance signals (Stage B+: engagement, churn correlation). Sends the owner advisory email. |
| **Feedback Analyzer** | Transcripts, ratings, edit-diffs, debriefs → distilled into versioned skill-memory files (voice profile, analogy bank, pacing rules, question patterns) per vertical. Auditable and revertible. |

### Autonomy dial (per vertical)
- **Review-first:** scout proposals, briefings, and course updates land in the Review Queue; nothing publishes without approval. *(Default for Investment and any new vertical.)*
- **Full-auto:** engine publishes directly; the owner advisory reports what was published with links to revert. *(Graduate mature verticals here to reach "minimal interaction".)*

---

## 4. Platform architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                WEB APP (Next.js, cloud-hosted, EN/AR + RTL)      │
│  Owner Ops Dashboard │ Subscriber Portal (flag) │ Tenant WS (flag)│
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────────┐
│                    FORGE ENGINE (Agent SDK workers)              │
│ Vertical Architect · Ingestion · Market Scout · Briefing Writer  │
│ Curriculum Planner · Lesson Drafter · Materials Gen · Localizer  │
│ Advisor · Feedback Analyzer    — via job queue + cron schedules  │
└───────┬──────────────┬──────────────┬──────────────┬─────────────┘
        │              │              │              │
┌───────┴─────┐ ┌──────┴──────┐ ┌─────┴──────┐ ┌─────┴───────────┐
│  POSTGRES   │ │ OBJECT STORE│ │   STRIPE   │ │  EMAIL (Resend/ │
│ multi-tenant│ │ packs, media│ │ plans, subs│ │  SES): digests, │
│ + pgvector  │ │ versioned   │ │ entitlements│ │  advisories     │
└─────────────┘ └─────────────┘ └────────────┘ └─────────────────┘
```

- **App & API:** Next.js (App Router) on Vercel or similar; tRPC/REST API routes; SSE for live pipeline status.
- **Workers:** Node worker fleet running Agent SDK jobs off a queue (e.g. pg-boss/Inngest); cron schedules per vertical for scouts, briefings, advisor.
- **Database:** Postgres with `pgvector` for embeddings. Core entities: `tenants` (owner is tenant #1), `users`+roles, `verticals`, `sources`, `documents` (versioned), `courses`, `sessions`, `briefings`, `proposals` (review queue), `skill_memory` (versioned), `plans`, `subscriptions`, `entitlements`, `events` (analytics), `feature_flags`.
- **Storage:** S3-compatible bucket for generated packs (PPTX/docx/PDF), media, transcripts.
- **Billing:** Stripe — free tier (briefing previews), per-vertical monthly plans, Investment premium plan; generic entitlement table so pricing changes are config. B2B workspace plans added at Stage C.
- **Auth:** email/OAuth (e.g. Auth.js or Clerk); roles: owner, subscriber, tenant-admin, tenant-member.
- **i18n:** EN + AR from day one — all content entities carry language editions; UI fully RTL-capable; documents generated per language.
- **Versioning:** every content edition and skill-memory change is a versioned row with author (human/agent) and diff — the cloud equivalent of v1's Git audit trail.
- **Cost controls:** per-vertical weekly AI budget caps, token metering per job, alerts in the owner dashboard.

---

## 5. The weekly autonomous cycle (per vertical)

1. **Scout** runs on schedule → classifies market findings (new topic / update / noise) with significance scores.
2. **Briefing Writer** drafts the weekly briefing (EN, then Localizer → AR).
3. **Curriculum/Drafter/Materials** generate or revise affected courses and packs.
4. Autonomy dial: **full-auto** → publish + digest emails; **review-first** → Review Queue.
5. **Advisor** synthesizes all verticals → owner advisory email: what happened, what to build, what training to conduct, what changed, business KPIs.
6. Owner feedback (approvals, edits, ratings) → **Feedback Analyzer** → skill memory improves next cycle.

Your steady-state effort: read one weekly email, clear one review queue. Everything else is autonomous.

---

## 6. Investment vertical (premium) — special handling

- Weekly market-intelligence briefing + courses on investing topics (analysis frameworks, asset classes, fintech developments).
- **Compliance guardrails baked in:** every briefing/course carries an "educational content — not financial advice" disclaimer (EN/AR); the Briefing Writer is constrained against personalized recommendations ("buy X now"); review-first autonomy is the locked default until you explicitly relax it.
- Priced as the premium tier in Stripe.

---

## 7. Sprint plan

Sprints ≈ 1 week of focused part-time work. Stage A ≈ 6–7 weeks → engine proven for your own use. Stage B ≈ 3 weeks → paying subscribers. Stage C ≈ 3–4 weeks → B2B.

### Stage A — Cloud engine, owner mode (flags off)

**Sprint 0 — Cloud foundation (3–4 days)**
- Monorepo (Next.js app + engine workers + shared types), deployed to cloud from day one.
- Postgres schema: full multi-tenant model incl. plans/subscriptions/entitlements/feature-flags (empty but ready), pgvector.
- Auth with roles; owner account; job queue + cron scaffolding; i18n/RTL scaffold.
- **Done when:** the deployed app authenticates you, runs a trivial agent job through the queue, and renders an RTL Arabic page correctly.

**Sprint 1 — Ingestion pipeline**
- Extractor chains (web 3-tier, YouTube captions→Whisper, threads, PDF/docs), normalization, quality gate, embeddings, versioned documents.
- Source Pipeline UI with live status, retry, diagnostics.
- **Done when:** a YouTube URL, a blog URL, and a PDF each yield clean indexed sources; a broken URL fails loudly with diagnostics.

**Sprint 2 — Vertical Architect + self-build**
- Vertical creation flow → agent builds taxonomy, source map, search queries, course catalog proposal, briefing template, EN/AR glossary.
- Stand up the four launch verticals: **Investment (premium), AI & emerging tech, Business & professional skills, Finance & economy** — plus the "add any vertical" path.
- **Done when:** creating a brand-new field from one sentence produces a credible, editable vertical blueprint in under 10 minutes.

**Sprint 3 — Curriculum + drafting**
- Curriculum Planner (multi-session arcs, Bloom's mapping) + Lesson Drafter (plan + minute-by-minute educator guide), per-vertical voice profiles.
- Course & Briefing Studio UI (edit, regenerate-section, ratings).
- **Done when:** one vertical produces a 4-session curriculum and a complete, teachable session you would actually deliver.

**Sprint 4 — Materials Generator + Localizer**
- PPTX slides, assessments + rubrics, docx/PDF handouts; one-click full pack.
- Arabic editions: localized briefings/courses, RTL-correct PPTX/docx/PDF.
- **Done when:** one click yields a complete bilingual materials pack with zero manual formatting.

**Sprint 5 — Autonomy: Scout + Briefing Writer + Advisor**
- Market Intelligence Scout on weekly cron per vertical; significance scoring; Review Queue with diffs.
- Briefing Writer (incl. Investment template + disclaimers); autonomy dial; owner advisory email.
- **Done when:** a full unattended weekly cycle runs across all four verticals and your Monday advisory email tells you exactly what happened and what to do.

**Sprint 6 — Feedback loop + Stage-A hardening**
- Transcript/debrief upload, ratings + edit mining → versioned skill memory; golden-set regression evals so learning never degrades output.
- Cost caps + token metering; pipeline resilience pass.
- **Done when:** feedback measurably improves the next draft, and two consecutive autonomous weekly cycles complete without intervention. **← Stage A exit: engine proven for your own use.**

### Stage B — Subscriber activation (flag flip + build)

**Sprint 7 — Subscriber portal**
- Briefings feed, course library with progress, downloadable packs, EN/AR preference; free-tier preview gating.
- **Done when:** a test subscriber account experiences the full content journey on web + email digest.

**Sprint 8 — Billing + business panel**
- Stripe: free tier, per-vertical plans, Investment premium; customer portal; entitlement enforcement.
- Owner business panel: subscriber counts, MRR, churn, engagement per vertical/briefing/course.
- **Done when:** a real test payment grants access end-to-end and the dashboard shows the numbers.

**Sprint 9 — Launch hardening**
- Security review (multi-tenant isolation, payment flows), ToS/privacy/disclaimer pages (EN/AR), load sanity checks, onboarding flow, analytics events.
- **Done when:** Stage B flag is flipped for real users. **← Revenue begins.**

### Stage C — B2B activation (later, on demand)

**Sprint 10–11 — Tenant workspaces**
- Self-service workspace onboarding for SMB/enterprise; private custom verticals; branded packs; seat management; workspace plans in Stripe; usage limits.
- Enterprise add-ons backlog: SSO, API access, white-label portal.
- **Done when:** a pilot company signs up, defines its own field, and receives custom branded material with zero involvement from you.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Investment content seen as financial advice | Locked disclaimers EN/AR, agent constrained against personalized recommendations, review-first default, ToS language |
| AI errors reaching paying subscribers | Autonomy dial defaults to review-first; quality gates; golden-set regression evals; one-click unpublish/revert |
| Arabic generation quality | Localizer agent (adaptation, not translation) + per-vertical glossary + owner spot-check workflow before AR flag is flipped per vertical |
| Weekly AI cost grows with verticals | Per-vertical budget caps, token metering, significance thresholds so the scout drafts only what matters |
| Scraping breakage (YouTube/X ToS, API changes) | Isolated swappable extractors, multi-tier fallbacks, loud failure flags |
| Multi-tenant data leakage (Stage B/C) | Tenant-scoped queries enforced at the data layer (RLS), security review in Sprint 9 |
| Scope creep before revenue | Strict stage gates: Stage A exit criteria must pass before Stage B work starts |

---

## 9. Out of scope (for now)

- Mobile apps (responsive web only).
- LMS/SCORM export, live-class hosting, community features — Phase 3 backlog.
- Affiliate/marketplace models; languages beyond EN/AR.
- Notion publishing (v1 feature) — replaced by the platform's own portal; can return as an owner export option later.

---

**Next step:** review this v2 blueprint. On your confirmation (with any edits), the build starts at Sprint 0.
