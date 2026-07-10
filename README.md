# Udemy Course Finder

A localhost-only application that aggregates free Udemy courses from 9 coupon aggregator websites. Automatically scrapes, deduplicates, and serves courses through a modern dashboard.

## Architecture

```
┌─────────────┐     ┌───────────────┐     ┌──────────────┐
│   Frontend   │────▶│    Backend     │────▶│  PostgreSQL  │
│  Next.js 15  │     │   NestJS 11   │     │     16       │
└─────────────┘     └───────┬───────┘     └──────────────┘
                            │
                    ┌───────┴───────┐
                    │   Redis 7     │
                    │ BullMQ + Cache│
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │ Python Scraper│
                    │  BullMQ Worker│
                    └───────────────┘
```

**Data flow:** Backend enqueues scrape jobs → Python worker scrapes 9 sites → Pipeline: normalize → validate → language-filter → dedup → store to PostgreSQL → Frontend fetches via REST API.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TailwindCSS 4, TanStack Query, Recharts |
| Backend | NestJS 11, Prisma 7, Passport JWT, BullMQ, Swagger |
| Scraper | Python 3.12, BeautifulSoup, httpx |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 |
| Deployment | Docker Compose |

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> && cd udemy-course-finder

# 2. Copy environment file
cp .env.example .env

# 3. Start all services
docker compose up -d

# 4. Run database migrations & seed
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed

# 5. Open the dashboard
open http://localhost:3000
```

**Default credentials:** `admin@localhost.local` / `ChangeMe123!`

## Development Setup

### Prerequisites

- Node.js 20+
- Python 3.12+
- PostgreSQL 16
- Redis 7
- Docker & Docker Compose (optional)

### Running Locally (without Docker)

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev

# Scraper
cd scraper
pip install -r requirements.txt
python -m src.worker
```

## API Reference

Swagger UI is available at: **http://localhost:4000/api**

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/logout` | Logout (blacklists JWT) |
| PATCH | `/auth/password` | Change password |
| GET | `/courses` | List courses (paginated, filterable) |
| GET | `/courses/search` | Search courses by text |
| GET | `/courses/stats` | Dashboard statistics |
| GET | `/providers` | List scraping providers |
| POST | `/providers/scrape` | Trigger manual scrape |
| GET | `/analytics/overview` | Analytics overview |
| GET | `/analytics/time-series` | Time-series analytics |
| GET/POST | `/favorites` | Manage favorites |
| GET/POST/DELETE | `/history` | Manage browsing history |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/udemy_finder` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | (required) |
| `JWT_REFRESH_SECRET` | Refresh token secret | (required) |
| `JWT_EXPIRY` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token TTL | `7d` |
| `SCRAPE_INTERVAL_MINUTES` | Auto-scrape interval | `30` |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Pino log level | `info` |

## Testing

```bash
# Backend unit tests
cd backend && npm test

# Backend unit tests with coverage
cd backend && npm run test:cov

# Backend E2E tests
cd backend && npm run test:e2e

# Scraper tests
cd scraper && python -m pytest tests/ -v

# Frontend lint + type check
cd frontend && npx tsc --noEmit && npm run lint
```

## Project Structure

```
├── backend/              # NestJS API server
│   ├── src/
│   │   ├── auth/         # JWT authentication, token blacklisting
│   │   ├── courses/      # Course CRUD, search, filtering
│   │   ├── providers/    # Scraping provider management
│   │   ├── analytics/    # Dashboard analytics & time-series
│   │   ├── favorites/    # User favorites
│   │   ├── history/      # Browsing history tracking
│   │   ├── jobs/         # BullMQ job orchestration
│   │   ├── common/       # Guards, filters, cache, logger
│   │   └── prisma/       # Database client
│   ├── test/             # E2E tests
│   └── prisma/           # Schema & migrations
├── frontend/             # Next.js dashboard
│   ├── src/
│   │   ├── app/          # App Router pages
│   │   ├── components/   # UI components
│   │   └── lib/          # API client, hooks, utilities
├── scraper/              # Python scraping worker
│   ├── src/
│   │   ├── providers/    # 9 site-specific scrapers
│   │   ├── pipeline/     # Normalize, validate, filter, dedup
│   │   └── utils/        # HTTP client, URL parser
│   └── tests/            # Pytest test suite
├── docker-compose.yml    # Service orchestration
└── .env.example          # Environment template
```

## Coupon Sources

| # | Provider | URL |
|---|----------|-----|
| 1 | Real Discount | real.discount |
| 2 | Courson | courson.xyz |
| 3 | Tutorial Bar | tutorialbar.com |
| 4 | Enext | enext.fr |
| 5 | iDownloadCoupons | idownloadcoupon.com |
| 6 | Discudemy | discudemy.com |
| 7 | Udemy Freebies | udemyfreebies.com |

## License

UNLICENSED — Personal use only.
