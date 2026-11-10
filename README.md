# invest.ao website

Marketing site, public market pages and the signed-in web app for invest.ao.

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_DATA_MODE=demo and SITE_URL=http://localhost:3000
npm ci
npm run dev
```

| Command | What it does |
|---|---|
| `npm run check` | ESLint, `tsc --noEmit`, Vitest |
| `npm run build` | Production build, then the client bundle scan |
| `npm run e2e` | Playwright against a production build in `demo` mode |
| `npm run lhci` | Lighthouse CI budgets (mobile: LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms) |

Rules, routes and run modes: [AGENTS.md](AGENTS.md). Plan: [docs/plan](docs/plan). References: [docs/reference](docs/reference).
