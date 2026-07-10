# ARU — Application Requirements & Understanding
## Udemy Course Finder (Localhost Edition)

**Document type:** Production Requirements Document (PRD)
**Deployment target:** Localhost-only (self-hosted, single-machine, Docker Compose)
**Status:** Draft v1.0
**Source:** Synthesized from project documentation set (README, Architecture, Frontend, Backend, Database, API, Scraper Engine, Source Management, Local Setup, Docker, Security, Testing, AI Rules, Coding Standards, Roadmap)

---

## 1. Purpose & Overview

The **Udemy Course Finder** is a self-hosted web application that continuously discovers **free, English-language Udemy courses** by scraping a curated set of coupon/deal websites, normalizing the results into a single searchable catalog, and presenting them to the user through a modern web dashboard. Because free Udemy coupons expire quickly (often within 24–72 hours), the system's core value is **speed of discovery, deduplication across sources, and reliable filtering**, so the user never has to manually browse nine different coupon sites.

The application is explicitly scoped as a **personal, localhost-only tool** — it is not intended for multi-tenant public deployment, but it is still built to production-grade engineering standards (typed, tested, secured, containerized) so it is stable, maintainable, and safe to run continuously in the background.

---

## 2. Goals & Objectives

| Goal | Description |
|---|---|
| G1 | Aggregate free Udemy course coupons from 9 external sources into one deduplicated catalog |
| G2 | Guarantee only **English-language**, currently **free/100%-off** courses are surfaced |
| G3 | Provide fast search, filtering, and browsing via a dashboard UI |
| G4 | Allow the user to save courses to **Favorites** and track **enrollment history** |
| G5 | Give full operational visibility and control over each scraper **Source** (enable/disable, test, retry, logs, stats) |
| G6 | Provide **Analytics** on scraping activity and course trends |
| G7 | Secure the app behind **authentication**, even though it's localhost-only |
| G8 | Run entirely via **Docker Compose** with zero external cloud dependency |

### Non-Goals (Out of Scope)
- Automatic/bulk enrollment into Udemy courses (enrollment remains a **manual** user action — the app links out to Udemy/the coupon page)
- Multi-user / multi-tenant SaaS deployment
- Public internet exposure, CDN, or horizontal scaling
- Payment processing or paid-course tracking
- Non-English course support (explicitly filtered out)

---

## 3. Target User

A single technical user (or small household of users) running the app on their own machine or home server who wants a personal, always-on aggregator for free Udemy courses, with an admin-level view into how each scraping source is performing.

---

## 4. Core Features

### 4.1 Course Discovery & Catalog
- Aggregated, deduplicated list of currently-free Udemy courses pulled from all enabled sources.
- Each course record includes: title, Udemy URL, coupon/redeem URL, provider/source, category, language, thumbnail, rating (if available), instructor, original price, discount validity window, and last-verified timestamp.
- Automatic **expiry handling**: courses whose coupon is no longer valid are flagged/removed rather than shown as actionable.

### 4.2 Language & Free Filtering
- Only **English** courses are ingested — non-English detection happens in the scraper pipeline's normalization stage before storage.
- Only courses currently priced at **$0.00 / 100% off** are accepted; paid or partially-discounted listings are rejected.

### 4.3 Manual Enrollment
- The app does **not** auto-enroll. Each course card provides a direct "Get Course" link to the live coupon/redeem URL so the user manually completes enrollment on Udemy.
- The system records an enrollment/click event to history when the user follows this link.

### 4.4 Dashboard
- Landing view summarizing: newest courses, total courses tracked, active sources, courses expiring soon, and recent scraper activity.
- Quick-access widgets for Favorites and Search.

### 4.5 Search
- Full-text search across course titles/descriptions.
- Filters: category, provider/source, language (locked to English), rating, date added, expiry status.
- Sort by: newest, expiring soonest, rating, alphabetical.

### 4.6 Favorites
- User can bookmark any course to a personal Favorites list.
- Favorites persist per authenticated user and remain visible even if the course later expires (marked as "expired" rather than deleted from the list).

### 4.7 History
- Log of courses the user has viewed/clicked "Get Course" on, with timestamps, for later reference.

### 4.8 Source Management
- Full CRUD-style operational control over each of the 9 scraper sources:
  - **Enable / Disable** a source without redeploying
  - **Test** a source's scraper (dry-run / connectivity check)
  - **Manual Scrape** trigger (on-demand run outside the schedule)
  - **Logs** viewer per source (success/failure, error messages, timing)
  - **Stats** per source (courses found, courses accepted vs. rejected, success rate, last run time)
  - **Retry** failed scrape jobs
  - **Timeout** configuration per source to prevent a slow site from blocking the pipeline

### 4.9 Analytics
- Aggregate metrics dashboard: courses added over time, per-source yield, category breakdown, rejection reasons (non-English, not free, duplicate), scraper uptime/success rate.

### 4.10 Authentication
- JWT-based login gate protecting the dashboard and all API routes, even in a localhost-only deployment, to prevent unauthorized access on shared networks and to support future multi-user use.
- Passwords hashed with Argon2.

---

## 5. System Architecture

```
Browser
   │
   ▼
Next.js (Frontend, :3000)
   │  REST calls
   ▼
NestJS (Backend API, :4000)
   │
   ├──▶ PostgreSQL (:5432)  — primary data store
   ├──▶ Redis (:6379)       — cache + BullMQ job queue
   │
   ▼
Python Scraper Engine  ──▶  Coupon Websites (9 external sources)
```

- **Frontend** communicates only with the NestJS API — no direct DB or scraper access.
- **Backend (NestJS)** owns all business logic, authentication, and orchestration; it enqueues scraping jobs into **BullMQ (Redis-backed)** rather than calling the scraper synchronously, so long-running scrapes never block API requests.
- **Python Scraper Engine** is a separate process/service invoked by the backend (via job queue / worker) that performs the actual HTTP scraping of each coupon site and returns normalized results for storage.
- **PostgreSQL** is the system of record; **Redis** serves as both a cache layer (e.g., hot search queries, dashboard stats) and the BullMQ backing store for scheduled/background jobs.
- The entire stack is containerized and orchestrated with **Docker Compose** for one-command local startup.

---

## 6. Frontend Requirements

**Stack:** Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui, Zustand, TanStack Query.

| Concern | Requirement |
|---|---|
| Rendering | Next.js 15 App Router; use server components where data doesn't need client interactivity, client components for interactive widgets (search, filters, favorites toggle) |
| Styling | Tailwind CSS utility-first styling; shadcn/ui for accessible, composable UI primitives (cards, dialogs, tables, tabs, dropdowns) |
| Client state | Zustand for local/UI state (e.g., filter selections, sidebar state, auth session state) |
| Server state | TanStack Query for all API data fetching, caching, background refetch, and mutation handling (favorite toggle, manual scrape trigger) |
| Pages/Views | Login, Dashboard, Search/Browse, Course Detail, Favorites, History, Source Management, Analytics, Settings |
| Responsiveness | Fully responsive layout (desktop-first, since localhost, but usable on mobile viewport for LAN access) |
| Loading/Empty states | All data views must define explicit loading, empty, and error states (e.g., "No courses match your filters") |
| Accessibility | shadcn/ui components used as-is preserve keyboard nav and ARIA semantics; maintain this in custom components |

---

## 7. Backend Requirements

**Stack:** NestJS, Prisma ORM, PostgreSQL, Redis, BullMQ, Swagger, JWT.

| Concern | Requirement |
|---|---|
| Framework | NestJS with modular, feature-based module structure (Auth, Courses, Providers/Sources, Favorites, History, Analytics) |
| ORM | Prisma as the single source of truth for the DB schema and migrations |
| Auth | JWT access/refresh token flow; guards on all protected routes |
| Background jobs | BullMQ queues (Redis-backed) for scheduled and on-demand scraping jobs, retries, and timeouts |
| Caching | Redis caches expensive/frequent reads (dashboard stats, search results) with sensible TTLs, invalidated on new scrape ingestion |
| API docs | Swagger/OpenAPI auto-generated documentation available at a dev-only route |
| Validation | DTO-based request validation (class-validator/class-transformer) on every endpoint |
| Architecture pattern | Repository pattern for data access, keeping controllers/services thin and testable (see Section 13, AI Rules) |

---

## 8. Database Schema (Logical Model)

**Engine:** PostgreSQL, managed via Prisma migrations.

| Table | Purpose | Key Fields (representative) |
|---|---|---|
| `users` | App accounts / authentication | id, email, password_hash (Argon2), role, created_at |
| `courses` | The aggregated course catalog | id, title, description, udemy_url, coupon_url, provider_id, category_id, language, thumbnail_url, rating, price_original, is_free, expires_at, first_seen_at, last_verified_at, is_active |
| `providers` | The 9 external scraper sources | id, name, base_url, is_enabled, timeout_ms, last_run_at, last_status |
| `categories` | Course categorization/taxonomy | id, name, slug |
| `favorites` | User-saved courses | id, user_id, course_id, created_at |
| `history` | User click/enrollment activity log | id, user_id, course_id, action, created_at |
| `logs` | Scraper run logs (per provider/job) | id, provider_id, job_id, status, message, started_at, finished_at |
| `settings` | App-level configuration (schedules, defaults) | id, key, value |

**Relationships (indicative):**
- `courses.provider_id → providers.id`
- `courses.category_id → categories.id`
- `favorites.user_id → users.id`, `favorites.course_id → courses.id`
- `history.user_id → users.id`, `history.course_id → courses.id`
- `logs.provider_id → providers.id`

**Indexing considerations:** unique constraint on a course-dedup key (e.g., normalized title + provider or Udemy course ID), index on `courses.is_active` + `courses.expires_at` for fast "currently valid" queries, index on `courses.language` and `courses.is_free` to support the mandatory filtering rules.

---

## 9. API Specification

REST API served by NestJS at `http://localhost:4000`, documented via Swagger.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/courses` | List courses (paginated, filterable by category/provider/expiry) |
| `GET` | `/courses/:id` | Get a single course's full detail |
| `GET` | `/courses/search` | Full-text search with query params for filters and sorting |
| `GET` | `/providers` | List all scraper sources with status/stats |
| `POST` | `/providers/scrape` | Trigger a manual scrape (all providers, or a specific `provider_id`) |

**Implied additional endpoints required for full feature coverage** (to be confirmed during implementation, consistent with the feature set in Section 4):
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `POST /favorites`, `DELETE /favorites/:courseId`, `GET /favorites`
- `GET /history`, `POST /history`
- `PATCH /providers/:id` (enable/disable, edit timeout)
- `GET /providers/:id/logs`, `GET /providers/:id/stats`
- `POST /providers/:id/test`, `POST /providers/:id/retry`
- `GET /analytics/overview`

All endpoints (except `/auth/login`) require a valid JWT bearer token.

---

## 10. Scraper Engine

**Language/runtime:** Python (invoked as a separate service/worker from the NestJS backend via the job queue).

**Sources (9 total):**
1. Real Discount
2. Courson
3. Tutorial Bar
4. E-next
5. iDownloadCoupons
6. DiscUdemy
7. Udemy Freebies
8. Course Joiner
9. Course Vania

**Pipeline (per provider run):**

```
Scrape → Normalize → Validate → English-filter → Deduplicate → Store
```

| Stage | Responsibility |
|---|---|
| **Scrape** | Fetch listing/detail pages from the source with configured timeout; respect per-provider rate limits |
| **Normalize** | Map the source's HTML/data structure into a common course schema (title, url, coupon code/link, category, price, image) |
| **Validate** | Confirm required fields are present and the coupon link is well-formed and currently reachable/active |
| **English-filter** | Detect course language; discard non-English results before they ever reach storage |
| **Deduplicate** | Compare against existing catalog (by normalized title + Udemy course identifier, or by coupon URL) to avoid duplicate entries across the 9 sources |
| **Store** | Persist accepted courses to PostgreSQL via the backend; update `providers.last_run_at`/`last_status` and write a `logs` entry |

- Each provider run is independently timeboxed (per-provider `timeout_ms`, configurable in Source Management) so one slow/unresponsive site cannot stall the overall pipeline.
- Failed runs are retryable (manually via Source Management, and/or automatically via BullMQ retry/backoff policy).

---

## 11. Source Management (Operational Requirements)

The Source Management screen is the operator control surface for the scraper engine and must support, per provider:

- **Enable/Disable** — toggle whether a provider is included in scheduled/manual runs
- **Test** — run a lightweight connectivity/parsing check without full ingestion
- **Manual Scrape** — trigger an immediate full run outside the schedule
- **Logs** — view historical run logs (status, error detail, duration)
- **Stats** — view aggregate yield (found/accepted/rejected counts, success rate, last run timestamp)
- **Retry** — re-run a previously failed job
- **Timeout** — configure the max time allotted to a provider's scrape before it's aborted

---

## 12. Local Setup

| Service | Port |
|---|---|
| Next.js (Frontend) | `3000` |
| NestJS (Backend API) | `4000` |
| PostgreSQL | `5432` |
| Redis | `6379` |
| pgAdmin | `5050` |
| Redis Commander | `8081` |

All services are expected to run locally with no external network dependency beyond outbound scraping traffic to the 9 coupon-site domains.

---

## 13. Docker

- The entire stack (frontend, backend, PostgreSQL, Redis, Python scraper worker, pgAdmin, Redis Commander) is defined in a single `docker-compose.yml`.
- **Startup:** `docker compose up -d`
- Environment configuration (DB credentials, JWT secret, Redis URL, per-provider settings) is supplied via `.env` files, never hardcoded.
- Named volumes must be used for PostgreSQL data persistence so course/user data survives container restarts.

---

## 14. Security Requirements

| Control | Requirement |
|---|---|
| Authentication | JWT access + refresh tokens |
| Password storage | Argon2 hashing (no plaintext, no reversible encryption) |
| HTTP headers | Helmet middleware enabled on the NestJS API |
| Rate limiting | Applied to auth endpoints and public-facing API routes to prevent brute force / abuse |
| Input validation | Every incoming request validated via DTOs before reaching business logic |
| Secrets management | All credentials/secrets via environment variables, excluded from version control |
| Scope note | Even though the deployment is localhost-only, authentication and hardening are mandatory — the app may run on a shared LAN or be exposed via port-forwarding, so it must not assume a trusted network |

---

## 15. Testing Requirements

| Test type | Scope |
|---|---|
| Unit | Services, utility functions, DTO validation, Prisma repository logic |
| Integration | NestJS module interactions (e.g., Courses module + Prisma + Redis cache) |
| E2E | Full user flows via API (login → search → favorite → view history) and/or UI-level E2E |
| Scraper tests | Per-provider parser tests against fixture HTML to guard against site markup changes; pipeline-stage tests for normalize/validate/English-filter/dedupe logic |

Testing must run in CI (or at minimum, be scriptable) and cover both happy paths and failure modes (expired coupon, non-English content, provider timeout, malformed source HTML).

---

## 16. Coding Standards & AI Development Rules

These apply to all code in the repository, including AI-assisted contributions:

- **Strict TypeScript** across frontend and backend — no `any` without justification, strict mode enabled.
- **SOLID principles** applied to backend service/module design.
- **Repository pattern** for all database access — no direct Prisma calls scattered through controllers/services.
- **Reusable components** on the frontend — shared UI primitives (cards, filters, badges) built once and composed, not duplicated per page.
- **ESLint + Prettier** enforced repo-wide with a shared config; no unformatted or lint-failing code merged.
- **Feature-based folder structure** (organize by domain feature — e.g., `courses/`, `providers/`, `favorites/` — rather than by technical layer alone).

---

## 17. Roadmap (Phased Delivery)

| Phase | Focus |
|---|---|
| Phase 1 | Core infrastructure: Docker Compose stack, database schema/migrations, auth, base NestJS + Next.js scaffolding |
| Phase 2 | Scraper engine: implement all 9 provider scrapers and the normalize/validate/English-filter/dedupe/store pipeline, integrate with BullMQ |
| Phase 3 | Core product features: Dashboard, Search, Course Detail, Favorites, History, Source Management UI |
| Phase 4 | Analytics, hardening (security review, rate limiting, logging), full test coverage, polish and documentation |

*(Exact phase boundaries and timelines to be refined during sprint planning; this reflects the logical build order implied by system dependencies — infrastructure and data model must precede the scraper, which must precede the user-facing catalog features.)*

---

## 18. Success Criteria

The system will be considered production-ready for its localhost scope when:

1. All 9 sources can be scraped end-to-end with correct English-only, free-only filtering and cross-source deduplication.
2. A user can log in, search/browse the live catalog, favorite courses, and view history without errors.
3. Source Management allows full operational control (enable/disable/test/manual scrape/retry/logs/stats) without requiring a redeploy.
4. `docker compose up -d` brings up the entire stack with no manual intervention beyond `.env` configuration.
5. Unit, integration, E2E, and scraper test suites pass, and Security requirements (Section 14) are verifiably implemented.

---

## 19. Open Questions / Items for Clarification

- Exact deduplication key strategy across sources (Udemy course ID vs. normalized title matching) needs confirmation, since different coupon sites may format/obfuscate the underlying Udemy URL differently.
- Scrape scheduling cadence (e.g., every X minutes) is not yet specified and should be defined given coupon expiry windows are often short.
- Multi-user support is currently single-account by implication (Section 3) but the `users` table and JWT auth imply the schema already supports more than one account — confirm whether multi-user is in scope for Phase 1 or deferred.
- Category taxonomy source (fixed list vs. derived from scraped data) is not defined.
