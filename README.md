# RZen Rental

Owner dashboard for a small rental operation: rooms, leases, rent collection, and tenant history. Built for **authenticated owners**; data lives in **Supabase** (PostgreSQL + Row Level Security + Auth).

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database (Supabase)](#database-supabase)
- [Authentication \& routing](#authentication--routing)
- [Project layout](#project-layout)
- [Scripts](#scripts)
- [CI](#ci)
- [Deploying (Vercel)](#deploying-vercel)
- [Reference docs](#reference-docs)

---

## Features

| Area | What you can do |
|------|------------------|
| **Dashboard** | View all units (vacant / occupied / maintenance), monthly rent, **mark occupied** or **vacant**, open **payment invoice** (monthly bills, electricity usage, pay / mark paid), **checkout** flow with final utilities and refund math, edit rates, room menu for lease summary and status. |
| **Payments** | KPI cards (collected, this month, pending), **monthly revenue** chart with year/month filters, **payment status** donut, **transactions** table with status / billing year / month filters and pagination, **mark paid** for pending bills (when signed in). |
| **Tenant history** | Table of leases (active and ended), **search** and **status** filters, charts for tenant distribution. |
| **Profile** | Account area linked from the sidebar. |
| **Auth** | Email + password sign-in via Supabase; session enforced on dashboard routes when env is configured. |

The marketing **home** route (`/`) redirects to `/dashboard`.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | [Next.js](https://nextjs.org) 15 (App Router) |
| UI | React 19, [Tailwind CSS](https://tailwindcss.com) 4, [shadcn/ui](https://ui.shadcn.com)-style components, [Base UI](https://base-ui.com/react/overview/quick-start), [Lucide](https://lucide.dev) icons |
| Data & auth | [Supabase](https://supabase.com) (Postgres, Auth, `@supabase/ssr`) |
| Validation | [Zod](https://zod.dev) |
| Charts | [Recharts](https://recharts.org) |
| Hosting (recommended) | [Vercel](https://vercel.com) |

---

## Prerequisites

- **Node.js** ≥ **20.9** (see `package.json` → `engines`)
- A **Supabase** project with schema applied from `supabase/migrations/` (see below)
- At least one **Auth user** in Supabase (Authentication → Users) for owner login

---

## Getting started

```bash
git clone <your-repo-url>
cd rzen-rental
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should be redirected to `/dashboard` (or `/login` if Supabase env is set and you are not signed in).

Use **Turbopack** in dev (`next dev --turbopack`). Production builds use `next build` (webpack) by default.

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (for real auth/data) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (for real auth/data) | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Optional; reserved for admin scripts — the web app expects **authenticated user + RLS**, not the service role in normal requests |

Copy `.env.example` to `.env.local`. **Never commit** `.env.local` (it is gitignored).

If the two `NEXT_PUBLIC_*` variables are **missing**, middleware **does not** force login, which is useful for local UI dry runs without a backend.

---

## Database (Supabase)

SQL migrations live in **`supabase/migrations/`**. Apply them in order (Supabase SQL Editor, or [Supabase CLI](https://supabase.com/docs/guides/cli) `db push` / linked project).

Core concepts:

- **`rooms`** — units, status (`vacant` | `occupied` | `maintenance`), rent, metadata.
- **`leases`** — tenant name, rent, advance/deposit, dates, `is_active`; one active lease per room (enforced in DB).
- **`payments`** — billing lines (amounts, due dates, paid/pending).
- **`utility_readings`** — electric/water periods and meter reads (also used in checkout / invoice flows where applicable).

RLS policies in migrations scope reads/writes to **`authenticated`** users for operational tables. Ensure your owner users are created in **Supabase Auth** and that policies match how you deploy.

---

## Authentication & routing

- **`/login`** — sign in; redirects to `/dashboard` or the `next` query path when already authenticated.
- **`/auth/callback`** — OAuth / magic-link code exchange (GET handler). **Add this URL** to Supabase **Redirect URLs** for each deployed origin (see [Deploying](#deploying-vercel)).
- **`/dashboard/*`** — protected when Supabase env is set: unauthenticated users are redirected to **`/login?next=…`**.

---

## Project layout

```
src/
  app/
    (app)/                 # Signed-in shell: dashboard, login, profile
    auth/callback/         # Supabase session callback
    page.tsx               # Redirects → /dashboard
  components/
    dashboard/             # Room grid, payments, tenants, dialogs, charts
    layout/                # Sidebar + shell
    ui/                    # Shared UI primitives
  lib/
    db/queries/            # Server data fetching
    supabase/              # Browser / server / admin clients
    billing/               # e.g. electricity helpers
    ...
  middleware.ts            # Session + dashboard gate
supabase/migrations/       # Ordered SQL migrations
reference/                 # Specs, HTML prototypes, internal docs
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run build:turbo` | Production build with Turbopack (optional / local) |
| `npm run start` | Start production server (after `build`) |
| `npm run lint` | ESLint |

---

## CI

GitHub Actions workflow **`.github/workflows/ci.yml`** runs on pushes and pull requests to **`main`** and **`master`**: `npm ci`, `npm run lint`, and `npx tsc --noEmit`. Add **`develop`** (or your default branch) to the `branches` list if you want the same checks there.

---

## Deploying (Vercel)

1. Connect the Git repository to [Vercel](https://vercel.com/new) (framework: **Next.js**).
2. In **Project → Settings → Environment Variables**, set for **Production** and **Preview**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. In **Supabase → Authentication → URL configuration**:
   - **Site URL:** your production site (e.g. `https://your-app.vercel.app` or custom domain).
   - **Redirect URLs:** include `https://<host>/auth/callback` for production; add each **preview** URL + `/auth/callback` if you test login on preview deployments.
4. Deploy. Vercel runs `npm run build` using Node 20.x.

---

## Reference docs

| Resource | Description |
|----------|-------------|
| [`reference/app-flow.md`](reference/app-flow.md) | Narrative owner flows (may lag the UI slightly; cross-check routes in `src/app`). |
| [`reference/app-flow.html`](reference/app-flow.html) | Styled HTML version of the flow doc — open in a browser. |
| [`reference/code-standards.md`](reference/code-standards.md) | House coding notes. |
| [`prototype-single.html`](reference/prototype-single.html) | Legacy visual/spec ideas; not all are implemented in Next.js. |

---

## License

This project is **private** (`"private": true` in `package.json`). All rights reserved unless you add an explicit license.
