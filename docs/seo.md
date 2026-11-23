# SEO and metadata

## Defaults

`src/app/[locale]/layout.tsx`: `metadataBase` is `SITE_URL`; the title template is `%s · invest.ao` with the default `invest.ao`. Pages are indexable unless they opt out.

## Page metadata

`pageMetadata` (`src/features/site/metadata.ts`) builds, for a public page:

- title (absolute for the landing page and `/plus`) and description;
- canonical URL and `hreflang` alternates for `pt`, `en` and `x-default` (the Portuguese URL);
- Open Graph (`siteName` invest.ao, locale `pt_AO` or `en_AO`, type `website`, or `article` with `publishedTime`) and a Twitter `summary_large_image` card;
- with `indexable: false`: `robots: noindex, nofollow`, no canonical and no alternates.

`siteMetadata` wraps it for static pages. Signed-in pages use `signedInMetadata`.

| Page | Indexing |
|---|---|
| `/`, `/policy`, `/termos`, `/suporte`, `/eliminar-conta`, `/mercado`, `/noticias`, `/aprender`, `/plus` (`INDEXABLE_PAGES`, `src/features/site/site.ts`) | Indexable |
| `/mercado/[symbol]`, `/noticias/[slug]`, `/aprender/[lesson]` | Indexable |
| `/convite/[code]`, `/partilha/[token]` | `noindex, nofollow`; `referrer: no-referrer`; the code or token is not in the title or any URL in the metadata |
| `/entrar`, `/mercado/admissao/[event]`, `/mercado/informacao`, `/mercado/informacao/[id]` | `noindex` |
| `/dev/*` | `noindex, nofollow` |

`/partilha/*` also gets `X-Robots-Tag: noindex, nofollow` from `next.config.ts`.

## Open Graph images

- `/og/{locale}-{page}.png` for each entry of `OG_IMAGES` (the indexable pages plus `invite`), 1200 × 630, generated at build time (`src/app/og/[image]/route.tsx`).
- `/og/news/{slug}.png` per article, with the article's title, cached for one hour (`src/app/og/news/[slug]/route.tsx`).
- Both use `ogCard` (`src/features/site/og-card.tsx`): the brand, a title and an accent line, in fixed light colours.

## Sitemap

`src/app/sitemap.ts`, revalidated hourly. Every entry is listed in both languages with its alternates.

| Entries | Change frequency | Priority |
|---|---|---|
| `/` | weekly | 1 |
| `/mercado`, `/noticias` | daily | 0.5 |
| Other fixed pages | monthly | 0.5 |
| Every instrument visible outside search (`isVisibleOutsideSearch`) | daily | 0.6 |
| The seven lessons | monthly | 0.4 |
| The 500 most recent articles, with `lastModified` | monthly | 0.4 |

A failed catalogue or news read leaves those entries out. Share links and invite codes never appear.

## Robots

`src/app/robots.ts`: allow `/`; disallow `/api/`, `/auth/`, `/dev/`, `/en/dev/`; the sitemap is `<SITE_URL>/sitemap.xml`.

## Structured data

JSON-LD scripts carry the request's CSP nonce (`src/features/site/structured-data.tsx`).

| Page | Types |
|---|---|
| `/` | `Organization` |
| `/mercado/[symbol]` | `FinancialProduct` (name, symbol, ISIN, category, provider) and `BreadcrumbList` |
| `/noticias/[slug]` | `NewsArticle` (headline, description, language, date, image, author, publisher, citations) |

## Icons

`src/app/favicon.ico`, `src/app/icon.svg`, `src/app/apple-icon.png`.

## Performance budgets

`lighthouserc.json` runs Lighthouse on `/` and `/policy` (three runs, median): LCP at most 2500 ms, CLS at most 0.1, TBT at most 200 ms, accessibility score at least 0.95; on `/` also performance at least 0.9 and SEO at least 0.95.
