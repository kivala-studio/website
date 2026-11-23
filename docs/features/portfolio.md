# Portfolio and simulator

## Ledger

`src/domain/portfolio`, `src/data/account/portfolio.ts`, `src/features/portfolio`.

- The ledger is a list of records of kind `buy`, `sell` or `income`, with `quantity`, `unitPrice`, `fees`, `tradedOn` and an optional `portfolioId` (null is the main portfolio).
- It is read whole at one revision through `get_portfolio_ledger_page` in pages of 500 (`readLedger`), served to the browser by `/api/account/portfolio` together with named portfolios and cash. Amounts cross as exact decimal strings.
- The store re-reads it every 60 seconds while the page is visible (`PORTFOLIO_REFRESH_MS`). Writes wait for the server before they show; a read that started before a write is discarded (`src/features/portfolio/portfolio-store.ts`).
- Records are created with an id chosen by the browser (upsert), so a repeated save stores one record (`src/features/portfolio/actions.ts`).

### Calculation

`src/domain/portfolio/calculator.ts`:

- Buys add cost plus fees. Sales realise proceeds net of fees against average cost. Income adds its gross amount net of withheld tax and never changes quantity.
- Average cost runs per portfolio (`portfolio_id`).
- A sale larger than the holding makes the ledger invalid; nothing is calculated from an invalid ledger.
- Current value uses only quotes the price policy accepts as current; a closing reference never values a position (`usePortfolio` in `src/features/portfolio/use-portfolio.ts`).
- Golden cases: `tests/fixtures/portfolio-ledger.v1.json`, run by `src/domain/portfolio/ledger-fixture.test.ts`.

## Pages

| Route | View | File |
|---|---|---|
| `/carteira` | Skeleton, error, empty state or the dashboard | `portfolio-view.tsx` |
| `/carteira/[id]` | One holding's figures and its records | `position-view.tsx` |
| `/carteira/registos` | Every record, newest first | `position-view.tsx` (`RecordsView`) |
| `/carteira/rendimentos` | Income calendar | `income-view.tsx` |

The area has a rail (left from 1024 px, a strip on top below): the portfolio switcher once named portfolios exist, then the area's pages (`portfolio-rail.tsx`, `src/app/[locale]/(app)/carteira/layout.tsx`). The selected portfolio is remembered under `investao.portfolio.selection` (`selection.ts`).

## Named portfolios (Plus)

Create, rename and delete in the `Carteiras` menu (`book-menu.tsx`). Names are at most 40 characters (`BOOK_NAME_MAX`, `src/domain/portfolio/books.ts`); a duplicate name is reported as a value, not an error. The selection can be one portfolio, the main one, or the combined view.

## Cash (Plus to add)

Movements of kind deposit, withdrawal or fee in `portfolio_cash_movements`. The summary: balance = net deposited, minus fees, minus purchases (price and fees), plus sales and income net of fees (`cashSummary` in `src/domain/portfolio/cash.ts`). A movement with a non-positive amount or a future day is refused before sending (`cashIssues`).

## Benchmark (Plus)

Compares the portfolio chart's range with a reference rate from `market_rates`: `Inflação Homóloga`, `Taxa Básica do BNA`, `Taxa LUIBOR Overnight`, `BTs - 364 Dias` (`BENCHMARK_RATES` in `src/domain/portfolio/benchmark.ts`). The server passes the latest value of each rate to the page (`getBenchmarkQuotes`).

## Income — `/carteira/rendimentos`

`src/domain/portfolio/income-calendar.ts`:

- Covers 365 days back and ahead of today (`INCOME_WINDOW_DAYS`).
- Dividends come from `issuer_dividends`; the entitled quantity is the shares bought before the ex-dividend date, or by the record date when there is none, else before the payment.
- Coupons come from bond terms the user saved in this browser.
- Totals (Plus): upcoming within the next 12 months; every past payment of the last 12 months.

## Results per year and the PDF report (Plus)

`ResultsSection` lists realised gain and net income per year. The report is a PDF built in the browser by `yearReportPdf` (`src/domain/portfolio/year-report.ts`, `src/domain/pdf/document.ts`); no PDF library is used for writing.

## CSV

`src/domain/portfolio/csv.ts`, `src/features/portfolio/csv-transfer.tsx`:

- Export: the ledger as `invest-ao-carteira.csv`.
- Import: a file of at most 2 MB, UTF-8 or Latin-1; either decimal mark; thousands groups, spaces and a `kz`, `aoa` or `%` suffix are tolerated. Each row becomes a record ready to save or a reason it cannot be; a row equal to an existing record is a duplicate. The user reviews the rows before anything is saved.

## Statement reading (Plus)

`src/features/portfolio/statement-reader.ts`:

- A PDF or an image of at most 25 MB is read in the browser. PDFs: the text layer through `pdfjs-dist`, at most 12 pages; pages without text and images go through `tesseract.js` (Portuguese and English).
- The recognition files are copied from `node_modules` to `public/statement` by `scripts/statement-assets.mjs` before `dev` and `build`, and are fetched only when someone reads a statement. `public/statement` is ignored by git.
- The text is turned into the ledger CSV and enters the same review (`src/domain/portfolio/statement.ts`). A line is used only when it names a known symbol and a date is known.

## Share links (Plus)

`src/features/portfolio/share-dialog.tsx`:

- `create_portfolio_share` returns the token once. It is shown in the dialog and never stored or logged by the web. The shared address is `https://invest.ao/partilha/<token>` (`SHARE_ORIGIN`).
- Links are listed by label and date and revoked by deleting the `portfolio_shares` row. A label is at most 40 characters. Sharing is not offered on the combined view.

### The shared page — `/partilha/[token]`

`src/app/[locale]/(store-linked)/partilha/[token]/page.tsx`, `src/data/portfolio/shared-portfolio.ts`:

- The token must match `^[A-Za-z0-9_-]{32}$`. It is sent only in the body of a server-side `no-store` POST and never appears in metadata, a canonical URL, the sitemap, a cache key or a client prop.
- Response headers: `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` (`next.config.ts`).
- A malformed, unknown or revoked link renders one not-found state.
- Positions are calculated by the same ledger calculator and valued in the browser at current public prices. Cash is not shown.

## Simulator — `/simulador`

`src/domain/simulation/simulation.ts`, `src/features/simulation`.

- A hypothetical projection, independent of market data and portfolio records: grow the previous balance, then contribute at month end.
- Fields: initial investment, monthly contribution, duration in months, annual return in percent. Limits: amounts up to 1 000 000 000 000, annual return up to 100 %, duration up to 600 months.
- Optionally based on an instrument: an equity or fund with a usable, positive quote in AOA. Bonds never qualify (`src/domain/simulation/eligibility.ts`).
- The draft is kept per account in `sessionStorage` under `investao.simulation.draft.<id>` (`src/features/simulation/draft-store.ts`).
- The route requires a session.

## Tests

`tests/e2e/portfolio.spec.ts`, `portfolio-advanced.spec.ts`, `simulation.spec.ts`; unit tests in `src/domain/portfolio`, `src/domain/simulation`, `src/features/portfolio/portfolio-store.test.ts`.
