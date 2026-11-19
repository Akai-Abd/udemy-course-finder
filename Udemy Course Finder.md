# Udemy Course Finder — Production Requirement Document

**Version:** 1.0.5  
**Author:** Akai  
**License:** MIT  
**Last Updated:** 2026-11-19  
**Git Head:** `9346384` (`main`)

---

## 1. Executive Summary

Udemy Course Finder is a self-hosted, full-stack application that continuously discovers 100%-free Udemy courses by scraping 10 coupon aggregator websites. Scraped data flows through a 6-stage normalization pipeline, is deduplicated, stored in PostgreSQL/SQLite, and served through a REST API to a modern Next.js dashboard with AI-powered semantic search, complemented by a Chromium/Firefox browser extension assistant for 1-click batch enrollment and automated zero-cost scraping via GitHub Actions.

**Core value:** Replaces manual browsing of 10+ ad-heavy coupon sites with a single, clean, searchable interface that updates automatically and enrolls in courses with one click.

---

## 2. System Architecture

### 2.1 High-Level Overview

```
┌──────────────────────┐
│  Browser Extension   │ (1-Click Batch Enrollment & Tab Orchestrator)
│  (Chromium / Firefox)│
└──────────┬───────────┘
           │ Direct / REST
           ▼
┌──────────────┐      REST/JSON       ┌──────────────────┐
│  Next.js 16  │◄────────────────────►│   NestJS 11      │
│  Frontend    │                      │   Backend API    │
│  (Port 3000) │                      │   (Port 4000)    │
└──────────────┘                      └────────┬─────────┘
                                               │
                                    ┌──────────┼──────────┐
                                    │          │          │
                              ┌─────▼────┐ ┌──▼───┐ ┌───▼────────┐
                              │PostgreSQL│ │Redis │ │ BullMQ     │
                              │16+pgvec  │ │  7   │ │ Job Queue  │
                              └─────▲────┘ └──▲───┘ └───▲────────┘
                                    │         │         │
                ┌───────────────────┴─────────┴─────────┴───┐
                │        Python 3.12 Scraper Engine         │
                │  - Parallel Standalone Runner (5 workers)  │
                │  - BullMQ Redis Queue Consumer             │
                │  - GitHub Actions 12h Cron Automation      │
                └───────────────────▲───────────────────────┘
                                    │ HTTP
                                    ▼
                         ┌─────────────────────┐
                         │ 10 Coupon Providers │
                         └─────────────────────┘
```

### 2.2 Container Topology (Docker Compose)

| Container        | Image / Build Context | Exposed Port | Internal Port |
|------------------|-----------------------|--------------|---------------|
| `ucf-postgres`   | `pgvector/pgvector:pg16` | 5433 | 5432 |
| `ucf-redis`      | `redis:7-alpine`      | 6380         | 6379          |
| `ucf-backend`    | `./backend` (multi-stage Node 20) | 4001 | 4000 |
| `ucf-frontend`   | `./frontend` (multi-stage Node 20 Alpine) | 3001 | 3000 |
| `ucf-scraper`    | `./scraper` (Python 3.12-slim) | — | — |

**Optional dev containers** (commented out in compose):
- pgAdmin 4 (port 5050)
- Redis Commander (port 8081)

### 2.3 Data Flow

```
Backend enqueues job → Redis BullMQ queue
                         ↓
Python Scraper Worker consumes job
                         ↓
Provider scraper fetches coupon site HTML/JSON
                         ↓
Pipeline Stage 1: Normalize (clean titles, extract URLs, parse metadata)
Pipeline Stage 2: Validate (required fields, URL format, Udemy domain)
Pipeline Stage 3: Language Filter (langdetect → English only)
Pipeline Stage 4: Deduplicate (by udemy_course_id, prefer richer metadata)
Pipeline Stage 5: Store (upsert courses + coupon_sources to PostgreSQL)
                         ↓
Backend generates vector embeddings (HuggingFace, 384-dim)
                         ↓
Frontend fetches via REST API
```

---

## 3. Technology Stack

### 3.1 Frontend

| Concern | Technology | Version |
|---------|-----------|---------|
| Framework | Next.js (App Router, standalone output) | 16.2.10 |
| UI Library | React | 19.2.4 |
| Styling | TailwindCSS | 4.x |
| Component Library | shadcn/ui (Radix UI primitives) | — |
| State Management | Zustand | 5.x |
| Data Fetching | TanStack React Query | 5.x |
| HTTP Client | Axios | 1.x |
| Charts | Recharts | 3.x |
| Icons | Lucide React | 1.x |
| Theme | next-themes (dark mode) | 0.4.x |
| Toasts | Sonner | 2.x |
| TypeScript | TypeScript | 5.x |

### 3.2 Backend

| Concern | Technology | Version |
|---------|-----------|---------|
| Framework | NestJS | 11.x |
| ORM | Prisma (driver adapters) | 7.x |
| Auth | Passport JWT + @nestjs/jwt | — |
| Password Hashing | Argon2 | 0.44.x |
| Job Queue | BullMQ + @nestjs/bullmq | 5.x |
| Rate Limiting | @nestjs/throttler (100 req/60s) | 6.x |
| Logging | nestjs-pino + pino-pretty | — |
| API Docs | @nestjs/swagger + swagger-ui-express | — |
| Security | Helmet | 8.x |
| Validation | class-validator + class-transformer | — |
| Embeddings | @huggingface/transformers + onnxruntime-node | — |
| Database Adapters | @prisma/adapter-pg, @prisma/adapter-better-sqlite3 | — |

### 3.3 Scraper Engine

| Concern | Technology | Version |
|---------|-----------|---------|
| Language | Python | 3.12+ |
| HTTP | requests + fake-useragent | — |
| HTML Parsing | BeautifulSoup4 + lxml | — |
| Database | psycopg2-binary (PostgreSQL) | — |
| Queue | redis (BullMQ-compatible consumer) | 5.x |
| Language Detection | langdetect | 1.x |
| Environment | python-dotenv | 1.x |
| Testing | pytest | 8.x |

### 3.4 Infrastructure

| Concern | Technology | Version |
|---------|-----------|---------|
| Database | PostgreSQL + pgvector extension | 16 |
| Cache / Queue | Redis | 7 (Alpine) |
| Containerization | Docker + Docker Compose | — |
| Vector Dimensions | 384 (all-MiniLM-L6-v2) | — |

### 3.5 Browser Extension Assistant

| Concern | Technology | Version / Specification |
|---------|-----------|-------------------------|
| Platform | Chromium (Chrome, Edge, Brave) & Firefox | Manifest V3 |
| Extension APIs | `chrome.tabs`, `chrome.storage`, `chrome.scripting` | — |
| Automation | 1-click batch enrollment & multi-tab opening | Vanilla JS + HTML5 |
| Host Permissions | `https://www.udemy.com/*`, `http://localhost:4000/*`, `http://localhost:4001/*` | — |

### 3.6 CI/CD & Automation

| Concern | Technology | Version / Specification |
|---------|-----------|-------------------------|
| Orchestration | GitHub Actions (`.github/workflows/scrape.yml`) | — |
| Actions | `actions/checkout@v7`, `actions/setup-python@v7` | Node 24 runtime |
| Automation Trigger | Cron (`0 */12 * * *`) + `workflow_dispatch` manual trigger | Every 12 hours |
| Runtime | Python 3.12 with pip cache & PostgreSQL connection | — |

---

## 4. Database Schema

### 4.1 Entity-Relationship Summary

```
User ──< Favorite >── Course
User ──< History >── Course
User ──< Notification
User ──< NotificationPreference
User ──< PushSubscription

Course ──< CouponSource >── Provider
Course ── CourseEmbedding (1:1)
Course >── Category

Provider ──< Log
Setting (standalone key-value)
```

### 4.2 Tables and Enums

#### Enums

| Enum | Values |
|------|--------|
| `Role` | `ADMIN`, `USER` |
| `ProviderStatus` | `SUCCESS`, `FAILED`, `RUNNING`, `IDLE` |
| `LogStatus` | `SUCCESS`, `FAILED`, `RUNNING`, `CANCELLED` |
| `HistoryAction` | `VIEWED`, `CLICKED`, `ENROLLED` |
| `NotificationType` | `NEW_COURSES`, `EXPIRING_SOON`, `SYSTEM` |

#### Core Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id (UUID), email (unique), password_hash, role | Argon2-hashed passwords |
| `courses` | id (UUID), title, udemy_url, udemy_course_id (unique), category_id, language, rating, instructor | Primary content entity |
| `providers` | id (UUID), name (unique), base_url, is_enabled, timeout_ms, last_status | 10 seeded providers |
| `coupon_sources` | id, course_id, provider_id, coupon_url, is_free, expires_at, is_active | Unique per (course, provider) |
| `categories` | id, name (unique), slug (unique) | 13 seeded categories |
| `favorites` | id, user_id, course_id | Unique per (user, course) |
| `history` | id, user_id, course_id, action | Tracks VIEWED/CLICKED/ENROLLED |
| `logs` | id, provider_id, job_id, status, courses_found/accepted/rejected | Scraper run audit trail |
| `settings` | id, key (unique), value | App-level key-value config |
| `course_embeddings` | course_id (PK), embedding (vector(384)) | pgvector for semantic search |
| `notifications` | id, user_id, type, title, message, is_read | In-app notifications |
| `notification_preferences` | id, user_id (unique), on_new_courses, on_expiring_soon | Per-user prefs |
| `push_subscriptions` | id, user_id, endpoint (unique), keys (JSON) | Web Push subscriptions |

#### Indexes

| Table | Index | Columns |
|-------|-------|---------|
| `courses` | `idx_language` | language |
| `courses` | `idx_category` | category_id |
| `courses` | `idx_created_at` | created_at |
| `coupon_sources` | `idx_source_active_expiry` | is_active, expires_at |
| `coupon_sources` | `idx_source_provider` | provider_id |
| `history` | `idx_user_history` | user_id, created_at |
| `logs` | `idx_provider_logs` | provider_id, started_at |
| `notifications` | `idx_user_notifications` | user_id, is_read, created_at |
| `push_subscriptions` | `idx_push_user` | user_id |

---

## 5. Backend Modules

### 5.1 Module Map

| Module | Responsibility |
|--------|---------------|
| `ConfigModule` | Loads environment variables via `@nestjs/config` |
| `PrismaModule` | Prisma client with driver adapters (pg or better-sqlite3) |
| `LoggerModule` | Pino structured logging (pretty in dev, JSON in prod) |
| `RedisCacheModule` | Redis connection + caching utilities |
| `AuthModule` | JWT login/logout/refresh, Argon2 hashing, Redis token blacklist |
| `UsersModule` | Admin RBAC, user listing, role updates, deletion |
| `CoursesModule` | CRUD, full-text search, semantic search, recommendations, stats |
| `ProvidersModule` | Provider management, scrape triggers, logs, stats |
| `FavoritesModule` | User favorites CRUD |
| `HistoryModule` | Browsing history tracking (VIEWED, CLICKED, ENROLLED) |
| `AnalyticsModule` | Overview stats, time-series data for charts |
| `CategoriesModule` | 13 seeded course categories |
| `JobsModule` | BullMQ queue management, scheduled scraping |
| `EmbeddingsModule` | HuggingFace transformer embeddings (all-MiniLM-L6-v2, 384-dim) |
| `SettingsModule` | Key-value app settings (e.g., proxies) |
| `NotificationsModule` | In-app notifications, preferences, push subscriptions |

### 5.2 Global Guards and Pipes

| Guard/Pipe | Scope | Behavior |
|------------|-------|----------|
| `JwtAuthGuard` | Global (APP_GUARD) | All routes require JWT unless decorated with `@Public()` |
| `ThrottlerGuard` | Global (APP_GUARD) | 100 requests per 60 seconds per IP |
| `ValidationPipe` | Global | Whitelist + forbidNonWhitelisted + transform |
| `GlobalExceptionFilter` | Global | Catches unhandled exceptions with structured error response |
| `Helmet` | Middleware | HTTP security headers |

---

## 6. REST API Specification

**Base URL:** `http://localhost:4000` (dev) / `http://localhost:4001` (Docker)  
**Swagger Docs:** `/api`  
**CORS:** Enforces `CORS_ORIGIN` allowlist in production, dynamically supports `*.vercel.app` subdomains, and permits all origins in development (`origin.endsWith('.vercel.app') || !origin || allowedOrigins.includes(origin) || NODE_ENV !== 'production'`)

### 6.1 Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/login` | Public | Login with email/password → accessToken + refreshToken |
| `POST` | `/auth/register` | Public | Register new user |
| `POST` | `/auth/refresh` | Public | Refresh expired access token |
| `POST` | `/auth/logout` | JWT | Logout + blacklist refresh token in Redis |
| `PATCH` | `/auth/password` | JWT | Change password (current + new) |

### 6.2 Courses (`/courses`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/courses` | JWT | Paginated course listing with filters (`categoryId`, `providerId`, `sortBy`, `expiryStatus`, `language`, `timeRange=today\|24h\|all`) |
| `GET` | `/courses/search` | JWT | Full-text search with pagination & filters |
| `GET` | `/courses/search/semantic` | JWT | AI-powered semantic search (pgvector) |
| `GET` | `/courses/recommendations` | JWT | Personalized recommendations from history |
| `GET` | `/courses/export` | JWT | Export courses as CSV or JSON (query: `format`, `type`) |
| `GET` | `/courses/stats` | JWT | Course statistics (total, active, expiring) |
| `GET` | `/courses/:id` | JWT | Single course details |
| `GET` | `/courses/:id/similar` | JWT | Similar courses (vector similarity) |
| `POST` | `/courses/:id/report-expired` | JWT | Report an expired/exhausted coupon (marks coupon source inactive immediately) |

### 6.3 Providers (`/providers`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/providers` | JWT | List all providers with status |
| `PATCH` | `/providers/:id` | JWT/Admin | Update provider (enable/disable, timeout) |
| `POST` | `/providers/scrape` | JWT/Admin | Trigger scrape (all or specific provider) |
| `POST` | `/providers/:id/test` | JWT/Admin | Test provider connectivity |
| `POST` | `/providers/:id/retry` | JWT/Admin | Retry failed provider |
| `GET` | `/providers/:id/logs` | JWT | Paginated scraper logs for provider |
| `GET` | `/providers/:id/stats` | JWT | Provider scraping statistics |

### 6.4 Favorites (`/favorites`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/favorites` | JWT | List user's favorites |
| `POST` | `/favorites` | JWT | Add course to favorites |
| `DELETE` | `/favorites/:courseId` | JWT | Remove course from favorites |

### 6.5 History (`/history`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/history` | JWT | Paginated browsing history |
| `POST` | `/history` | JWT | Record action (VIEWED/CLICKED/ENROLLED) |
| `DELETE` | `/history` | JWT | Clear all history |

### 6.6 Analytics (`/analytics`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/analytics/overview` | JWT | Total courses, providers, success rate, breakdowns |
| `GET` | `/analytics/time-series` | JWT | Courses/day, scraping runs/day (configurable days) |

### 6.7 Other Endpoints

| Module | Method | Path | Description |
|--------|--------|------|-------------|
| Categories | `GET` | `/categories` | List 13 course categories |
| Settings | `GET` | `/settings/:key` | Read app setting |
| Settings | `PATCH` | `/settings/:key` | Update app setting (Admin) |
| Users | `GET` | `/users` | List all users (Admin) |
| Users | `PATCH` | `/users/:id/role` | Change user role (Admin) |
| Users | `DELETE` | `/users/:id` | Delete user (Admin) |
| Notifications | `GET` | `/notifications` | Paginated notifications |
| Notifications | `GET` | `/notifications/unread-count` | Unread notification count |
| Notifications | `PATCH` | `/notifications/:id/read` | Mark notification read |
| Notifications | `PATCH` | `/notifications/read-all` | Mark all read |
| Notifications | `DELETE` | `/notifications/:id` | Delete notification |
| Notifications | `GET` | `/notifications/preferences` | Get notification prefs |
| Notifications | `PATCH` | `/notifications/preferences` | Update notification prefs |

---

## 7. Scraper Engine

### 7.1 Architecture

The scraper engine supports two execution modes:

1. **Queue Worker (`src/main.py`)**:
   - Connects to Redis and PostgreSQL on startup
   - Listens for BullMQ jobs on the `scrape-queue` queue
   - Runs a scheduler thread that enqueues `scrape-all` jobs at a configurable interval (default: 30 min)
   - Processes jobs through the 6-stage pipeline

2. **Standalone Runner (`run_all.py`)**:
   - Direct Python execution without requiring Redis or BullMQ
   - Concurrent parallel scraping across all 10 providers using `ThreadPoolExecutor(max_workers=5)` for 5x–10x faster execution
   - Thread-safe persistence with SQLite busy timeout protection (`timeout=30.0`) and PostgreSQL DSN URL connection pooling
   - Invoked directly from CLI (`python scraper/run_all.py`), auto-triggered every 30m by NestJS `jobs.service.ts` in standalone mode (`ENABLE_REDIS=false`), or executed via automated 12-hour cron workflow in GitHub Actions (`.github/workflows/scrape.yml`)

### 7.2 Job Types

| Job Name | Trigger | Action |
|----------|---------|--------|
| `scrape-all` | Scheduler (cron) or admin trigger | Scrape all enabled providers sequentially |
| `scrape-single` | Admin trigger (by provider ID or name) | Scrape a single provider |
| `test-provider` | Admin UI "Test" button | Test connectivity (HTTP GET to base URL) |
| `validate-active-courses` | Manual/scheduled | Verify active coupon URLs, mark expired as inactive |

### 7.3 BullMQ-Compatible Queue Protocol

The Python consumer implements BullMQ's Redis data structures:

- `bull:scrape-queue:wait` — BLMOVE to consume jobs
- `bull:scrape-queue:active` — jobs being processed
- `bull:scrape-queue:completed` — finished jobs (sorted set)
- `bull:scrape-queue:failed` — failed jobs (sorted set)
- `bull:scrape-queue:<job-id>` — job data (Redis hash)

### 7.4 Supported Providers (10)

| # | Provider | Class | Base URL |
|---|----------|-------|----------|
| 1 | Real Discount | `RealDiscountScraper` | `real.discount` |
| 2 | Courson | `CoursonScraper` | `courson.xyz` |
| 3 | E-next | `EnextScraper` | `e-next.in` |
| 4 | iDownloadCoupons | `IDownloadCouponsScraper` | `idownloadcoupon.com` |
| 5 | DiscUdemy | `DiscUdemyScraper` | `discudemy.com` |
| 6 | Udemy Freebies | `UdemyFreebiesScraper` | `udemyfreebies.com` |
| 7 | Coupon Scorpion | `CouponScorpionScraper` | `couponscorpion.com` |
| 8 | CourseJoiner | `CourseJoinerScraper` | `coursejoiner.com` |
| 9 | FreeWebCart | `FreeWebCartScraper` | `freewebcart.com` |
| 10 | Freebies Global | `FreebiesGlobalScraper` | `freebiesglobal.com` |

All scrapers extend `BaseScraper` which provides:
- Shared `HttpClient` with timeout, retry, delay, and proxy rotation
- `_fetch_page()` → BeautifulSoup parsed HTML
- `_fetch_json()` → JSON API response
- `_extract_course_id_from_url()` → Udemy course ID extraction
- `test_connectivity()` → HTTP GET health check
- `_make_course()` → `ScrapedCourse` factory with provider name pre-filled

### 7.5 Pipeline Stages

| Stage | Module | Input | Output | Purpose |
|-------|--------|-------|--------|---------|
| 1. Normalize | `normalizer.py` | Raw `ScrapedCourse[]` | Cleaned `ScrapedCourse[]` | Clean titles, extract/normalize Udemy URLs, parse course IDs, trim whitespace |
| 2. Validate | `validator.py` | Normalized courses | (valid[], rejected[]) | Check required fields (title + URL), validate URL format |
| 3. Language Filter | `language_filter.py` | Valid courses | (english[], rejected[]) | langdetect on title/description, keep English only |
| 4. Deduplicate | `deduplicator.py` | English courses | Unique courses | Group by `udemy_course_id`, keep record with highest `metadata_richness()` score |
| 5. Store | `store.py` | Deduplicated courses | count stored | Upsert courses + coupon_sources to PostgreSQL, create log entries |
| 6. Expiry Validation | `expiry_validator.py` | Active coupon_sources | validation result | HTTP HEAD/GET to Udemy coupon URLs, mark expired as `is_active=false` |

### 7.6 Data Model

```python
@dataclass
class ScrapedCourse:
    title: str
    udemy_url: str
    coupon_url: str
    udemy_course_id: str | None
    provider_name: str
    category: str | None
    language: str | None
    thumbnail_url: str | None
    rating: float | None
    instructor: str | None
    price_original: float | None
    is_free: bool = True
    expires_at: datetime | None
    description: str | None
```

### 7.7 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Required | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `SCRAPE_INTERVAL_MINUTES` | `30` | Auto-scrape frequency |
| `SCRAPE_DELAY_SECONDS` | `2` | Delay between HTTP requests |
| `VALIDATE_URLS` | `true` | Enable URL validation |
| `MAX_RETRIES` | `3` | HTTP request retry count |
| `DEFAULT_TIMEOUT_MS` | `30000` | HTTP timeout per request |
| `VALIDATE_BATCH_SIZE` | `50` | Coupon validation batch size |
| `LOG_LEVEL` | `INFO` | Python logging level |

---

## 8. Frontend Pages

### 8.1 Route Structure (App Router)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Redirect | Redirects to `/dashboard` |
| `/login` | Login | Email/password login form |
| `/register` | Register | New user registration |
| `/dashboard` | Dashboard | Overview stats, recent courses |
| `/courses` | Courses | Browse, search, filter, export courses |
| `/courses/:id` | Course Detail | Single course detail with similar courses |
| `/favorites` | Favorites | User's saved courses |
| `/history` | History | Browsing history |
| `/analytics` | Analytics | Charts and statistics |
| `/sources` | Sources | Provider management (scraper status, logs) |
| `/settings` | Settings | App settings, notification prefs |
| `/admin/users` | Admin Users | User management (RBAC, Admin only) |

### 8.2 Key Frontend Features

- **Authentication:** JWT stored in localStorage, auto-refresh on 401 via Axios interceptor
- **Dark Mode:** System/manual toggle via `next-themes`
- **Mobile Responsive:** Drawer navigation for mobile viewports
- **Semantic Search:** Toggle between full-text and AI-powered vector search
- **Real-time Notifications:** Bell icon with unread count badge
- **Course Cards:** Thumbnail, title, instructor, rating, category, expiry countdown, favorite toggle, visual `OPENED` badge with `Open Again` action button, and community **Report Expired** flag button (`POST /courses/:id/report-expired`) to instantly deactivate broken coupons
- **Course Detail Page:** Single-course view with similar course recommendations
- **Course Export:** Download courses as CSV or JSON (all or favorites)
- **Course Filters:** Category, provider, expiry status, language filters, 1-click **Hide Opened** toolbar toggle, and discovery time-range filter (**Today Only**, **Past 24 Hours**, **All Time**)
- **Enrolled / Click Tracking:** Optimistic UI state tracking so clicked/enrolled courses immediately dim and show `OPENED` status
- **Grid/List View Toggle:** Switch between grid and compact list view modes
- **Analytics Charts:** Time-series (courses/day), category breakdown (pie), provider comparison (bar)
- **Provider Management:** Enable/disable, trigger scrape, test connectivity, view logs with stats

### 8.3 Browser Extension Assistant (`extension/`)

- **Cross-Browser Support:** Manifest V3 extension compatible with Google Chrome, Brave, Microsoft Edge, and Mozilla Firefox
- **Active Session Reuse:** Leverages the user's active `udemy.com` browser session directly—no user credentials or API tokens stored
- **1-Click Auto-Enroll All:** Automatically opens coupon tabs in the background, triggers 100% free coupon redemption, and closes tabs upon successful enrollment
- **Batch Tab Launcher:** Opens up to 15 untouched course links at once in background tabs
- **Live Local/Cloud Sync:** Syncs freshly discovered coupons directly with local (`localhost:4000`) or cloud-deployed API instances

---

## 9. Authentication & Security

### 9.1 Authentication Flow

```
Login (email + password)
  → Argon2 verify password hash
  → Generate access token (JWT, 15m expiry)
  → Generate refresh token (JWT, 7d expiry)
  → Return both tokens

Refresh
  → Verify refresh token
  → Generate new access + refresh tokens
  → Return new tokens

Logout
  → Blacklist refresh token in Redis
```

### 9.2 Security Measures

| Measure | Implementation |
|---------|---------------|
| Password Hashing | Argon2 (memory-hard, brute-force resistant) |
| JWT Signing | Separate secrets for access and refresh tokens (≥32 chars) |
| Token Blacklist | Refresh tokens blacklisted in Redis on logout |
| Rate Limiting | 100 requests per 60 seconds per IP (ThrottlerGuard) |
| Input Validation | class-validator whitelist + forbidNonWhitelisted |
| HTTP Headers | Helmet middleware (crossOriginResourcePolicy: cross-origin) |
| CORS | Production allowlist via `CORS_ORIGIN` + dynamic `*.vercel.app` matching (`credentials: true`), permissive in dev |
| Role-Based Access | `@Roles(Role.ADMIN)` decorator for admin-only endpoints |

---

## 10. Deployment

### 10.1 Production Deployment (Docker Compose)

```bash
# 1. Clone repository
git clone https://github.com/Akai-Abd/udemy-course-finder.git
cd udemy-course-finder

# 2. Configure environment
cp .env.example .env
# Edit: POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET

# 3. Start all services
docker compose up -d

# 4. Verify
docker compose ps
# Frontend:  http://localhost:3001
# Backend:   http://localhost:4001
# Swagger:   http://localhost:4001/api
```

### 10.2 Build Details

**Backend (multi-stage):**
1. `builder` stage: `node:20-slim`, `npm ci`, `prisma generate`, `npm run build`, prune dev deps, strip unused ONNX runtime binaries (win32, darwin, arm64, CUDA, TensorRT)
2. `runner` stage: `node:20-slim`, copy dist + node_modules + prisma, runs `prisma migrate deploy` + `prisma db seed` + `node dist/src/main.js`

**Frontend (3-stage):**
1. `deps` stage: `node:20-alpine`, `npm ci --ignore-scripts`
2. `builder` stage: Copy node_modules, `npm run build` (standalone output)
3. `runner` stage: `node:20-alpine`, non-root user (`nextjs:nodejs`), copy standalone + static, `node server.js`

**Scraper:**
1. Single stage: `python:3.12-slim`, `pip install --no-cache-dir`, `python -m src.main`

### 10.3 Development Mode (Docker)

`docker-compose.override.yml` provides:
- Backend: hot-reload (`npm run start:dev`), volume-mounted source
- Frontend: hot-reload (`npm run dev`), watchpack polling for Docker
- Scraper: volume-mounted source, DEBUG logging

### 10.4 Local Development (No Docker)

```bash
# Backend (SQLite mode — no PostgreSQL/Redis required)
cd backend && npm install && npm run start:sqlite
# → API at http://localhost:4000, Swagger at http://localhost:4000/api

# Frontend
cd frontend && npm install && npm run dev
# → Dashboard at http://localhost:3000
```

**Default admin credentials:** `admin@localhost.local` / `ChangeMe123!`

---

## 11. Environment Variables

### 11.1 Complete Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| **Database** ||||
| `POSTGRES_USER` | Yes | `udemy_finder` | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | — | PostgreSQL password (**must change**) |
| `POSTGRES_DB` | Yes | `udemy_finder` | PostgreSQL database name |
| `DATABASE_URL` | Auto | Composed from above | Full connection string |
| **Redis** ||||
| `REDIS_HOST` | No | `redis` | Redis hostname |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_URL` | No | `redis://redis:6379` | Redis connection string |
| **JWT** ||||
| `JWT_SECRET` | Yes | — | Access token signing key (≥32 chars, **must change**) |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh token signing key (**must change**) |
| `JWT_EXPIRY` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token lifetime |
| **Admin** ||||
| `DEFAULT_ADMIN_EMAIL` | No | `admin@localhost.local` | Initial admin email |
| `DEFAULT_ADMIN_PASSWORD` | No | `ChangeMe123!` | Initial admin password |
| **Scraper** ||||
| `SCRAPE_INTERVAL_MINUTES` | No | `30` | Auto-scrape frequency |
| `SCRAPE_DELAY_SECONDS` | No | `2` | Delay between HTTP requests |
| `VALIDATE_URLS` | No | `true` | Enable URL validation |
| `VALIDATE_INTERVAL_MINUTES` | No | `60` | Coupon URL validation frequency (minutes) |
| `LOG_LEVEL` | No | `INFO` | Python logging level |
| `MAX_RETRIES` | No | `3` | HTTP retry count |
| `DEFAULT_TIMEOUT_MS` | No | `30000` | HTTP timeout (ms) |
| **Backend** ||||
| `BACKEND_PORT` | No | `4000` | API server port |
| `NODE_ENV` | No | `development` | `development` for pretty logs, `production` for JSON |
| `ENABLE_REDIS` | No | — | Set to `false` for standalone SQLite mode (disables BullMQ) |
| **Frontend** ||||
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:4000` | Backend API URL |

---

## 12. Seed Data

On first startup, `prisma db seed` creates:

| Entity | Count | Details |
|--------|-------|---------|
| Admin User | 1 | `admin@localhost.local` with ADMIN role |
| Providers | 10 | All enabled, with initial SUCCESS log entries |
| Categories | 13 | Matching Udemy's official categories |
| Sample Courses | 10 | Across 4 categories, each with a coupon source (5-day expiry) |

**Seeded Categories:** Development, Business, Finance & Accounting, IT & Software, Office Productivity, Personal Development, Design, Marketing, Lifestyle, Photography & Video, Health & Fitness, Music, Teaching & Academics

---

## 13. Testing

| Component | Command | Framework |
|-----------|---------|-----------|
| Backend unit tests | `cd backend && npm test` | Jest |
| Backend coverage | `cd backend && npm run test:cov` | Jest |
| Backend E2E tests | `cd backend && npm run test:e2e` | Jest + Supertest |
| Scraper tests | `cd scraper && python -m pytest tests/ -v` | pytest |
| Frontend type check | `cd frontend && npx tsc --noEmit` | TypeScript |
| Frontend lint | `cd frontend && npm run lint` | ESLint |

### 13.1 Test File Inventory

**Backend Unit Tests (13 test suites, 83 passed tests):**
- `analytics.service.spec.ts` — Analytics calculation & time-series overview
- `providers.repository.spec.ts` — Provider repository data access
- `auth.service.spec.ts` — User authentication, JWT issuance & verification
- `jobs.service.spec.ts` — Scraper job scheduling, BullMQ queue & standalone runner
- `providers.service.spec.ts` — Provider status management & health checks
- `courses.repository.spec.ts` — Course queries, time-range filtering & expiry status
- `jwt-auth.guard.spec.ts` — JWT guard authentication & @Public() decorator bypass
- `global-exception.filter.spec.ts` — Global exception filter & error response formatting
- `courses.service.spec.ts` — Course business logic & coupon expiry reporting
- `users.service.spec.ts` — User role administration & user management
- `auth.controller.spec.ts` — Auth controller endpoints & DTO validation
- `history.service.spec.ts` — User browsing history actions & tracking
- `favorites.service.spec.ts` — User favorites CRUD operations

**Backend E2E Tests (6 test suites, 22 passed tests):**
- `app.e2e-spec.ts` — App bootstrap & API health check
- `auth.e2e-spec.ts` — Login, register, token refresh, and logout blacklist
- `courses.e2e-spec.ts` — Course catalog listing, search, filtering, and expiry reporting
- `favorites.e2e-spec.ts` — Favorites add, list, and removal CRUD
- `history.e2e-spec.ts` — History recording (VIEWED/CLICKED/ENROLLED) & clear
- `providers.e2e-spec.ts` — Provider management, listing, and scrape triggers

**Scraper Tests:**
- `test_pipeline.py` — Full pipeline integration
- `test_providers.py` — Provider scraper classes
- `test_url_parser.py` — URL parsing + course ID extraction
- `test_language_filter.py` — Language detection filter
- `test_expiry_validator.py` — Coupon URL validation
- `test_store.py` — Database upsert logic

---

## 14. Project Structure

```
udemy-course-finder/
├── .github/                        # CI/CD workflows
│   └── workflows/
│       └── scrape.yml              # 12-hour automated course scraper cron (GitHub Actions)
├── backend/                        # NestJS API server
│   ├── src/
│   │   ├── main.ts                 # Bootstrap: Swagger, CORS allowlist, Helmet, Pipes, Filters
│   │   ├── app.module.ts           # Root module: all imports + global guards
│   │   ├── auth/                   # JWT auth, Argon2 hashing, token blacklist
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.controller.spec.ts
│   │   │   └── auth.service.spec.ts
│   │   ├── courses/                # Course CRUD, search, semantic search, expiry reporting
│   │   │   ├── courses.controller.ts
│   │   │   ├── courses.service.ts
│   │   │   ├── courses.repository.ts
│   │   │   ├── courses.module.ts
│   │   │   ├── courses.service.spec.ts
│   │   │   ├── courses.repository.spec.ts
│   │   │   └── dto/                # ListCoursesDto (timeRange, expiryStatus), SearchCoursesDto
│   │   ├── providers/              # Provider management, scrape triggers
│   │   │   ├── providers.service.spec.ts
│   │   │   └── providers.repository.spec.ts
│   │   ├── favorites/              # User favorites CRUD
│   │   │   └── favorites.service.spec.ts
│   │   ├── history/                # Browsing history tracking (VIEWED, CLICKED, ENROLLED)
│   │   │   └── history.service.spec.ts
│   │   ├── analytics/              # Dashboard analytics (overview, time-series)
│   │   │   └── analytics.service.spec.ts
│   │   ├── categories/             # 13 course categories
│   │   ├── jobs/                   # BullMQ job scheduling + standalone Python fallback
│   │   │   ├── jobs.module.ts
│   │   │   ├── jobs.service.ts
│   │   │   └── jobs.service.spec.ts
│   │   ├── embeddings/             # HuggingFace vector embeddings (384-dim)
│   │   ├── notifications/          # In-app notifications + preferences
│   │   ├── users/                  # Admin user management (RBAC)
│   │   │   └── users.service.spec.ts
│   │   ├── settings/               # App settings (key-value)
│   │   ├── prisma/                 # Prisma service module
│   │   ├── config/                 # ConfigModule setup
│   │   └── common/                 # Guards, filters, decorators, cache, logger
│   │       ├── cache/              # Redis cache module
│   │       ├── decorators/         # @Public(), @CurrentUser(), @Roles()
│   │       ├── filters/            # GlobalExceptionFilter (global-exception.filter.spec.ts)
│   │       ├── guards/             # JwtAuthGuard (jwt-auth.guard.spec.ts)
│   │       ├── helpers/            # active-filter.helper.ts
│   │       ├── interceptors/       # (reserved)
│   │       └── logger/             # Pino logger module
│   ├── prisma/
│   │   ├── schema.prisma           # PostgreSQL schema (with pgvector)
│   │   ├── schema.sqlite.prisma    # SQLite schema (local dev)
│   │   ├── seed.ts                 # Seed: admin, 10 providers, 13 categories, 10 courses
│   │   └── migrations/             # Prisma migrations
│   ├── test/                       # E2E test suites (6 spec files, 22 passed tests)
│   │   ├── app.e2e-spec.ts
│   │   ├── auth.e2e-spec.ts
│   │   ├── courses.e2e-spec.ts
│   │   ├── favorites.e2e-spec.ts
│   │   ├── history.e2e-spec.ts
│   │   └── providers.e2e-spec.ts
│   ├── Dockerfile                  # Multi-stage Node 20 build
│   └── package.json
├── frontend/                       # Next.js 16 dashboard
│   ├── src/
│   │   ├── proxy.ts                # Next.js middleware (public path allowlisting)
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout: fonts, theme, query provider
│   │   │   ├── page.tsx            # Root redirect to /dashboard
│   │   │   ├── globals.css         # TailwindCSS theme + custom styles
│   │   │   ├── icon.png            # App icon
│   │   │   ├── login/              # Login page
│   │   │   ├── register/           # Registration page
│   │   │   ├── api/                # API route directory stubs (empty)
│   │   │   └── (dashboard)/        # Protected routes group
│   │   │       ├── layout.tsx      # Sidebar + topbar shell
│   │   │       ├── dashboard/      # Overview dashboard
│   │   │       ├── courses/        # Course browse + search
│   │   │       │   ├── page.tsx    # Course catalog (grid/list, filters, time-range, export)
│   │   │       │   └── [id]/page.tsx # Course detail + similar courses
│   │   │       ├── favorites/      # Saved courses
│   │   │       ├── history/        # Browsing history
│   │   │       ├── analytics/      # Charts + statistics
│   │   │       ├── sources/        # Provider management
│   │   │       ├── settings/       # App settings
│   │   │       └── admin/users/    # User management (Admin RBAC)
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn/ui primitives (17 components)
│   │   │   │   ├── avatar.tsx, badge.tsx, button.tsx, card.tsx
│   │   │   │   ├── dialog.tsx, dropdown-menu.tsx, input.tsx, label.tsx
│   │   │   │   ├── scroll-area.tsx, select.tsx, separator.tsx, sheet.tsx
│   │   │   │   ├── skeleton.tsx, switch.tsx, table.tsx, tabs.tsx
│   │   │   │   └── tooltip.tsx
│   │   │   ├── layout/             # Sidebar, header, notification bell
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── header.tsx
│   │   │   │   └── notification-bell.tsx
│   │   │   ├── courses/            # Course card (expiry flag), filters, export button
│   │   │   │   ├── course-card.tsx
│   │   │   │   ├── course-filters.tsx
│   │   │   │   └── export-button.tsx
│   │   │   ├── analytics/          # Chart components (Recharts)
│   │   │   │   ├── time-series-chart.tsx
│   │   │   │   └── date-range-selector.tsx
│   │   │   ├── providers/          # Query provider (React Query)
│   │   │   │   └── query-provider.tsx
│   │   │   └── shared/             # Shared reusable components
│   │   │       ├── pagination.tsx
│   │   │       ├── loading-state.tsx
│   │   │       ├── empty-state.tsx
│   │   │       └── error-state.tsx
│   │   └── lib/
│   │       ├── api-client.ts       # Axios client with JWT interceptors + all API functions
│   │       ├── utils.ts            # cn() utility (clsx + tailwind-merge)
│   │       └── hooks/              # React Query hooks (8 hook files)
│   │           ├── use-auth.ts
│   │           ├── use-courses.ts
│   │           ├── use-favorites.ts
│   │           ├── use-history.ts
│   │           ├── use-analytics.ts
│   │           ├── use-providers.ts
│   │           ├── use-categories.ts
│   │           └── use-notifications.ts
│   ├── public/                     # Static assets
│   ├── Dockerfile                  # 3-stage Alpine build (standalone output)
│   ├── next.config.ts              # Standalone output, unoptimized images, remote patterns
│   └── package.json
├── extension/                      # Browser extension assistant (Manifest V3)
│   ├── manifest.json               # Extension configuration & host permissions
│   ├── popup.html                  # Extension UI popup
│   ├── popup.js                    # 1-click auto-enrollment & tab orchestration
│   ├── icon.png                    # Extension branding icon
│   └── README.md                   # Extension quick-start installation guide
├── scraper/                        # Python scraping worker
│   ├── run_all.py                  # Standalone parallel live scraper runner (10 providers, 5 workers)
│   ├── src/
│   │   ├── main.py                 # ScraperEngine: orchestrator, scheduler, job handler
│   │   ├── config.py               # Typed Config dataclass from environment
│   │   ├── db.py                   # Thread-safe PostgreSQL pool + SQLite fallback with busy timeout
│   │   ├── queue.py                # BullMQ-compatible Redis job consumer
│   │   ├── models.py               # ScrapedCourse + ScrapeResult dataclasses
│   │   ├── providers/
│   │   │   ├── __init__.py         # SCRAPER_REGISTRY + create_scraper() factory
│   │   │   ├── base.py             # BaseScraper ABC (shared HTTP, parsing, test)
│   │   │   ├── real_discount.py    # Real Discount scraper
│   │   │   ├── courson.py          # Courson scraper
│   │   │   ├── enext.py            # E-next scraper
│   │   │   ├── idownloadcoupons.py # iDownloadCoupons scraper
│   │   │   ├── discudemy.py        # DiscUdemy scraper
│   │   │   ├── udemy_freebies.py   # Udemy Freebies scraper
│   │   │   ├── coupon_scorpion.py  # Coupon Scorpion scraper
│   │   │   ├── course_joiner.py    # CourseJoiner scraper
│   │   │   ├── freewebcart.py      # FreeWebCart scraper
│   │   │   └── freebies_global.py  # Freebies Global scraper
│   │   ├── pipeline/
│   │   │   ├── normalizer.py       # Stage 1: Clean, normalize URLs, extract IDs
│   │   │   ├── validator.py        # Stage 2: Required fields + URL format
│   │   │   ├── language_filter.py  # Stage 3: langdetect English filter
│   │   │   ├── deduplicator.py     # Stage 4: Dedup by course ID, prefer richer
│   │   │   ├── store.py            # Stage 5: Upsert to PostgreSQL/SQLite
│   │   │   └── expiry_validator.py # Stage 6: Verify coupon URL liveness
│   │   ├── utils/
│   │   │   ├── http_client.py      # requests-based HTTP client with retry + proxy
│   │   │   ├── url_parser.py       # Udemy URL parsing + course ID extraction
│   │   │   └── logging.py          # Structured logging setup
│   │   └── scripts/
│   │       └── update_thumbnails.py # One-off thumbnail update utility
│   ├── tests/                      # pytest test suite (6 test files + fixtures)
│   │   ├── test_pipeline.py
│   │   ├── test_providers.py
│   │   ├── test_url_parser.py
│   │   ├── test_language_filter.py
│   │   ├── test_expiry_validator.py
│   │   ├── test_store.py
│   │   └── fixtures/
│   ├── Dockerfile                  # Python 3.12-slim single-stage
│   └── requirements.txt
├── docker-compose.yml              # Production orchestration (5 containers)
├── docker-compose.override.yml     # Dev mode (hot reload, volume mounts)
├── Deployment Strategy             # Detailed cloud production deployment guide
├── Free Deployment Strategy        # 100% free cloud deployment guide (Vercel + Koyeb + Supabase + GitHub Actions)
├── .env.example                    # Environment template
├── .gitignore
├── CHANGELOG.md                    # Release changelog (v1.0.2, v1.0.3, v1.0.4, v1.0.5)
├── LICENSE                         # MIT License
└── README.md                       # Project documentation
```

---

## 15. Operational Notes

### 15.1 Health Checks

| Service | Check | Interval |
|---------|-------|----------|
| PostgreSQL | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` | 10s |
| Redis | `redis-cli ping` | 10s |
| Scraper | `python -c "import redis; r = redis.Redis.from_url('redis://redis:6379'); r.ping()"` | 30s |

### 15.2 Startup Dependencies

```
PostgreSQL (healthy) ─┬─→ Backend
Redis (healthy)      ─┤
                      └─→ Scraper
Backend (started)    ──→ Frontend
```

### 15.3 Auto-Migration

On backend container startup, the `start.sh` script runs:
1. `prisma migrate deploy` — applies pending migrations
2. `prisma db seed` — seeds initial data (idempotent via upserts)
3. `node dist/src/main.js` — starts the API server

### 15.4 Logging

| Service | Format (Dev) | Format (Prod) |
|---------|-------------|---------------|
| Backend | pino-pretty (colored, human-readable) | JSON (structured) |
| Scraper | Python logging (configurable via `LOG_LEVEL`) | Same |
| Frontend | Next.js default console | Same |

### 15.5 Proxy Rotation

The scraper supports rotating HTTP proxies:
- Proxies stored in the `settings` table (key: `proxies`)
- Format: JSON array or newline-separated URLs
- Managed via Settings API or admin UI
- Applied to all scraper HTTP requests via `HttpClient`

---

## 16. Current Project Status

**Version:** 1.0.5 (released 2026-11-19)  
**Status:** Feature-complete, active development  
**Git branch:** `main` (commit `9346384`)

### 16.1 What Is Fully Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| Backend API (15 modules) | ✅ Complete | All endpoints functional, Swagger docs live, expiry reporting & time-range filters |
| Frontend Dashboard (10 pages) | ✅ Complete | All routes implemented with full UI, `OPENED` tracking, time-range filter, expiry report |
| Browser Extension (`extension/`) | ✅ Complete | Manifest V3 assistant for 1-click batch enrollment & multi-tab opening |
| Python Scraper (10 providers) | ✅ Complete | 6-stage pipeline, multi-threaded parallel runner (5 workers), SQLite timeout protection |
| GitHub Actions Automation | ✅ Complete | Scheduled 12-hour cron workflow (`.github/workflows/scrape.yml`) for zero-cost scraping |
| Database Schema (15 tables) | ✅ Complete | PostgreSQL + pgvector, SQLite fallback (`dev.db`), DSN connection string support |
| Docker Compose (5 containers) | ✅ Complete | Production + dev override configs |
| Authentication + RBAC | ✅ Complete | JWT, Argon2, refresh, blacklist, admin role, hardened CORS |
| Semantic Search (pgvector) | ✅ Complete | HuggingFace all-MiniLM-L6-v2 embeddings |
| Course Export (CSV/JSON) | ✅ Complete | All courses or favorites |
| Enrolled / Click Tracking | ✅ Complete | Visual `OPENED` tags, `Hide Opened` toolbar toggle, optimistic local history updates |
| Test Suites | ✅ Complete | 13 unit specs (83 passed tests), 6 E2E specs (22 passed tests), 6 pytest files |
| SQLite Standalone Mode | ✅ Complete | `ENABLE_REDIS=false` for local dev without Docker |

### 16.2 Known Issues / Technical Debt

| Issue | Severity | Details |
|-------|----------|--------|
| CORS domain allowlisting | Resolved | Enforces `CORS_ORIGIN` allowlist in production with dynamic `*.vercel.app` matching in `backend/src/main.ts` |
| Frontend `api/` route dirs empty | Info | Directory structure exists for Next.js App Router API route handlers if required |
| Scraper path resolution | Resolved | `jobs.service.ts` uses multi-candidate dynamic path search (`process.cwd()`, `__dirname`, etc.) |
| Scraper automation CI/CD | Resolved | Added `.github/workflows/scrape.yml` automated 12-hour cron workflow with Python 3.12 |
| Deployment strategies | Resolved | Documented complete architectures in `Free Deployment Strategy` and `Deployment Strategy` |

### 16.3 Deployment Architecture (Zero-Cost Cloud Deployment)

Documented and verified deployment architecture (see [`Free Deployment Strategy`](Free%20Deployment%20Strategy)):
- **Frontend:** [Vercel](https://vercel.com) (Next.js 16 native hosting, global edge CDN, auto-HTTPS)
- **Backend:** [Koyeb](https://koyeb.com) or [Render](https://render.com) (24/7 web service running NestJS 11)
- **Database:** [Supabase](https://supabase.com) or [Neon](https://neon.tech) (PostgreSQL 16 with pgvector extension)
- **Background Scraper:** [GitHub Actions](.github/workflows/scrape.yml) (Runs `scraper/run_all.py` on 12-hour cron)
- **Enrollment Automation:** [Browser Extension](extension/) (Direct batch enrollment from user's active browser)

---

*Built by ABDURRAHMAN for lifelong learners.*
