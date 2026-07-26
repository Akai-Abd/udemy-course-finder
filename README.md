<div align="center">
  <img src="frontend/src/app/icon.png" width="120" height="120" alt="Udemy Course Finder Logo" style="border-radius: 24px;" />
  
  # 🎓 Udemy Course Finder
  
  **Your personal, automated aggregator for 100% free Udemy courses.**
  
  [![NestJS](https://img.shields.io/badge/Backend-NestJS_11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
  [![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
  [![Python](https://img.shields.io/badge/Scraper-Python_3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
  [![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org/)
  [![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com/)

</div>

---

## ✨ Overview

**Udemy Course Finder** is a self-hosted application that continuously discovers free, English-language Udemy courses by scraping **10 coupon websites**. It normalizes the results through a 6-stage data pipeline, deduplicates them, and presents them in a modern, mobile-responsive dashboard with AI-powered semantic search.

Never manually search coupon sites again—let the Python worker do the heavy lifting in the background while you browse a clean, ad-free interface.

---

## 🏗️ Architecture

```mermaid
graph LR
    A[Next.js 16<br>Frontend] -->|REST API| B(NestJS 11<br>Backend)
    B -->|Persists Data| C[(PostgreSQL 16<br>+ pgvector)]
    B -->|Job Queue| D[(Redis 7)]
    E[Python 3.12<br>Scraper Worker] -->|Consumes Jobs| D
    E -->|Scrapes| F[10 External Sites]
```

**Data flow:** Backend enqueues scrape jobs ➔ Python worker scrapes 10 sites ➔ Pipeline: Normalize ➔ Validate ➔ Language-Filter ➔ Deduplicate ➔ Store to PostgreSQL ➔ Backend generates vector embeddings ➔ Frontend fetches via API.

---

## 🚀 Quick Start

### Docker Compose (Production)

Get the entire stack running in under 5 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/Akai-Abd/udemy-course-finder.git
cd udemy-course-finder

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET

# 3. Start all services in the background
docker compose up -d
```

> Database migrations and seed data run automatically on first startup.

🎉 **You're done!** Open [http://localhost:3001](http://localhost:3001) in your browser.

### Local Development (SQLite)

For local development without Docker/PostgreSQL/Redis:

```bash
# Terminal 1: Backend (SQLite mode)
cd backend
npm install
npm run start:sqlite

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

> SQLite mode uses a local `dev.db` file — no external database required.

🎉 Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Default Admin Credentials:**
> - **Email:** `admin@localhost.local`
> - **Password:** `ChangeMe123!`

---

## ✨ Features

- **🔍 Smart Search** — Full-text search + AI-powered semantic search (pgvector + HuggingFace embeddings)
- **🤖 Recommendations** — Personalized course suggestions based on browsing history
- **📊 Analytics Dashboard** — Time-series charts, category breakdowns, provider stats
- **⭐ Favorites & History** — Save courses and track your browsing activity
- **🕷️ 10 Scrapers** — Modular scraper architecture with a 6-stage data pipeline
- **⏰ Auto-Scheduling** — Configurable scrape interval with BullMQ job queue
- **✅ Coupon Validation** — Periodic verification of active coupons against Udemy
- **🔐 Secure Auth** — JWT with refresh tokens, Argon2 hashing, Redis token blacklist
- **👥 Admin Panel** — Role-based access control with user management
- **🔔 Notifications** — Real-time in-app notification system
- **📱 Mobile Responsive** — Fully responsive UI with mobile drawer navigation
- **📖 Swagger Docs** — Full OpenAPI documentation at `/api`
- **🐳 Docker Ready** — One-command deployment with Docker Compose
- **🗃️ Dual Database** — Production PostgreSQL + lightweight SQLite for local dev

---

## 🛠️ Tech Stack

<div align="center">

| Component | Technologies Used | Highlight |
| :--- | :--- | :--- |
| **🎨 Frontend** | Next.js 16, React 19, TailwindCSS 4 | TanStack Query, Recharts, shadcn/ui, mobile responsive |
| **⚙️ Backend** | NestJS 11, Prisma 7, Passport JWT | BullMQ, Swagger API Docs, Pino Logging |
| **🕷️ Scraper** | Python 3.12, BeautifulSoup, requests | 6-stage pipeline, deduplication, proxy rotation |
| **🗄️ Database** | PostgreSQL 16 + pgvector / SQLite | Vector search, relational data, indexing |
| **⚡ Cache/Queue**| Redis 7 | BullMQ job orchestration, token blacklist, caching |

</div>

---

## 🌐 Supported Coupon Sources

The scraper engine currently supports the following **10 providers** (with modular architecture to add more):

| # | Provider | Base URL |
|---|----------|----------|
| 1 | Coupon Scorpion | `couponscorpion.com` |
| 2 | CourseJoiner | `coursejoiner.com` |
| 3 | Courson | `courson.xyz` |
| 4 | DiscUdemy | `discudemy.com` |
| 5 | E-next | `e-next.in` |
| 6 | Freebies Global | `freebiesglobal.com` |
| 7 | FreeWebCart | `freewebcart.com` |
| 8 | iDownloadCoupons | `idownloadcoupon.com` |
| 9 | Real Discount | `real.discount` |
| 10 | Udemy Freebies | `udemyfreebies.com` |

---

## 🔌 API Endpoints

The backend exposes a full REST API (Swagger docs at `http://localhost:4001/api`):

| Module | Endpoints | Description |
|--------|-----------|-------------|
| **Auth** | `POST /auth/login`, `refresh`, `logout`, `PATCH /auth/password` | JWT authentication with refresh tokens |
| **Courses** | `GET /courses`, `search`, `search/semantic`, `recommendations`, `stats`, `:id/similar` | Browse, search, AI-powered semantic search |
| **Providers** | `GET /providers`, `PATCH :id`, `POST scrape`, `POST :id/test`, `:id/logs`, `:id/stats` | Manage scraper sources |
| **Favorites** | `GET /favorites`, `POST`, `DELETE :courseId` | Save/remove favorite courses |
| **History** | `GET /history`, `POST`, `DELETE` | Track browsing activity |
| **Analytics** | `GET /analytics/overview`, `time-series` | Dashboard analytics |
| **Categories** | `GET /categories` | 13 seeded course categories |
| **Settings** | `GET /settings/:key`, `PATCH :key` | App configuration |
| **Users** | `GET /users`, `PATCH :id/role`, `DELETE :id` | Admin user management |
| **Notifications** | `GET /notifications`, `PATCH :id/read`, `POST :id/dismiss` | In-app notifications |

---

## 💻 Development Setup

<details>
<summary><b>Click to expand full development instructions</b></summary>

### Prerequisites
* Node.js 20+
* Python 3.12+

**For Docker mode additionally:**
* PostgreSQL 16 (with pgvector extension)
* Redis 7

### Option A: SQLite (No Docker Required)

```bash
# Backend (uses local dev.db)
cd backend
npm install
npm run start:sqlite
# API at http://localhost:4000, Swagger at http://localhost:4000/api

# Frontend
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:3000
```

### Option B: Docker Compose (Full Stack)

```bash
cp .env.example .env
# Edit .env with your secrets
docker compose up -d
# Frontend at http://localhost:3001, API at http://localhost:4001/api
```

### Python Scraper (Standalone)
```bash
cd scraper
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src.main
```

</details>

<details>
<summary><b>Click to view Testing commands</b></summary>

```bash
# Backend unit tests
cd backend && npm test

# Backend unit tests with coverage
cd backend && npm run test:cov

# Backend E2E tests
cd backend && npm run test:e2e

# Scraper tests
cd scraper && python -m pytest tests/ -v

# Frontend type check
cd frontend && npx tsc --noEmit && npm run lint
```
</details>

---

## 📁 Project Structure

```text
udemy-course-finder/
├── backend/                  # NestJS API server
│   ├── src/
│   │   ├── auth/             # JWT authentication, token blacklist
│   │   ├── courses/          # Course CRUD, search, semantic search
│   │   ├── providers/        # Provider management, scrape triggers
│   │   ├── favorites/        # User favorites
│   │   ├── history/          # Browsing history tracking
│   │   ├── analytics/        # Dashboard analytics
│   │   ├── categories/       # Course categories
│   │   ├── jobs/             # BullMQ job scheduling
│   │   ├── embeddings/       # HuggingFace vector embeddings
│   │   ├── notifications/    # In-app notification system
│   │   ├── users/            # Admin user management (RBAC)
│   │   ├── settings/         # App settings
│   │   └── common/           # Guards, filters, decorators, cache
│   ├── prisma/               # Schema (PostgreSQL + SQLite), migrations, seed
│   └── test/                 # E2E tests
├── frontend/                 # Next.js dashboard
│   └── src/
│       ├── app/              # App Router pages + custom favicon & branding
│       ├── components/       # UI components (shadcn/ui, analytics, layout, shared)
│       └── lib/              # API client, hooks, utilities
├── scraper/                  # Python scraping worker
│   └── src/
│       ├── providers/        # 10 scraper implementations
│       ├── pipeline/         # normalize → validate → filter → dedup → store
│       └── utils/            # HTTP client, URL parser, logging
├── docker-compose.yml        # Service orchestration (5 containers)
├── docker-compose.override.yml # Dev mode overrides (hot reload)
└── .env.example              # Environment configuration template
```

---

## ⚙️ Environment Variables

Key configuration (see `.env.example` for all options):

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Database password | *(must change)* |
| `JWT_SECRET` | Access token signing key (≥32 chars) | *(must change)* |
| `JWT_REFRESH_SECRET` | Refresh token signing key | *(must change)* |
| `SCRAPE_INTERVAL_MINUTES` | Auto-scrape frequency | `30` |
| `SCRAPE_DELAY_SECONDS` | Delay between HTTP requests | `2` |
| `NEXT_PUBLIC_API_URL` | Frontend → Backend URL | `http://localhost:4001` |
| `DEFAULT_ADMIN_EMAIL` | Initial admin email | `admin@localhost.local` |
| `DEFAULT_ADMIN_PASSWORD` | Initial admin password | `ChangeMe123!` |

---

<div align="center">
  
  *Built by Akai ❤️ for lifelong learners.*
  
  **[MIT License](LICENSE)**
</div>
