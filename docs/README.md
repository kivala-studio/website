# Documentation

Verified against commit `521af17` on 2026-11-22.

Every statement in these documents was checked in the code at that commit and names the file it comes from. Paths are relative to the repository root. Where the backend or the iOS app is mentioned, the source is the code of those repositories (`investao-functions`, `invest.ao`), not their documentation.

| Document | Covers |
|---|---|
| [architecture.md](architecture.md) | Hosts and the proxy, rendering and caching, auth flow, data flow, code layers, run modes |
| [routes.md](routes.md) | Every page and route handler: host, session, plan, data |
| [data-layer.md](data-layer.md) | Every RPC, table, Edge Function and Realtime topic the web uses, and where |
| [divergences.md](divergences.md) | Where the web differs from the backend and the iOS app |
| [features/market.md](features/market.md) | Market store, price rules, market list, instrument page, search, news, market information, unusual activity, week ahead |
| [features/account.md](features/account.md) | Home, watchlist, alerts, activity, settings, account setup, account deletion, privacy mode |
| [features/portfolio.md](features/portfolio.md) | Ledger, named portfolios, cash, benchmark, income, CSV and statement import, year report, share links, simulator |
| [features/intelligence.md](features/intelligence.md) | Weekly reading, feature controls, personalisation, evaluation suite |
| [plus-and-web-passes.md](plus-and-web-passes.md) | Plan gating, the Plus page, web pass checkout, order status, past orders |
| [design/README.md](design/README.md) | Design rules |
| [design/theme.md](design/theme.md) | Colour tokens, light and dark, typography, radii, motion |
| [design/components.md](design/components.md) | Components in `src/ui` |
| [design/layout.md](design/layout.md) | Page frames, containers, breakpoints |
| [i18n.md](i18n.md) | Locales, message catalogue, client message scoping, formatting |
| [seo.md](seo.md) | Metadata, Open Graph images, sitemap, robots, structured data |
| [accessibility.md](accessibility.md) | What the code and the tests enforce |
| [security-and-privacy.md](security-and-privacy.md) | Headers, CSP, cookies, CSRF checks, telemetry, crash reports |
| [configuration.md](configuration.md) | Environment variables by name, cookies, browser storage keys |
| [testing.md](testing.md) | Unit tests, Playwright projects, Lighthouse, lint rules, bundle scan |
| [deployment.md](deployment.md) | What the repository proves about build, CI and production |
| [glossary.md](glossary.md) | Terms |

`docs/plan/` holds implementation plans for the Android app and this website. They are plans, not descriptions of the current state.

`docs/evidence/w14/` holds two JSON exports of the intelligence evaluation suite. `npm run intelligence:evaluate` writes `web-intelligence-evaluation.json` there (`package.json`).
