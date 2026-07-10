# Frontend — Next.js Dashboard

Modern dashboard for browsing, searching, and managing free Udemy courses. Built with Next.js 15 (App Router), React 19, TailwindCSS 4, and TanStack Query.

## Pages

| Route | Description |
|-------|-------------|
| `/login` | JWT authentication login |
| `/` | Dashboard — course stats, recent courses |
| `/courses` | Browse all courses with filters & search |
| `/analytics` | Time-series charts & overview stats |
| `/providers` | Manage scraping sources |
| `/favorites` | Saved courses |
| `/history` | Browsing & click history |
| `/settings` | Profile, security, password change |

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Component Architecture

```
src/
├── app/                  # Next.js App Router
│   ├── (dashboard)/      # Authenticated layout group
│   │   ├── analytics/    # Analytics with Recharts charts
│   │   ├── courses/      # Course browser
│   │   ├── favorites/    # Favorites list
│   │   ├── history/      # History with clear support
│   │   ├── providers/    # Provider management
│   │   └── settings/     # Settings + password change
│   ├── login/            # Public login page
│   └── globals.css       # Global styles & design tokens
├── components/
│   ├── analytics/        # TimeSeriesChart, DateRangeSelector
│   ├── shared/           # LoadingState, ErrorState, EmptyState
│   └── ui/               # Radix-based UI primitives (shadcn/ui)
└── lib/
    ├── api-client.ts     # Axios client with JWT interceptors
    └── hooks/            # TanStack Query hooks per domain
```

## Key Libraries

| Library | Purpose |
|---------|---------|
| TanStack Query | Server state management, caching, refetching |
| Recharts | Interactive time-series charts (area, bar, line) |
| Radix UI | Accessible UI primitives (dialog, select, tabs, etc.) |
| Zustand | Client-side state (auth store) |
| Lucide React | Icon library |
| Sonner | Toast notifications |
| next-themes | Dark/light mode |
| Axios | HTTP client with interceptors |

## Data Fetching Pattern

All API calls flow through:
1. `lib/api-client.ts` — Axios instance with JWT auto-attach & refresh
2. `lib/hooks/use-*.ts` — TanStack Query hooks with domain-specific keys
3. Page components consume hooks with loading/error/data states

## Styling

- **TailwindCSS 4** with custom design tokens in `globals.css`
- **CSS variables** for dark/light theming
- **shadcn/ui** component library pattern (Radix + CVA)
- **Animations** — Fade-in, pulse, gradient effects

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npx tsc --noEmit` | Type checking |
