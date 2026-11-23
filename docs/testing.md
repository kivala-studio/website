# Testing and quality gates

## Commands

| Gate | Command | Configuration |
|---|---|---|
| Lint | `npm run lint` (`eslint --max-warnings=0`) | `eslint.config.mjs` |
| Types | `npm run typecheck` (`tsc --noEmit`, strict) | `tsconfig.json` |
| Unit tests | `npm run test` (`vitest run`) | `vitest.config.mts` |
| All three | `npm run check` | `package.json` |
| Build and bundle scan | `npm run build` | `next.config.ts`, `scripts/scan-client-bundle.mjs` |
| End-to-end, demo mode | `npm run e2e` | `playwright.config.ts` |
| End-to-end, local stack | `npm run e2e:local` | `playwright.local.config.ts` |
| Lighthouse budgets | `npm run lhci` | `lighthouserc.json` |

## Lint rules specific to this repository

`eslint.config.mjs` extends `eslint-config-next` (core web vitals and TypeScript) and adds:

- `src/domain/**` may not import React, Next.js, `@supabase/*` or `server-only`, and may import only from `src/domain`.
- In `src/domain/**` outside tests: no `parseFloat`, no `Number.parseFloat`, no `.toNumber()` or `.toNearestNumber()` calls.

Warnings fail the lint.

## Unit tests

- Vitest runs `src/**/*.test.ts` and `messages/**/*.test.ts` in the `node` environment, with the alias `@` for `src`. There are 82 test files.
- Tests sit beside the module they test.
- There are no component (DOM) unit tests; UI is covered by Playwright.

### Fixtures

`tests/fixtures`:

| File | Used by |
|---|---|
| `market/market-snapshot.production.json`, `.headers.json` | Demo mode at run time (`src/data/market/demo/scenarios.ts`) and market tests |
| `portfolio-ledger.v1.json` | `src/domain/portfolio/ledger-fixture.test.ts` |
| `home-compact-contract.json` | `src/domain/market/home-compact.test.ts` |
| `intelligence-feature-config.example.json` | `src/domain/intelligence/feature-controls.test.ts` |
| `catalogue.v1.json`, `catalogue.v1.sha256`, `parity.v1.json` | `src/domain/product-voice/product-voice.test.ts` |

The market snapshot fixture is imported by application code, so demo mode depends on it.

## Playwright, demo mode

`playwright.config.ts`:

- Tests in `tests/e2e`, fully parallel.
- The web server is `npm run start -- --port 3100` with `NEXT_PUBLIC_DATA_MODE=demo` and `SITE_URL=http://localhost:3100`. It needs a build made beforehand with the same mode (`npm run build`). Outside CI an already running server on that port is reused.
- `PLAYWRIGHT_BASE_URL` points the tests at a server that is already running and starts none.
- Traces are kept on failure.

Projects:

| Project | Device | Tests |
|---|---|---|
| `chromium` | Desktop Chrome | All |
| `firefox` | Desktop Firefox | Only tests whose title contains `@engines` |
| `webkit` | Desktop Safari | Only tests whose title contains `@engines` |

Tests tagged `@engines`: the formatter table (`design.spec.ts`), "the browser never requests an Edge Function" (`market.spec.ts`) and three weekly-reading tests (`intelligence.spec.ts`).

Specs: `activity`, `auth`, `design`, `foundation`, `home`, `intelligence`, `market-information`, `market`, `plans`, `plus`, `portfolio-advanced`, `portfolio`, `public`, `settings`, `simulation`, `site`, `unusual-activity`, `watchlist`, `week-ahead`. `settled.ts` is a helper that waits for finite animations to finish before a screenshot or an axe scan.

Notes:

- Demo state is set through cookies (`demo-account`, `demo-scenario`, `demo-clock`, …; [configuration.md](configuration.md)).
- The gallery screenshot comparison in `design.spec.ts` runs only on macOS; its baselines are `tests/e2e/design.spec.ts-snapshots/*-chromium-darwin.png`.
- Several specs write screenshots to `docs/evidence/<folder>/` (the `EVIDENCE` constant at the top of each spec). They are not listed in `.gitignore`.
- Most specs run an axe scan and fail on `serious` or `critical` violations ([accessibility.md](accessibility.md)).

To run one project: `npx playwright test --project=chromium`. Browsers are installed with `npx playwright install` (the CI workflow installs `chromium firefox webkit` with system dependencies).

## Playwright, local stack

`playwright.local.config.ts`:

- Tests in `tests/e2e-local` (`session.spec.ts`, `deletion.spec.ts`), one worker, Chromium only, locale `pt-AO`.
- Needs a build made with `NEXT_PUBLIC_DATA_MODE=local` and the local Supabase stack's URL and publishable key, and `CLIENT_DEV_PASSWORD` in the environment. `session.spec.ts` is skipped without it.
- The local stack and its seed come from the backend repository; they are not in this one.

## Bundle scan

`scripts/scan-client-bundle.mjs` runs at the end of `npm run build`; see [security-and-privacy.md](security-and-privacy.md).

## Lighthouse

`lighthouserc.json` starts `npm run start -- --port 3200`, loads `/` and `/policy` three times with `Accept-Language: pt-AO` and asserts on the median run. Budgets are listed in [seo.md](seo.md). Results are uploaded to temporary public storage.

## Intelligence evaluation

`npm run intelligence:evaluate`; see [features/intelligence.md](features/intelligence.md).
