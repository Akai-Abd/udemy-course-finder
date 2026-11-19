# Changelog

## [1.0.6] - 2026-11-19

### Automation & CI/CD

- Add GitHub Actions scheduled scraper workflow (`.github/workflows/scrape.yml`) running every 12 hours (`0 */12 * * *`) with manual `workflow_dispatch` trigger
- Upgrade GitHub Actions to `actions/checkout@v7` and `actions/setup-python@v7` with Node 24 runtime support and pip dependency caching
- Add database connection validation check in CI workflow to ensure `DATABASE_URL` secret availability before execution

### Scraper Engine & Database

- Support full PostgreSQL connection string / DSN formatting in `scraper/src/db.py` to seamlessly connect with cloud databases (Supabase, Neon)
- Harden database connection pool error handling and logging during connection attempts

### Security & Networking

- Support dynamic wildcard matching for `*.vercel.app` frontend preview and production domains in NestJS CORS policy (`main.ts`)
- Retain configurable `CORS_ORIGIN` allowlist enforcement for custom production domains

### Testing & Verification

- Overhaul end-to-end test suite (`test/*.e2e-spec.ts`) with module configuration adjustments for authentication, Redis caching, and database seeding
- Verify all 13 backend unit test suites (83 tests) and 6 E2E test suites (22 tests) passing without errors

### Documentation & Deployment

- Add comprehensive [`Free Deployment Strategy`](Free%20Deployment%20Strategy) guide outlining a 100% free serverless architecture using Vercel, Koyeb/Render, Supabase/Neon, and GitHub Actions
- Update [`README.md`](README.md) and [`Udemy Course Finder.md`](Udemy%20Course%20Finder.md) with browser extension installation steps, parallel scraping documentation, updated API endpoints, and resolved technical debt

## [1.0.5] - 2026-11-19

### Features

- Add parallel scraper execution in `scraper/run_all.py` with multi-threaded concurrent scraping (`max_workers=5`) for 5x–10x faster execution
- Add browser extension assistant (`extension/` Manifest V3) with 1-click batch auto-enrollment and multi-tab opening using active Udemy sessions
- Add community "Report Expired" flagging on course cards and backend API endpoint (`POST /courses/:id/report-expired`) to instantly deactivate exhausted coupons
- Add "Today Only" discovery time-range filter (`timeRange=today|24h|all`) in backend repository, API DTO, and frontend catalog toolbar

### Security & Stability

- Harden CORS configuration in NestJS `main.ts` to enforce `CORS_ORIGIN` domain allowlisting in production environments
- Add SQLite busy timeout (`timeout=30.0`) in `scraper/src/db.py` to ensure thread-safe connection pooling without database locking

## [1.0.4] - 2026-11-19

### Features

- Add opened course tracking with visual `OPENED` tag badge, card de-emphasis, and `Open Again` action button
- Add one-click **Hide Opened** toolbar filter toggle to hide previously clicked/enrolled courses
- Add optimistic local history tracking in course catalog for instantaneous UI state updates
- Add dedicated empty state with direct "Show All Courses" action when all courses on a page are opened
- Add standalone live scraper runner (`scraper/run_all.py`) to run all 10 sources sequentially and sync directly to SQLite/PostgreSQL without Redis

### Refactoring & Performance

- Fix and harden scraper path resolution in NestJS `JobsService` using multi-candidate dynamic path search (`process.cwd()`, `__dirname`)
- Format codebase and improve TypeScript strict type safety across backend and frontend services
- Update course catalog search parameters and sorting options

### Documentation

- Add comprehensive cloud deployment strategies (`Deployment Strategy`, `Free Deployment Strategy`) for free-tier hosting (Render, Supabase, Vercel)
- Update README and Product Requirements Document (`Udemy Course Finder.md`) with standalone scraper execution and opened course tracking

## [1.0.3] - 2026-07-27

### Bug Fixes

- Fix error logging during embedding pipeline initialization
- Fix `start:prod` script path to point to `dist/src/main`
- Fix port-clearing commands in README to prevent script termination on empty process hits
- Fix merge conflict in README.md

### Refactoring

- Unify active coupon filtering, optimize recommendation logic, and clean up search parameters
- Simplify application bootstrap process in `main.ts`

### Chores

- Update build configuration to disable out-dir deletion and enable source maps in dev mode
- Exclude build artifacts, test files, and prisma databases from tsconfig compilation
- Update entry point configuration in `main.ts`
- Add environment template and update prisma seed script to use ts-node

### Documentation

- Overhaul installation guide with detailed prerequisites, setup modes, and troubleshooting steps
- Add troubleshooting guide for port conflicts, API access, and embedding initialization issues
- Add `npx kill-port` commands to troubleshooting guide for port management
- Update build prerequisites and installation instructions for onnxruntime-node embedding integration
- Add frontend `.env.example` and update installation & troubleshooting guide
- Update installation instructions with npm lifecycle script approval and Prisma generation steps
- Update README with build verification steps and production server instructions
- Add documentation for handling interactive Prisma database push prompts

## [1.0.2] - 2026-07-27

### Features

- Add pagination, language filtering, and app icon support
- Implement user notification preferences, password visibility toggles, and admin user management interface
- Add MIT license, upgrade to Next.js 16, and document project architecture and features

### Documentation

- Create production requirements document for Udemy Course Finder
