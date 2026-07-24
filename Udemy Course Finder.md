# Udemy Course Finder — Production Requirements Document

**Version:** 1.0  
**Author:** Abdurrahman  
**Date:** 2026-07-25  
**Status:** Active  
**License:** UNLICENSED — Personal use only

---

## 1. Executive Summary

Udemy Course Finder is a self-hosted, localhost-only application that continuously discovers 100% free Udemy courses by scraping 10 coupon aggregator websites. It normalizes, validates, deduplicates, and stores the results in a PostgreSQL database, then presents them through a modern dashboard with search, filtering, favorites, history tracking, analytics, and AI-powered semantic search.

The system runs entirely within Docker Compose and requires zero external paid services.

---

## 2. Problem Statement

Manually browsing multiple coupon aggregator websites to find free Udemy courses is:

- **Time-consuming** — requires visiting 10+ sites daily
- **Repetitive** — same courses appear across multiple sites
- **Ad-heavy** — coupon sites are cluttered with ads and redirects
- **Unreliable** — expired coupons are not always removed

This application automates the entire discovery, validation, and presentation pipeline.

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────┐     REST API     ┌─────────────────┐
│   Next.js 15    │ ──────────────── │   NestJS 11     │
│   Frontend      │                  │   Backend API   │
│   (Port 3001)   │                  │   (Port 4001)   │
└─────────────────┘                  └────────┬────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              │               │               │
                    ┌─────────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
                    │  PostgreSQL 16 │ │   Redis 7   │ │ Python 3.12 │
                    │  + pgvector    │ │   (Queue)   │ │  Scraper    │
                    │  (Port 5433)   │ │  (Port 6380)│ │  Worker     │
                    └────────────────┘ └─────────────┘ └─────────────┘
```

### 3.2 Data Flow

```
Backend enqueues scrape jobs (BullMQ)
    → Python worker consumes jobs from Redis
        → Scrapes 10 coupon websites
            → Pipeline: Normalize → Validate → Language-Filter → Deduplicate
                → Store to PostgreSQL
                    → Backend generates vector embeddings (pgvector)
                        → Frontend fetches via REST API
```

### 3.3 Component Inventory

| Component  | Technology                 | Container Name  | Internal Port | External Port |
| :--------- | :------------------------- | :-------------- | :------------ | :------------ |
| Frontend   | Next.js 15 / React 19      | ucf-frontend    | 3000          | 3001          |
| Backend    | NestJS 11 / Prisma 7       | ucf-backend     | 4000          | 4001          |
| Database   | PostgreSQL 16 + pgvector   | ucf-postgres    | 5432          | 5433          |
| Queue      | Redis 7 Alpine             | ucf-redis       | 6379          | 6380          |
| Scraper    | Python 3.12                | ucf-scraper     | —             | —             |

---

## 4. Functional Requirements

### 4.1 Scraper Engine (Python)

#### FR-SCR-01: Multi-Provider Scraping

The scraper must support the following 10 coupon aggregator sites:

| #  | Provider          | Base URL                         |
| :- | :---------------- | :------------------------------- |
| 1  | Coupon Scorpion   | https://couponscorpion.com       |
| 2  | CourseJoiner      | https://coursejoiner.com         |
| 3  | Courson           | https://courson.xyz              |
| 4  | DiscUdemy         | https://www.discudemy.com        |
| 5  | E-next            | https://www.e-next.in            |
| 6  | Freebies Global   | https://freebiesglobal.com       |
| 7  | FreeWebCart        | https://www.freewebcart.com      |
| 8  | iDownloadCoupons   | https://idownloadcoupon.com     |
| 9  | Real Discount     | https://www.real.discount        |
| 10 | Udemy Freebies    | https://www.udemyfreebies.com    |

Each provider must:

- Extend the `BaseScraper` abstract class
- Implement `scrape()` returning `list[ScrapedCourse]`
- Support `test_connectivity()` for health checks
- Use the shared `HttpClient` with configurable timeout, retries, and proxy rotation

#### FR-SCR-02: Scraping Pipeline

All scraped data must pass through a 6-stage pipeline in order:

1. **Scrape** — Extract raw course data from HTML/JSON sources
2. **Normalize** — Clean titles (remove `[FREE]`, `[COUPON]` prefixes), standardize URLs, extract Udemy course IDs, resolve redirect URLs, build coupon URLs
3. **Validate** — Verify required fields (title + URL), validate URL format
4. **Language Filter** — Accept only English-language courses (using `langdetect` library)
5. **Deduplicate** — Merge duplicate courses by Udemy course ID, preferring records with higher metadata richness score
6. **Store** — Upsert courses and coupon sources to PostgreSQL

#### FR-SCR-03: Job Queue Integration

- Consume jobs from Redis via BullMQ-compatible queue (`scrape-queue`)
- Support job types:
  - `scrape-all` — scrape all enabled providers
  - `scrape-single` — scrape a specific provider (by ID or name)
  - `test-provider` — test provider connectivity
  - `validate-active-courses` — verify active coupons haven't expired
- Write structured log entries to the `logs` table after each run
- Update provider `last_status` and `last_run_at` after each run

#### FR-SCR-04: Scheduled Scraping

- Built-in scheduler thread runs `scrape-all` on a configurable interval (default: 30 minutes)
- 30-second initial delay before first scheduled scrape
- Graceful shutdown via SIGINT/SIGTERM handlers

#### FR-SCR-05: Active Course Validation

- Periodically validate that active coupon URLs still resolve to free courses
- Parse Udemy page HTML to detect price (via Twitter meta tags, JSON-LD, schema.org markup)
- Mark expired coupons as `is_active = false` in the database
- Configurable batch size (default: 50) and interval (default: 60 minutes)

#### FR-SCR-06: Proxy Support

- Read proxy list from the `settings` table (`key = 'proxies'`)
- Support JSON array format or newline-separated list
- Rotate proxies per request via the `HttpClient`
- User-agent rotation via `fake-useragent` library

---

### 4.2 Backend API (NestJS)

#### FR-API-01: Authentication

| Endpoint            | Method | Auth     | Description                              |
| :------------------ | :----- | :------- | :--------------------------------------- |
| `/auth/login`       | POST   | Public   | Login with email + password              |
| `/auth/refresh`     | POST   | Public*  | Refresh access token using refresh token |
| `/auth/logout`      | POST   | JWT      | Invalidate tokens via Redis blacklist    |
| `/auth/password`    | PATCH  | JWT      | Change user password                     |

- Password hashing: Argon2
- Access tokens: JWT, 15-minute default expiry
- Refresh tokens: JWT, 7-day default expiry
- Token blacklisting on logout via Redis
- Rate limiting: 5 login attempts / minute, 3 refresh attempts / minute

#### FR-API-02: Course Management

| Endpoint                     | Method | Auth | Description                       |
| :--------------------------- | :----- | :--- | :-------------------------------- |
| `/courses`                   | GET    | JWT  | List courses (paginated, filterable) |
| `/courses/search`            | GET    | JWT  | Full-text search                  |
| `/courses/search/semantic`   | GET    | JWT  | Semantic vector-based search      |
| `/courses/recommendations`   | GET    | JWT  | Personalized recommendations      |
| `/courses/stats`             | GET    | JWT  | Dashboard statistics              |
| `/courses/:id`               | GET    | JWT  | Course detail by ID               |
| `/courses/:id/similar`       | GET    | JWT  | Semantically similar courses      |

#### FR-API-03: Provider Management

| Endpoint                | Method | Auth | Description                        |
| :---------------------- | :----- | :--- | :--------------------------------- |
| `/providers`            | GET    | JWT  | List all providers with status     |
| `/providers/:id`        | PATCH  | JWT  | Update provider (enable/disable, timeout) |
| `/providers/scrape`     | POST   | JWT  | Trigger manual scrape              |
| `/providers/:id/test`   | POST   | JWT  | Test provider connectivity         |
| `/providers/:id/retry`  | POST   | JWT  | Retry failed scrape                |
| `/providers/:id/logs`   | GET    | JWT  | Paginated run logs                 |
| `/providers/:id/stats`  | GET    | JWT  | Aggregate statistics               |

#### FR-API-04: Favorites

| Endpoint                | Method | Auth | Description                  |
| :---------------------- | :----- | :--- | :--------------------------- |
| `/favorites`            | GET    | JWT  | List user's favorited courses |
| `/favorites`            | POST   | JWT  | Add course to favorites      |
| `/favorites/:courseId`   | DELETE | JWT  | Remove course from favorites |

#### FR-API-05: History

| Endpoint     | Method | Auth | Description                          |
| :----------- | :----- | :--- | :----------------------------------- |
| `/history`   | GET    | JWT  | List user's browsing history (paginated) |
| `/history`   | POST   | JWT  | Record action (VIEWED/CLICKED/ENROLLED)  |
| `/history`   | DELETE | JWT  | Clear user's history                 |

#### FR-API-06: Analytics

| Endpoint                | Method | Auth | Description                  |
| :---------------------- | :----- | :--- | :--------------------------- |
| `/analytics/overview`   | GET    | JWT  | Aggregate analytics overview |
| `/analytics/time-series` | GET   | JWT  | Time-series data (configurable days) |

#### FR-API-07: Categories

| Endpoint       | Method | Auth | Description        |
| :------------- | :----- | :--- | :----------------- |
| `/categories`  | GET    | JWT  | List all categories |

13 seeded categories: Development, Business, Finance & Accounting, IT & Software, Office Productivity, Personal Development, Design, Marketing, Lifestyle, Photography & Video, Health & Fitness, Music, Teaching & Academics.

#### FR-API-08: Settings

| Endpoint          | Method | Auth | Description               |
| :---------------- | :----- | :--- | :------------------------ |
| `/settings/:key`  | GET    | JWT  | Get setting value by key  |
| `/settings/:key`  | PATCH  | JWT  | Update setting value      |

Default settings:

- `scrape_interval_minutes` = 30
- `max_course_age_days` = 7
- `auto_purge_expired` = true

#### FR-API-09: Swagger Documentation

- Swagger UI available at `/api` endpoint
- All endpoints documented with `@ApiOperation`, `@ApiResponse`, and `@ApiBearerAuth` decorators

#### FR-API-10: Vector Embeddings

- Automatic embedding generation for courses using HuggingFace `Xenova/all-MiniLM-L6-v2` model
- 384-dimensional vectors stored in pgvector
- Used for semantic search and "similar courses" functionality
- Runs locally via ONNX Runtime — no external API calls

#### FR-API-11: Job Scheduling

- Repeatable `scrape-all` job via BullMQ (configurable interval, default: 30 min)
- Repeatable `validate-active-courses` job (configurable interval, default: 60 min)
- Manual job enqueue, status check, and retry via API
- Queue statistics endpoint (waiting, active, completed, failed, delayed counts)

---

### 4.3 Frontend Dashboard (Next.js)

#### FR-UI-01: Pages / Routes

| Route             | Description                                 |
| :---------------- | :------------------------------------------ |
| `/login`          | Login page                                  |
| `/dashboard`      | Main dashboard with stats overview          |
| `/courses`        | Browse, search, and filter courses          |
| `/favorites`      | User's favorited courses                    |
| `/history`        | User's browsing history                     |
| `/sources`        | Provider management (enable/disable, test, scrape) |
| `/analytics`      | Charts and time-series analytics            |
| `/settings`       | Application settings                        |

#### FR-UI-02: Authentication Flow

- Login form with email + password
- JWT tokens stored in `localStorage` (access + refresh)
- Automatic token refresh on 401 responses via Axios interceptor
- Redirect to `/login` on authentication failure
- Middleware-based route protection for dashboard pages

#### FR-UI-03: Course Browsing

- Paginated course list with filtering by category, provider, language
- Full-text search
- Semantic vector search
- Course detail view with similar courses
- Personalized recommendations
- One-click favorite toggle
- History tracking (view, click, enroll actions)

#### FR-UI-04: Provider Management

- List all providers with status indicators (SUCCESS/FAILED/RUNNING/IDLE)
- Enable/disable providers
- Configure timeout per provider
- Trigger manual scrape (single or all)
- Test provider connectivity
- View provider run logs (paginated)
- View provider aggregate statistics

#### FR-UI-05: Analytics Dashboard

- Overview statistics (total courses, providers, success rate)
- Courses by category breakdown
- Courses by provider breakdown
- Time-series charts (courses per day, scraping runs per day)
- Configurable time range

#### FR-UI-06: UI Components

- Built with shadcn/ui component library (Radix UI primitives)
- State management: Zustand
- Data fetching: TanStack React Query
- Charts: Recharts
- Icons: Lucide React
- Theme: next-themes (dark mode support)
- Notifications: Sonner toast library

---

## 5. Database Schema

### 5.1 Entity-Relationship Overview

```
users ──< favorites >── courses ──< coupon_sources >── providers
  │                        │                               │
  └────< history >─────────┘                              logs
                           │
                    course_embeddings
                           │
                      categories
                           │
                       settings
```

### 5.2 Tables

#### `users`

| Column        | Type     | Constraints                  |
| :------------ | :------- | :--------------------------- |
| id            | UUID     | PK, auto-generated           |
| email         | String   | UNIQUE                       |
| password_hash | String   |                              |
| role          | Enum     | ADMIN / USER, default: USER  |
| created_at    | DateTime | default: now()               |
| updated_at    | DateTime | auto-updated                 |

#### `courses`

| Column          | Type     | Constraints                     |
| :-------------- | :------- | :------------------------------ |
| id              | UUID     | PK, auto-generated              |
| title           | String   |                                 |
| description     | Text     | nullable                        |
| udemy_url       | String   |                                 |
| udemy_course_id | String   | UNIQUE                          |
| category_id     | UUID     | FK → categories, nullable       |
| language        | String   | default: "English"              |
| thumbnail_url   | String   | nullable                        |
| rating          | Float    | nullable                        |
| instructor      | String   | nullable                        |
| price_original  | Float    | nullable                        |
| created_at      | DateTime | default: now()                  |
| updated_at      | DateTime | auto-updated                    |

Indexes: `language`, `category_id`, `created_at`

#### `providers`

| Column      | Type           | Constraints              |
| :---------- | :------------- | :----------------------- |
| id          | UUID           | PK, auto-generated       |
| name        | String         | UNIQUE                   |
| base_url    | String         |                          |
| is_enabled  | Boolean        | default: true            |
| timeout_ms  | Int            | default: 30000           |
| last_run_at | DateTime       | nullable                 |
| last_status | ProviderStatus | IDLE/SUCCESS/FAILED/RUNNING |
| created_at  | DateTime       | default: now()           |
| updated_at  | DateTime       | auto-updated             |

#### `coupon_sources`

| Column           | Type     | Constraints                              |
| :--------------- | :------- | :--------------------------------------- |
| id               | UUID     | PK, auto-generated                       |
| course_id        | UUID     | FK → courses, CASCADE delete             |
| provider_id      | UUID     | FK → providers, CASCADE delete           |
| coupon_url       | String   |                                          |
| is_free          | Boolean  | default: true                            |
| expires_at       | DateTime | nullable                                 |
| first_seen_at    | DateTime | default: now()                           |
| last_verified_at | DateTime | default: now()                           |
| is_active        | Boolean  | default: true                            |
| created_at       | DateTime | default: now()                           |
| updated_at       | DateTime | auto-updated                             |

Unique constraint: `(course_id, provider_id)`  
Indexes: `(is_active, expires_at)`, `provider_id`

#### `categories`

| Column     | Type     | Constraints        |
| :--------- | :------- | :----------------- |
| id         | UUID     | PK, auto-generated |
| name       | String   | UNIQUE             |
| slug       | String   | UNIQUE             |
| created_at | DateTime | default: now()     |

#### `favorites`

| Column     | Type     | Constraints                    |
| :--------- | :------- | :----------------------------- |
| id         | UUID     | PK, auto-generated             |
| user_id    | UUID     | FK → users, CASCADE delete     |
| course_id  | UUID     | FK → courses, CASCADE delete   |
| created_at | DateTime | default: now()                 |

Unique constraint: `(user_id, course_id)`

#### `history`

| Column     | Type          | Constraints                    |
| :--------- | :------------ | :----------------------------- |
| id         | UUID          | PK, auto-generated             |
| user_id    | UUID          | FK → users, CASCADE delete     |
| course_id  | UUID          | FK → courses, CASCADE delete   |
| action     | HistoryAction | VIEWED / CLICKED / ENROLLED    |
| created_at | DateTime      | default: now()                 |

Index: `(user_id, created_at)`

#### `logs`

| Column           | Type      | Constraints                    |
| :--------------- | :-------- | :----------------------------- |
| id               | UUID      | PK, auto-generated             |
| provider_id      | UUID      | FK → providers, CASCADE delete |
| job_id           | String    | nullable                       |
| status           | LogStatus | SUCCESS/FAILED/RUNNING/CANCELLED |
| message          | Text      | nullable                       |
| courses_found    | Int       | default: 0                     |
| courses_accepted | Int       | default: 0                     |
| courses_rejected | Int       | default: 0                     |
| started_at       | DateTime  | default: now()                 |
| finished_at      | DateTime  | nullable                       |

Index: `(provider_id, started_at)`

#### `settings`

| Column | Type   | Constraints        |
| :----- | :----- | :----------------- |
| id     | UUID   | PK, auto-generated |
| key    | String | UNIQUE             |
| value  | String |                    |

#### `course_embeddings`

| Column    | Type         | Constraints                    |
| :-------- | :----------- | :----------------------------- |
| course_id | UUID         | PK, FK → courses, CASCADE delete |
| embedding | vector(384)  | pgvector type                  |

---

## 6. Non-Functional Requirements

### 6.1 Security

| Requirement  | Implementation                                               |
| :----------- | :----------------------------------------------------------- |
| NFR-SEC-01   | Helmet.js middleware for HTTP security headers                |
| NFR-SEC-02   | CORS restricted to configured origins                        |
| NFR-SEC-03   | Global JWT authentication guard (opt-out via `@Public()`)    |
| NFR-SEC-04   | Password hashing with Argon2                                 |
| NFR-SEC-05   | Input validation via `class-validator` (whitelist, forbidNonWhitelisted) |
| NFR-SEC-06   | Token blacklisting on logout via Redis                       |
| NFR-SEC-07   | Rate limiting: 100 requests/minute global, 5/min login, 3/min refresh, 10/min scrape triggers |
| NFR-SEC-08   | Non-root Docker container user for frontend (nextjs:nodejs)  |
| NFR-SEC-09   | No secrets in source code — all via `.env` file              |

### 6.2 Performance

| Requirement  | Implementation                                            |
| :----------- | :-------------------------------------------------------- |
| NFR-PERF-01  | Redis caching for frequently accessed data                |
| NFR-PERF-02  | Database indexes on `language`, `category_id`, `created_at`, `is_active + expires_at`, `provider_id`, `user_id + created_at` |
| NFR-PERF-03  | Pagination on all list endpoints                          |
| NFR-PERF-04  | BullMQ job queue with completed/failed job retention limits (50/100) |
| NFR-PERF-05  | Configurable delay between scraper HTTP requests (default: 2s) to avoid rate limiting |
| NFR-PERF-06  | Multi-stage Docker builds to minimize image sizes         |
| NFR-PERF-07  | Next.js standalone output mode for minimal production bundle |
| NFR-PERF-08  | ONNX Runtime optimizations (pruned unused platforms/CUDA/TensorRT binaries) |

### 6.3 Reliability

| Requirement  | Implementation                                            |
| :----------- | :-------------------------------------------------------- |
| NFR-REL-01   | Docker `restart: unless-stopped` for all services         |
| NFR-REL-02   | Health checks on PostgreSQL (`pg_isready`), Redis (`redis-cli ping`), Scraper (Redis ping) |
| NFR-REL-03   | Service dependency ordering (`depends_on` + `condition: service_healthy`) |
| NFR-REL-04   | Configurable HTTP retries per scraper request (default: 3) |
| NFR-REL-05   | Graceful shutdown via signal handlers (SIGINT/SIGTERM)    |
| NFR-REL-06   | Fallback to in-memory scraper list if database is unreachable |
| NFR-REL-07   | Backend auto-runs migrations and seed on container start  |
| NFR-REL-08   | Global exception filter for consistent error responses    |

### 6.4 Observability

| Requirement  | Implementation                                            |
| :----------- | :-------------------------------------------------------- |
| NFR-OBS-01   | Structured logging via Pino (NestJS) with pretty-print in dev, JSON in production |
| NFR-OBS-02   | Python structured logging with configurable level (DEBUG/INFO/WARNING/ERROR) |
| NFR-OBS-03   | Detailed scrape run logs stored in `logs` table (found/accepted/rejected counts, duration, status, message) |
| NFR-OBS-04   | Queue statistics endpoint (waiting/active/completed/failed/delayed) |
| NFR-OBS-05   | Provider-level status tracking (IDLE/RUNNING/SUCCESS/FAILED) |

### 6.5 Maintainability

| Requirement  | Implementation                                            |
| :----------- | :-------------------------------------------------------- |
| NFR-MNT-01   | Modular NestJS architecture (14 feature modules)          |
| NFR-MNT-02   | Repository pattern for data access layer                  |
| NFR-MNT-03   | Plugin-based scraper architecture (BaseScraper + SCRAPER_REGISTRY) |
| NFR-MNT-04   | DTO validation with class-validator decorators            |
| NFR-MNT-05   | Prisma ORM with typed schema and migration history        |
| NFR-MNT-06   | Unit tests (spec files for services, repositories, controllers) |
| NFR-MNT-07   | E2E tests for all major API endpoints                     |
| NFR-MNT-08   | Python tests for pipeline stages, providers, URL parser   |

---

## 7. Technology Stack

### 7.1 Frontend

| Technology        | Version | Purpose                              |
| :---------------- | :------ | :----------------------------------- |
| Next.js           | 16      | React framework (App Router)         |
| React             | 19      | UI library                           |
| TailwindCSS       | 4       | Utility-first CSS                    |
| TanStack Query    | 5       | Server state management              |
| Zustand           | 5       | Client state management              |
| Recharts          | 3       | Data visualization / charts          |
| shadcn/ui         | —       | Component library (Radix UI)         |
| Axios             | 1       | HTTP client                          |
| Lucide React      | 1       | Icon library                         |
| next-themes       | 0.4     | Dark/light theme support             |
| Sonner            | 2       | Toast notifications                  |
| TypeScript        | 5       | Type safety                          |

### 7.2 Backend

| Technology            | Version | Purpose                          |
| :-------------------- | :------ | :------------------------------- |
| NestJS                | 11      | API framework                    |
| Prisma                | 7       | ORM + migrations                 |
| Passport + JWT        | —       | Authentication                   |
| BullMQ                | 5       | Job queue                        |
| Argon2                | 0.44    | Password hashing                 |
| Helmet                | 8       | HTTP security headers            |
| Pino                  | —       | Structured logging               |
| Swagger (OpenAPI)     | 11      | API documentation                |
| @nestjs/throttler     | 6       | Rate limiting                    |
| HuggingFace Transformers | 4    | Local embedding generation       |
| ONNX Runtime          | 1       | ML model inference               |
| ioredis               | 5       | Redis client                     |
| class-validator       | 0.15    | DTO validation                   |
| TypeScript            | 5       | Type safety                      |

### 7.3 Scraper

| Technology      | Version | Purpose                              |
| :-------------- | :------ | :----------------------------------- |
| Python          | 3.12    | Runtime                              |
| requests        | 2.31+   | HTTP client                          |
| BeautifulSoup4  | 4.12+   | HTML parsing                         |
| lxml            | 5.1+    | Fast XML/HTML parser                 |
| psycopg2-binary | 2.9+    | PostgreSQL driver                    |
| redis           | 5.0+    | Redis client / BullMQ consumer       |
| langdetect      | 1.0.9+  | Language detection                   |
| fake-useragent  | 1.5+    | User agent rotation                  |
| python-dotenv   | 1.0+    | Environment variable loading         |
| pytest          | 8.0+    | Testing framework                    |

### 7.4 Infrastructure

| Technology  | Version | Purpose                                  |
| :---------- | :------ | :--------------------------------------- |
| Docker      | —       | Containerization                         |
| Docker Compose | —    | Service orchestration                    |
| PostgreSQL  | 16      | Primary database (pgvector/pgvector:pg16 image) |
| Redis       | 7       | Job queue + cache + token blacklist (redis:7-alpine) |
| Node.js     | 20      | Runtime for backend + frontend builds    |

---

## 8. Environment Configuration

All configuration is managed through a single `.env` file at the project root.

### 8.1 Required Variables

| Variable               | Description                          | Default                  |
| :--------------------- | :----------------------------------- | :----------------------- |
| `POSTGRES_USER`        | Database user                        | udemy_finder             |
| `POSTGRES_PASSWORD`    | Database password                    | *(must change)*          |
| `POSTGRES_DB`          | Database name                        | udemy_finder             |
| `DATABASE_URL`         | Full connection string               | *(auto-composed)*        |
| `REDIS_HOST`           | Redis hostname                       | redis                    |
| `REDIS_PORT`           | Redis port                           | 6379                     |
| `REDIS_URL`            | Redis connection URL                 | redis://redis:6379       |
| `JWT_SECRET`           | Access token signing key (≥32 chars) | *(must change)*          |
| `JWT_REFRESH_SECRET`   | Refresh token signing key            | *(must change)*          |

### 8.2 Optional Variables

| Variable                  | Description                       | Default              |
| :------------------------ | :-------------------------------- | :------------------- |
| `JWT_EXPIRY`              | Access token lifetime             | 15m                  |
| `JWT_REFRESH_EXPIRY`      | Refresh token lifetime            | 7d                   |
| `DEFAULT_ADMIN_EMAIL`     | Initial admin email               | admin@localhost.local |
| `DEFAULT_ADMIN_PASSWORD`  | Initial admin password            | ChangeMe123!         |
| `SCRAPE_INTERVAL_MINUTES` | Auto-scrape interval              | 30                   |
| `SCRAPE_DELAY_SECONDS`    | Delay between scraper HTTP requests | 2                  |
| `VALIDATE_URLS`           | Enable URL validation             | true                 |
| `LOG_LEVEL`               | Python log level                  | INFO                 |
| `MAX_RETRIES`             | HTTP retry count                  | 3                    |
| `DEFAULT_TIMEOUT_MS`      | HTTP timeout (ms)                 | 30000                |
| `BACKEND_PORT`            | NestJS listen port                | 4000                 |
| `NODE_ENV`                | Environment mode                  | development          |
| `NEXT_PUBLIC_API_URL`     | Frontend → Backend API URL        | http://localhost:4001 |
| `CORS_ORIGIN`             | Allowed CORS origins              | http://localhost:3001 |

---

## 9. Deployment

### 9.1 Docker Compose Deployment (Primary)

```bash
# 1. Clone repository
git clone https://github.com/Akai-Abd/udemy-course-finder.git
cd udemy-course-finder

# 2. Configure environment
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET

# 3. Start all services
docker compose up -d

# Backend auto-runs migrations and seed on startup
```

### 9.2 Persistent Volumes

| Volume Name       | Mount Point                    | Purpose         |
| :---------------- | :----------------------------- | :-------------- |
| ucf-postgres-data | /var/lib/postgresql/data       | Database files  |
| ucf-redis-data    | /data                          | Redis persistence |

### 9.3 Local Development (Without Docker)

**Prerequisites:** Node.js 20+, Python 3.12+, PostgreSQL 16, Redis 7

```bash
# Backend
cd backend && npm install && npx prisma generate && npx prisma migrate dev && npm run start:dev

# Frontend
cd frontend && npm install && npm run dev

# Scraper
cd scraper && pip install -r requirements.txt && python -m src.main
```

---

## 10. Testing

### 10.1 Backend Tests

| Type      | Command                         | Framework |
| :-------- | :------------------------------ | :-------- |
| Unit      | `cd backend && npm test`        | Jest      |
| Unit+Cov  | `cd backend && npm run test:cov`| Jest      |
| E2E       | `cd backend && npm run test:e2e`| Jest + Supertest |

Unit test coverage: auth, courses, providers, favorites, history, analytics, users, jobs (`.spec.ts` files).

E2E test coverage: app, auth, courses, favorites, history, providers (`.e2e-spec.ts` files).

### 10.2 Scraper Tests

| Type      | Command                                   | Framework |
| :-------- | :---------------------------------------- | :-------- |
| Unit      | `cd scraper && python -m pytest tests/ -v` | pytest    |

Test coverage: pipeline stages (normalizer, validator, language filter, deduplicator, store), providers, URL parser, expiry validator.

### 10.3 Frontend Validation

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

---

## 11. Data Model: Scraped Course

The `ScrapedCourse` dataclass flows through the entire pipeline:

| Field            | Type              | Required | Description                          |
| :--------------- | :---------------- | :------- | :----------------------------------- |
| title            | str               | Yes      | Course title                         |
| udemy_url        | str               | Yes*     | Direct Udemy course URL              |
| coupon_url       | str               | Yes*     | URL with coupon code appended        |
| udemy_course_id  | str \| None       | No       | Unique Udemy course identifier       |
| provider_name    | str               | Auto     | Source provider name                 |
| category         | str \| None       | No       | Course category                      |
| language         | str \| None       | No       | Course language                      |
| thumbnail_url    | str \| None       | No       | Course thumbnail image URL           |
| rating           | float \| None     | No       | Course rating (0-5)                  |
| instructor       | str \| None       | No       | Instructor name                      |
| price_original   | float \| None     | No       | Original price before coupon         |
| is_free          | bool              | No       | Whether the coupon makes it free     |
| expires_at       | datetime \| None  | No       | Coupon expiry date                   |
| description      | str \| None       | No       | Course description                   |

*At least one of `udemy_url` or `coupon_url` is required.

**Metadata richness score** (used for deduplication preference): up to 10 points based on populated optional fields.

---

## 12. Optional Services (Commented Out in docker-compose.yml)

| Service          | Image                                 | Port | Purpose           |
| :--------------- | :------------------------------------ | :--- | :---------------- |
| pgAdmin          | dpage/pgadmin4:latest                 | 5050 | Database GUI      |
| Redis Commander  | rediscommander/redis-commander:latest | 8081 | Redis GUI         |

Uncomment in `docker-compose.yml` to enable.

---

## 13. Constraints & Limitations

- **Localhost only** — not designed for public internet deployment
- **Single user focus** — supports multiple user accounts but optimized for personal use
- **English only** — language filter rejects non-English courses by default
- **Scraper fragility** — HTML scraping is inherently brittle; provider site changes may break individual scrapers
- **No real-time updates** — courses are fetched on a polling interval, not via webhooks
- **No payment processing** — all courses must be 100% free via coupon
- **pgvector required** — database image uses `pgvector/pgvector:pg16`, not standard PostgreSQL

---

## 14. Glossary

| Term             | Definition                                                |
| :--------------- | :-------------------------------------------------------- |
| Provider         | A coupon aggregator website that lists free Udemy courses  |
| Coupon Source     | A specific coupon URL for a course from a specific provider |
| Pipeline         | The 6-stage data processing chain (scrape → store)        |
| Metadata Richness | Score (0-10) measuring how much optional data a scraped course record contains |
| Semantic Search  | Vector-based search using 384-dim embeddings for meaning-aware queries |
| BullMQ           | Redis-backed job queue system used for scrape job orchestration |
| pgvector         | PostgreSQL extension enabling vector similarity search    |
