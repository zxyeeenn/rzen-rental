# RZen Rental — Owner app flow

**Styled read:** open [`app-flow.html`](./app-flow.html) in a browser — **Plus Jakarta Sans** and indigo styling aligned with [`prototype-single.html`](./prototype-single.html).

**Plain doc:** this file stays the lightweight, version-control-friendly copy.

**Audience:** You and your mother managing a small apartment. **No public listings** (the `/listings` route was removed; the app is owner-focused).

---

## Routing (current app)

| Path | Behavior |
|------|----------|
| `/` | Redirects to `/dashboard`. |
| `/dashboard`, `/dashboard/payments`, `/dashboard/tenants`, `/dashboard/utilities` | Owner UI (requires Supabase session when env is configured). |
| `/login` | Sign in; authenticated users are redirected to dashboard or `next`. |

**Middleware:** If `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, unauthenticated visits to `/dashboard/*` go to `/login?next=…`. If env is missing, middleware does not enforce login (local dry runs).

---

## App map (tabs)

| Tab | Route | Purpose |
|-----|-------|---------|
| **Dashboard** | `/dashboard` | Room grid: status, monthly rate, **Mark occupied** / **Mark vacant**, **⋮** for lease + all statuses. Header links to Payments, Tenants, Utilities. |
| **Payments** | `/dashboard/payments` | Totals, chart by billing month, add payment, **Mark paid**, transaction list. |
| **Tenants** | `/dashboard/tenants` | All `leases` rows (active + ended), lease start descending. |
| **Utilities** | `/dashboard/utilities` | Electric / water readings → `utility_readings`. |
| **Sign in** | `/login` | Supabase Auth. |

---

## Flow 1 — Room lifecycle (Dashboard)

### Mark a unit occupied

1. Go to **Dashboard**.
2. Find a **Vacant** card.
3. Click **Mark occupied** (green).
4. **Behind the scenes:** `rooms.status` → `occupied` (RLS as your signed-in user).

**Today:** Tenant name and lease terms are **not** collected on that button. Add or edit the active lease in **Supabase → `leases`** (or use **Tenants** to see what’s on file). The room card **menu (⋮)** shows the lease summary when an active lease exists and the room is occupied.

### Mark a unit vacant or maintenance

- **Occupied** card: **Mark vacant** (outline), or **⋮** → **Set status** → Vacant / Maintenance.
- **Maintenance** card: **Mark vacant** or set status from the menu.

### Lease details & status (menu)

1. Click **⋮** on a room card.
2. View **Active lease** (if present): tenant, rent, advance/deposit, due day, next due, dates, notes.
3. **Set status:** Vacant / Occupied / Maintenance.

---

## Flow 2 — Payments

1. Open **Payments**.
2. Review **Total collected**, **This month**, **Pending**, and **By billing month** (chart).
3. **Add payment:** room, amount, billing month (`YYYY-MM`), due date, optional paid date and notes → **Save payment**.
4. **Mark paid** on a pending row (paid date = today).
5. **Data:** `payments` in Supabase (migration may seed pending rows for active leases for the current month).

---

## Flow 3 — Tenant history

1. Open **Tenants**.
2. Scan **Active** vs **Ended**, rent, due day, start/end, notes.
3. **Edits:** Supabase Table Editor for now (no in-app lease form yet).

---

## Flow 4 — Utilities

1. Open **Utilities**.
2. Room, kind (electric / water), period, previous & current readings, optional notes → **Save reading**.
3. Data in **`utility_readings`**.

---

## Status colors (UI)

| Status | Meaning |
|--------|---------|
| **Vacant** | Available; green accent on cards. |
| **Occupied** | Rented; red accent on cards. |
| **Maintenance** | Not bookable; amber accent. |

---

## Prototype reference (`prototype-single.html`)

The HTML prototype includes **extra** ideas (invoice lines, guest inquiries, checkout math). **Not implemented** in the Next.js app. Keep the file as a visual/spec archive.

---

## Tech notes

- **RLS:** Policies use **`authenticated`** for operational tables (see Supabase migrations).
- **Revalidation:** Room status updates refresh dashboard (and related paths); payment actions refresh the payments page.
