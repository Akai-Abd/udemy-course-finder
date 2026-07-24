# Backend — NestJS API Server

REST API powering the Udemy Course Finder dashboard. Handles authentication, course management, provider orchestration, analytics, and job scheduling.

## Module Architecture

```
AppModule
├── AuthModule          — JWT auth, token blacklisting, password change
├── UsersModule         — User repository (find, update password)
├── CoursesModule       — Course CRUD, search, semantic search, pagination
├── ProvidersModule     — Provider management, scrape triggers, logs
├── FavoritesModule     — User favorites (add/remove/list)
├── HistoryModule       — Browsing history tracking & clear
├── AnalyticsModule     — Overview stats & time-series aggregation
├── CategoriesModule    — Course categories
├── JobsModule          — BullMQ job orchestration
├── EmbeddingsModule    — HuggingFace vector embedding generation
├── SettingsModule      — App settings (key-value store)
├── RedisCacheModule    — Redis cache layer (global)
├── LoggerModule        — Structured logging via Pino (global)
├── ConfigModule        — Environment configuration
└── PrismaModule        — Database client (global)
```

## Setup

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start with hot-reload |
| `npm run build` | Build for production |
| `npm run start:prod` | Run production build |
| `npm test` | Run unit tests |
| `npm run test:cov` | Tests with coverage report |
| `npm run test:e2e` | Run E2E tests |
| `npm run lint` | Lint & fix |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npm run prisma:migrate` | Create new migration |
| `npm run db:reset` | Reset database |

## Testing

**Unit tests** (13 suites, 88+ tests):
```bash
npm test
```

Tests are co-located with source files (`*.spec.ts`):
- `auth.service.spec.ts` — Login, logout, refresh, password change
- `auth.controller.spec.ts` — Endpoint routing, DTO validation
- `courses.service.spec.ts` — CRUD, stats caching
- `courses.repository.spec.ts` — Query building, pagination
- `providers.service.spec.ts` — Scrape, test, retry logic
- `providers.repository.spec.ts` — Logs, stats aggregation
- `favorites.service.spec.ts` — Add/remove/check favorites
- `history.service.spec.ts` — Record, list, clear history
- `analytics.service.spec.ts` — Overview, time-series
- `users.service.spec.ts` — Find, update password
- `jobs.service.spec.ts` — Job enqueue, status, retry
- `jwt-auth.guard.spec.ts` — Public routes, blacklist check
- `global-exception.filter.spec.ts` — Error formatting

**E2E tests**:
```bash
npm run test:e2e
```

## Security Features

- **JWT with JTI** — Each token has a unique ID for revocation
- **Redis token blacklisting** — Logout invalidates tokens server-side
- **Rate limiting** — Login: 5/min, Refresh: 3/min, Scrape/Retry: 10/min, Global: 100/min
- **Argon2 password hashing** — Industry-standard password security
- **Helmet** — HTTP security headers
- **CORS** — Configured for localhost
- **Global validation** — class-validator DTOs on all endpoints

## Structured Logging

Uses `nestjs-pino` for structured logging:
- **Development**: Pretty-printed, colorized, human-readable
- **Production/Docker**: JSON-structured with request correlation IDs

Control log level via `LOG_LEVEL` environment variable.

## Prisma Commands

```bash
npx prisma studio         # GUI database browser
npx prisma migrate dev     # Create migration from schema changes
npx prisma migrate deploy  # Apply migrations (production)
npx prisma generate        # Regenerate client after schema change
npx prisma db seed         # Seed default admin user + providers
```
