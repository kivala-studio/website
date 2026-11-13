# W14 bundle analysis

Demo production build (`NEXT_PUBLIC_DATA_MODE=demo npm run build`, client bundle scan passed: 64 client files, 7 patterns). Measured in Chromium against `next start`: every `/_next/static/chunks/*.js` a page loaded, searched for markers of each part of the weekly reading.

| Marker | Part |
|---|---|
| `/api/account/intelligence` | coordinator |
| `includesMarketPublications` | insight engine |
| `hookFamily` | product voice catalogue |
| `saturdayDiscover` | personalisation |
| `investao-intelligence` | database name (sign-out clears it) |

## Loaded per route

| Visitor | Route | Chunks | Raw KB | Gzip KB | Weekly-reading code |
|---|---|---|---|---|---|
| signed out | `/` | 10 | 531 | 161 | none |
| signed out | `/noticias` | 12 | 587 | 183 | none |
| signed out | `/mercado` | 17 | 765 | 238 | database name only |
| signed out | `/mercado/BAIAAAAA` | 17 | 798 | 249 | database name only |
| signed in | `/` | 10 | 531 | 161 | none |
| signed in | `/noticias` | 12 | 587 | 183 | none |
| signed in | `/mercado` | 22 | 1158 | 347 | all |
| signed in | `/inicio` | 23 | 1230 | 369 | all |
| signed in | `/lista` | 23 | 1209 | 364 | all |
| signed in | `/carteira` | 25 | 1260 | 381 | all |
| signed in | `/atividade` | 23 | 1195 | 361 | all |
| signed in | `/definicoes` | 23 | 1214 | 366 | all |

## Findings

- The first build put the engine in the app shell's chunks. Those chunks also loaded for signed-out visitors on `/mercado` and `/mercado/[symbol]`, because the market layout can render the signed-in frame (1159 KB there). After the fix, the shell holds only a context and loads `coordinator` with `import()` once an account is signed in. Signed-out `/mercado` dropped to 765 KB, and its only intelligence code is the database-name constant.
- Coordinator plus engine: one lazy chunk of 32 KB raw, 11 KB gzip. No route manifest references it, so it loads only after sign-in.
- Product voice catalogue: 48 KB raw, 11 KB gzip. Only the four signed-in pages that render observations load it (Watchlist, Portfolio, Home, Activity).
- Personalisation is shared with the existing signed-in stores (W9 Activity and alerts). It does not appear on public pages.
- Engine output is never sent to analytics: no telemetry call takes insight data.
