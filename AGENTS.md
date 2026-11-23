## Important Rules

1. Cut taglines, helper text and secondary labels. If a screen needs them to make sense, fix the layout.
2. Always make the best decision that elevates user experience (UX), developer experience (DX), and agent experience (AX) together, without breaking anything.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## What this repository is

The invest.ao website: the public site and the signed-in web app in one Next.js App Router project, TypeScript strict, Tailwind. The backend (Supabase) and the iOS app live in other repositories and are the source of truth when this code disagrees with them.

Start with `docs/README.md`. It indexes the architecture, every route, every backend call, the feature areas, the design system, configuration, testing and deployment. `docs/divergences.md` lists where the web differs from the backend and iOS.

`docs/plan/` holds implementation plans. They are not descriptions of the current state.

## Commands

| Command | Use |
|---|---|
| `npm run check` | ESLint (no warnings allowed), `tsc --noEmit`, Vitest |
| `npm run build` | Production build, then the client bundle scan |
| `npm run e2e` | Playwright in `demo` mode against a build |
| `npm run e2e:local` | Playwright against a `local` build and a local Supabase stack |
| `npm run lhci` | Lighthouse budgets |
| `npm run messages` | Regenerate `messages/*.json` from the iOS string catalogue |
| `npm run icons` | Regenerate `src/ui/icons/icon-pack.ts` |

Copy `.env.example` to `.env.local`; `NEXT_PUBLIC_DATA_MODE=demo` needs no backend. Details: `docs/configuration.md`, `docs/testing.md`.

## Working rules

Each rule matches the code today; the file that enforces or shows it is named.

### Sources and scope

1. When the web and the backend or iOS disagree, the backend and iOS code win. Record the difference in `docs/divergences.md`; do not work around a missing backend capability in this repository.
2. Docs state only what the code does. Cite the file. Update the doc in the same change as the code.

### Money, prices and time

3. Financial values are `Decimal` in `src/domain`. No `parseFloat`, `.toNumber()` or `.toNearestNumber()` there (`eslint.config.mjs`). Money crosses server-to-browser boundaries as exact strings.
4. A price is shown as current only when the quote policy accepts it (`src/domain/market/quote-policy.ts`, `src/domain/market/quality.ts`). Otherwise show the dated verified close or `common.priceUnconfirmed`. Never show zero or a stale number as current.
5. Server-rendered and cached HTML never contains a current price. Current quotes are added in the browser by the market store.
6. Market state and dates come from the server calendar in `Africa/Luanda` (`src/domain/market/calendar.ts`, `src/domain/market/zone.ts`). Do not hard-code trading hours or use the browser's time zone.

### Layers and data

7. `src/domain` is pure TypeScript and imports only from `src/domain` (`eslint.config.mjs`).
8. Edge Functions are called only from the server. The browser reaches the market snapshot through `/api/market/snapshot` (`tests/e2e/market.spec.ts` asserts this).
9. Account reads go through `/api/account/*` or `/api/billing/*`; account writes are server actions built on `accountWrite` (`src/features/account/write.ts`). Every answer is applied only if it is for the account that asked.
10. No automatic request retries. Supabase clients run with `db.retry: false` (`src/data/supabase/options.ts`); only the market poll loop retries, with backoff (`src/domain/market/refresh.ts`). Polling pauses while the tab is hidden.
11. Plan limits are the server's. The web locks a Plus feature only when `unlocksPlus(access)` is false (`src/domain/account/access.ts`). Prices of web passes come only from `get_web_plans()`; never write a price in code outside demo data.
12. Golden fixtures in `tests/fixtures/` are copies from the backend and iOS. Do not edit them. Demo mode reads the market snapshot fixture at run time.

### Secrets and privacy

13. This repository is public. Never commit a secret value, key or token. Only `NEXT_PUBLIC_*` values may reach the browser, and `NEXT_PUBLIC_SUPABASE_KEY` must be the publishable key (`src/config/env.ts`). The bundle scan must pass (`scripts/scan-client-bundle.mjs`).
14. Share tokens, invite codes, phone numbers, NIFs and amounts never go into URLs the server requests, cache keys, logs, analytics or referrers (`src/data/portfolio/shared-portfolio.ts`, `src/data/billing/web-passes.ts`).
15. Telemetry is cookieless and allow-listed and reports route templates, not paths (`src/data/telemetry`). When adding a route, add its template to `ROUTE_TEMPLATES` (`src/data/telemetry/route-template.ts`).
16. Pages under `src/app/[locale]/(store-linked)` are opened by the iOS app or the store listings. They must not link to the web offer, show a price or promote Plus (`src/app/[locale]/(store-linked)/layout.tsx`). `/policy` and `/partilha/[token]` must keep their exact paths.

### UI

17. Read `docs/design/README.md` before building a page or a component. Use an existing component from `src/ui` before writing a new one; add a new one to `docs/design/components.md` and the gallery (`src/features/design-gallery`) in the same change.
18. Colours come from tokens (`src/ui/theme/tokens.css`). No raw hex, no arbitrary colours, no inline styles (the CSP forbids them in production).
19. Text fields never show an outline: accent border and `shadow-focus` (`src/ui/components/field-styles.ts`). Other controls keep the focus ring.
20. No phone screenshots on the landing page.
21. Group content in `Card` or `Panel`: flat, no border, no shadow. Actions are pills (`Button`, `ButtonLink`, `buttonClass`). Headings and financial values use `font-display`. Targets are at least 44 px.
22. Check light and dark, `pt` and `en`, phone and wide widths, and keyboard use.
23. Every user-visible string comes from the message catalogue. Strings shared with iOS are regenerated with `npm run messages`, not edited by hand; web-only strings go in the `site` namespace of both `messages/pt.json` and `messages/en.json`. A client component that reads a new key needs it listed in `src/i18n/client-messages.ts`.
24. Portuguese copy is Angolan Portuguese addressing the reader as "tu", in sentence case.
25. Use `Link` from `@/i18n/navigation` for every internal link.

### Process

26. Keep tests proportional to the change. Logic gets a unit test beside the module; a UI flow gets one Playwright test. Do not run the full suites for a small, reversible change.
27. One branch per task, Conventional Commits, a pull request to `main` that states the verification performed. Do not mention AI tooling in commits, code or docs.
