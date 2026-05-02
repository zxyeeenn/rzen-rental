# Code organization and performance (team reference)

This document summarizes practical standards for keeping the codebase fast to run, fast to navigate, and easy to maintain.

## File and module layout

**One file per function is not a universal rule.** Extreme splitting (every helper in its own file) usually adds churn: more imports, harder local reasoning, and no guarantee of better performance.

**Prefer splitting by cohesive feature or concern**, not by counting functions:

- Group related functions, types, and small components that change together (e.g. `room-validation.ts`, `payment-queries.ts`).
- Extract a **shared utility or hook** into its own file when it is **reused in multiple places** or when it is **large enough** that a dedicated module improves testability and discoverability.
- Keep **one primary export per file** when that file is clearly “the thing” (e.g. `MainShell`, `LoginForm`); it is fine for private helpers to live in the same file until they are reused elsewhere.

**Rule of thumb:** split when a file is hard to read (>~300–400 lines is a signal, not a law), when boundaries stabilize, or when duplication appears — not preemptively for every function.

## Reusability

- **DRY with judgment:** extract when the same behavior appears twice *and* keeping one implementation reduces bugs; avoid premature abstraction.
- **Public API surface:** prefer explicit named exports for library-style modules; default exports are fine for Next.js pages/layouts per framework convention.

## Performance (web / Next.js)

- **Server vs client:** keep `"use client"` boundaries small; default to Server Components and push interactivity down.
- **Data fetching:** fetch close to where data is needed; avoid waterfall requests; cache or dedupe where the framework allows.
- **Bundles:** dynamic `import()` for heavy, rarely used UI; avoid importing large deps in hot paths.
- **Rendering:** stable keys, memoize only when profiling shows benefit; prefer simpler component trees over excessive `useMemo`/`useCallback`.

## UI components (shadcn / Base UI)

- **Prefer existing primitives in `src/components/ui`** (the project’s shadcn-installed set) for buttons, forms, dialogs, pagination, etc., so styling, accessibility patterns, and behavior stay consistent app-wide.
- Before hand-rolling a control, check whether a matching component already exists or can be added with `npx shadcn add <component>`; extend or compose those pieces rather than duplicating markup.

## Readability and consistency

- Match **existing** naming, folder structure, and import style in the repo.
- Prefer **clear names** over comments; comment *why*, not *what*, when non-obvious.
- **Types:** model real domains (Room, Lease, Payment); avoid `any` in application code.

## Testing and safety

- Test behavior at module boundaries (API handlers, pure utilities, critical flows).
- Fail fast on invalid input; handle user-facing errors with a consistent pattern.

---

*This is guidance, not dogma.* Optimize for the team’s velocity and the product’s constraints; revisit when the codebase or stack changes materially.
