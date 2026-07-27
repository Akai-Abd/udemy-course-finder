# Frontend — Next.js Dashboard

Modern dashboard for browsing, searching, and managing free Udemy courses. Built with **Next.js 16.2.10** (App Router, standalone output), **React 19.2.4**, **TailwindCSS 4**, and **TanStack Query 5**.

## Pages

| Route | Auth | Description |
|-------|------|-------------|
| `/` | — | Redirects to `/dashboard` (authenticated) or `/login` |
| `/login` | Public | JWT authentication login |
| `/register` | Public | User registration |
| `/dashboard` | Protected | Dashboard — course stats, recent courses |
| `/courses` | Protected | Browse all courses with filters & search |
| `/courses/[id]` | Protected | Course detail page |
| `/analytics` | Protected | Time-series charts & overview stats |
| `/sources` | Protected | Manage scraping providers |
| `/favorites` | Protected | Saved courses |
| `/history` | Protected | Browsing & click history |
| `/settings` | Protected | Profile, security, password change |
| `/admin/users` | Protected | User management (admin) |

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend API base URL |

## Component Architecture

```
src/
├── app/
│   ├── (dashboard)/           # Authenticated layout group (Sidebar + Header)
│   │   ├── admin/users/       # Admin user management
│   │   ├── analytics/         # Analytics with Recharts charts
│   │   ├── courses/           # Course browser
│   │   │   └── [id]/          # Course detail
│   │   ├── dashboard/         # Main dashboard
│   │   ├── favorites/         # Favorites list
│   │   ├── history/           # History with clear support
│   │   ├── settings/          # Settings + password change
│   │   ├── sources/           # Provider management
│   │   └── layout.tsx         # Auth guard, sidebar/header shell
│   ├── api/                   # Next.js API route stubs (empty, unused)
│   ├── login/                 # Public login page
│   ├── register/              # Public registration page
│   ├── globals.css            # Global styles & design tokens
│   ├── layout.tsx             # Root layout (Inter font, QueryProvider, Toaster)
│   └── page.tsx               # Root redirect (auth check → dashboard or login)
├── components/
│   ├── analytics/             # TimeSeriesChart, DateRangeSelector
│   ├── courses/               # CourseCard, CourseFilters, ExportButton
│   ├── layout/                # Sidebar, Header, NotificationBell
│   ├── providers/             # QueryProvider (TanStack)
│   ├── shared/                # LoadingState, ErrorState, EmptyState, Pagination
│   └── ui/                    # 17 Radix-based primitives (shadcn/ui)
├── lib/
│   ├── api-client.ts          # Axios client with JWT interceptors & refresh
│   ├── hooks/                 # 8 TanStack Query hooks (see below)
│   └── utils.ts               # cn() utility (clsx + tailwind-merge)
└── proxy.ts                   # Next.js middleware (public path allowlist)
```

### TanStack Query Hooks

| Hook | Domain |
|------|--------|
| `use-analytics.ts` | Analytics overview & time-series |
| `use-auth.ts` | Login, register, token refresh (Zustand store) |
| `use-categories.ts` | Course categories |
| `use-courses.ts` | Course listing, search, detail |
| `use-favorites.ts` | Favorite toggle & list |
| `use-history.ts` | Browse history |
| `use-notifications.ts` | Notification list & unread count |
| `use-providers.ts` | Provider CRUD & scrape trigger |

### UI Primitives (shadcn/ui)

Avatar, Badge, Button, Card, Dialog, DropdownMenu, Input, Label, ScrollArea, Select, Separator, Sheet, Skeleton, Switch, Table, Tabs, Tooltip

## Key Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| Next.js | 16.2.10 | App Router, standalone output, API routes |
| React | 19.2.4 | UI framework |
| TanStack Query | 5.x | Server state management, caching, refetching |
| Recharts | 3.x | Interactive time-series charts (area, bar, line) |
| Radix UI | Various | Accessible UI primitives (dialog, select, tabs, etc.) |
| Zustand | 5.x | Client-side state (auth store) |
| Lucide React | 1.x | Icon library |
| Sonner | 2.x | Toast notifications |
| Axios | 1.x | HTTP client with JWT interceptors |
| class-variance-authority | 0.7.x | Component variant styles |
| tailwind-merge | 3.x | Tailwind class merging |

## Data Fetching Pattern

1. `lib/api-client.ts` — Axios instance with JWT auto-attach & token refresh
2. `lib/hooks/use-*.ts` — TanStack Query hooks with domain-specific cache keys
3. Page components consume hooks with loading/error/data states
4. `components/shared/` provides `LoadingState`, `ErrorState`, `EmptyState` for consistent UX

## Styling

- **TailwindCSS 4** via `@tailwindcss/postcss` plugin
- **CSS variables** for dark theme (hardcoded `dark` class on `<html>`)
- **shadcn/ui** component library (Radix + CVA + tailwind-merge)
- **Inter** font from Google Fonts
- **Animations** — Fade-in, pulse, gradient effects, spinner

## Auth Flow

1. Zustand store (`use-auth`) holds tokens + user in memory
2. `proxy.ts` middleware allows public paths (`/login`, `/register`, `/api`)
3. Dashboard layout checks auth state; redirects to `/login` if unauthenticated
4. Axios interceptor attaches `Authorization: Bearer <token>` to all requests
5. Token refresh handled automatically on 401 responses

## Docker

Multi-stage build (Node 20 Alpine):

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=http://api:4000 -t frontend .
docker run -p 3000:3000 frontend
```

Produces a standalone Node.js server (`server.js`) — no `node_modules` needed at runtime.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run build` | Production build (standalone output) |
| `npm start` | Start production server |
| `npm run lint` | ESLint check (next/core-web-vitals + typescript) |
| `npx tsc --noEmit` | Type checking |
