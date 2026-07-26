# Udemy Course Finder — Production Requirement Document

**Version:** 1.0  
**Author:** Akai  
**License:** MIT  
**Last Updated:** 2026-07-27

---

## 1. Executive Summary

Udemy Course Finder is a self-hosted, full-stack application that continuously discovers 100%-free Udemy courses by scraping 10 coupon aggregator websites. Scraped data flows through a 6-stage normalization pipeline, is deduplicated, stored in PostgreSQL, and served through a REST API to a modern Next.js dashboard with AI-powered semantic search.

**Core value:** Replaces manual browsing of 10+ ad-heavy coupon sites with a single, clean, searchable interface that updates automatically.

---

## 2. System Architecture

### 2.1 High-Level Overview

```
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
                              ┌─────┴─────────┴─────────┴───┐
                              │   Python 3.12 Scraper Engine │
                              │   (10 Provider Scrapers)     │
                              └──────────────────────────────┘
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
| `GET` | `/courses` | JWT | Paginated course listing with filters |
| `GET` | `/courses/search` | JWT | Full-text search with pagination |
| `GET` | `/courses/search/semantic` | JWT | AI-powered semantic search (pgvector) |
| `GET` | `/courses/stats` | JWT | Course statistics (total, active, expiring) |
| `GET` | `/courses/recommendations` | JWT | Personalized recommendations from history |
| `GET` | `/courses/:id` | JWT | Single course details |
| `GET` | `/courses/:id/similar` | JWT | Similar courses (vector similarity) |

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

The scraper is a standalone Python process that:

1. **Connects** to Redis and PostgreSQL on startup
2. **Listens** for BullMQ jobs on the `scrape-queue` queue
3. **Runs a scheduler** thread that enqueues `scrape-all` jobs at a configurable interval (default: 30 min)
4. **Processes jobs** through the 6-stage pipeline

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
| `/courses` | Courses | Browse, search, filter courses |
| `/favorites` | Favorites | User's saved courses |
| `/history` | History | Browsing history |
| `/analytics` | Analytics | Charts and statistics |
| `/sources` | Sources | Provider management (scraper status, logs) |
| `/settings` | Settings | App settings, notification prefs |
| `/admin` | Admin | User management (RBAC, Admin only) |

### 8.2 Key Frontend Features

- **Authentication:** JWT stored in localStorage, auto-refresh on 401 via Axios interceptor
- **Dark Mode:** System/manual toggle via `next-themes`
- **Mobile Responsive:** Drawer navigation for mobile viewports
- **Semantic Search:** Toggle between full-text and AI-powered vector search
- **Real-time Notifications:** Bell icon with unread count badge
- **Course Cards:** Thumbnail, title, instructor, rating, category, expiry countdown, favorite toggle
- **Analytics Charts:** Time-series (courses/day), category breakdown (pie), provider comparison (bar)
- **Provider Management:** Enable/disable, trigger scrape, test connectivity, view logs with stats

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
| HTTP Headers | Helmet middleware (CSP, HSTS, X-Frame-Options, etc.) |
| CORS | Localhost auto-allowed; configurable via `CORS_ORIGIN` |
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
| `LOG_LEVEL` | No | `INFO` | Python logging level |
| `MAX_RETRIES` | No | `3` | HTTP retry count |
| `DEFAULT_TIMEOUT_MS` | No | `30000` | HTTP timeout (ms) |
| **Backend** ||||
| `BACKEND_PORT` | No | `4000` | API server port |
| `NODE_ENV` | No | `development` | `development` for pretty logs, `production` for JSON |
| `CORS_ORIGIN` | No | `http://localhost:3001` | Allowed CORS origins (comma-separated) |
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

---

## 14. Project Structure

```
udemy-course-finder/
├── backend/                        # NestJS API server
│   ├── src/
│   │   ├── main.ts                 # Bootstrap: Swagger, CORS, Helmet, Pipes, Filters
│   │   ├── app.module.ts           # Root module: all imports + global guards
│   │   ├── auth/                   # JWT auth, Argon2 hashing, token blacklist
│   │   ├── courses/                # Course CRUD, search, semantic search, recommendations
│   │   ├── providers/              # Provider management, scrape triggers
│   │   ├── favorites/              # User favorites CRUD
│   │   ├── history/                # Browsing history tracking
│   │   ├── analytics/              # Dashboard analytics (overview, time-series)
│   │   ├── categories/             # 13 course categories
│   │   ├── jobs/                   # BullMQ job scheduling
│   │   ├── embeddings/             # HuggingFace vector embeddings (384-dim)
│   │   ├── notifications/          # In-app notifications + preferences
│   │   ├── users/                  # Admin user management (RBAC)
│   │   ├── settings/               # App settings (key-value)
│   │   ├── prisma/                 # Prisma service module
│   │   ├── config/                 # ConfigModule setup
│   │   └── common/                 # Guards, filters, decorators, cache, logger
│   ├── prisma/
│   │   ├── schema.prisma           # PostgreSQL schema (with pgvector)
│   │   ├── schema.sqlite.prisma    # SQLite schema (local dev)
│   │   ├── seed.ts                 # Seed: admin, 10 providers, 13 categories, 10 courses
│   │   └── migrations/             # Prisma migrations
│   ├── test/                       # E2E tests
│   ├── Dockerfile                  # Multi-stage Node 20 build
│   └── package.json
├── frontend/                       # Next.js 16 dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout: fonts, theme, query provider
│   │   │   ├── page.tsx            # Root redirect to /dashboard
│   │   │   ├── globals.css         # TailwindCSS theme + custom styles
│   │   │   ├── login/              # Login page
│   │   │   ├── register/           # Registration page
│   │   │   └── (dashboard)/        # Protected routes group
│   │   │       ├── layout.tsx      # Sidebar + topbar shell
│   │   │       ├── dashboard/      # Overview dashboard
│   │   │       ├── courses/        # Course browse + search
│   │   │       ├── favorites/      # Saved courses
│   │   │       ├── history/        # Browsing history
│   │   │       ├── analytics/      # Charts + statistics
│   │   │       ├── sources/        # Provider management
│   │   │       ├── settings/       # App settings
│   │   │       └── admin/          # User management (Admin)
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn/ui primitives (button, card, dialog, etc.)
│   │   │   ├── layout/             # Sidebar, topbar, mobile drawer
│   │   │   ├── courses/            # Course card, grid, search bar
│   │   │   ├── analytics/          # Chart components (Recharts)
│   │   │   ├── providers/          # Provider card, status, logs
│   │   │   └── shared/             # Shared components (pagination, loading, etc.)
│   │   └── lib/
│   │       ├── api-client.ts       # Axios client with JWT interceptors
│   │       ├── hooks/              # React Query hooks
│   │       └── utils.ts            # Utility functions
│   ├── public/                     # Static assets
│   ├── Dockerfile                  # 3-stage Alpine build (standalone output)
│   ├── next.config.ts              # Standalone output, remote images
│   └── package.json
├── scraper/                        # Python scraping worker
│   ├── src/
│   │   ├── main.py                 # ScraperEngine: orchestrator, scheduler, job handler
│   │   ├── config.py               # Typed Config dataclass from environment
│   │   ├── db.py                   # PostgreSQL connection pool (psycopg2) + SQLite fallback
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
│   │   │   ├── store.py            # Stage 5: Upsert to PostgreSQL
│   │   │   └── expiry_validator.py # Stage 6: Verify coupon URL liveness
│   │   ├── utils/
│   │   │   ├── http_client.py      # requests-based HTTP client with retry + proxy
│   │   │   ├── url_parser.py       # Udemy URL parsing + course ID extraction
│   │   │   └── logging.py          # Structured logging setup
│   │   └── scripts/                # One-off utility scripts
│   ├── tests/                      # pytest test suite
│   ├── Dockerfile                  # Python 3.12-slim single-stage
│   └── requirements.txt
├── docker-compose.yml              # Production orchestration (5 containers)
├── docker-compose.override.yml     # Dev mode (hot reload, volume mounts)
├── .env.example                    # Environment template
├── .gitignore
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

*Built by ABDURRAHMAN for lifelong learners.*
