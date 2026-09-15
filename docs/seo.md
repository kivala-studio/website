# Invest.ao search visibility and copy

## Audit — 15 September 2026

The public homepage returned HTTP 200 and contained server-rendered text. It had no `noindex` directive. HTTP redirected to HTTPS with status 308. These are useful foundations; the search checks did not establish Google's indexing status or a precise Google ranking.

The homepage title and main heading used an abstract slogan rather than identifying the application or its market. The site had no canonical URLs, sitemap, robots file, structured data, or social sharing image. Both `/robots.txt` and `/sitemap.xml` returned 404. A missing robots file does not itself block crawling; a sitemap helps discovery but does not guarantee indexing.

`https://www.invest.ao` failed certificate validation: the certificate covered only `invest.ao`. Both hostnames resolved to `216.198.79.1`. This requires a hosting/domain fix; application redirects cannot repair a TLS handshake that fails before the HTTP request.

Resolved during this task: `www.invest.ao` was added to the existing Vercel project with a valid certificate and a 308 permanent redirect to `https://invest.ao/`. Live HTTP checks confirmed the HTTPS redirect with normal certificate validation and a 200 response from the destination. HTTP www redirects to HTTPS www, then to the canonical apex.

## Changes

- Professional Portuguese throughout the homepage, feature descriptions, interactive demonstration, FAQs and footer. The title and H1 now identify the Angolan capital market. Existing design and product screenshots are retained.
- Explicit product scope: information, price history, comparison, portfolio organisation and favourites. The iPhone release remains in preparation. The copy does not claim real-time quotations, trading execution, investment advice, returns or an available App Store download.
- `lib/seo.ts` centralises production URLs and page metadata. Each page supplies its own canonical, title, description and Open Graph URL. The privacy policy retains its own metadata.
- `/robots.txt` allows crawling and advertises `/sitemap.xml`. The sitemap contains the two published canonical pages, with no fabricated modification dates.
- Homepage `WebSite` and `Organization` JSON-LD identifies Invest.ao, its logo and existing public contact address. `Invest AO` is an alternate spelling; `Invest Angola` is not presented as an invented brand name. No ratings, prices, regulatory affiliations or rich-result promises are added.
- `/opengraph-image` supplies a 1200 × 630 PNG for sharing. Google Search Console's public HTML ownership tag is included in the root metadata for the property prepared in the signed-in browser.

## Search intent

Prioritise brand discovery (`Invest.ao`, `Invest AO`) and accurate product terms such as `mercado de capitais em Angola`, `acompanhar acções em Angola` and `carteira de investimentos em Angola`. These describe this product. Broad `invest Angola` queries also cover foreign investment and business opportunities, which are a different intent. This is a qualitative interpretation, not keyword-volume research.

After Search Console begins collecting data, use actual queries and impressions to decide which useful educational pages to publish. Any future financial-market guide should identify its author, cite current primary sources, state its review date and link naturally to the relevant product feature. Avoid thin pages created solely for keyword variants.

## Release and indexing checklist

1. Merge and deploy the SEO pull request. Confirm the production homepage and `/policy` return 200, their canonicals use `https://invest.ao`, and `/robots.txt`, `/sitemap.xml` and `/opengraph-image` return 200.
2. The Vercel `www.invest.ao` certificate and permanent redirect are already repaired. Recheck both HTTP and HTTPS variants after deployment with normal certificate validation enabled.
3. Open Google Search Console, select the prepared URL-prefix property `https://invest.ao/`, and complete HTML tag verification after the new tag is live. The verification tag is public ownership proof and must remain deployed. A DNS-verified Domain property can later cover all hostnames and protocols if DNS access is available.
4. Submit `https://invest.ao/sitemap.xml` in Sitemaps. Use URL Inspection on the homepage and privacy page; run the live test and request indexing where appropriate. Record Google's selected canonical and any indexing exclusions.
5. After data is available, establish a baseline for branded and non-branded impressions, clicks, click-through rate and average position. Review again after several weeks. Also inspect mobile usability and Core Web Vitals when enough field data exists.

Google may take days or weeks to crawl changes. Search Console verification and sitemap submission cannot guarantee indexing or first-page rankings.

## Validation

- `npm run lint` and `npm run build` pass.
- Production-server HTTP checks: distinct page titles and canonical URLs; exactly one H1 per page; indexable successful pages; Google verification tag; Open Graph/Twitter metadata; parseable homepage JSON-LD; both sitemap URLs; permissive robots declaration; social PNG dimensions; unknown route returns 404 with `noindex`.
- Browser checks: desktop and mobile layout, headline wrapping, and adding a demonstration favourite then viewing the favourites tab.
- Independent review found no actionable metadata, structured-data, route or product-claim defects.
- Vercel successfully deployed the PR preview. Greptile reported that the account reached its 50-credit trial limit, so no completed Greptile confidence review is available. This is an external review blocker, not a passing review.

Implementation PR: [Improve Invest.ao search visibility and professionalise website copy](https://github.com/kivala-studio/website/pull/8). Production rollout and Search Console verification/submission remain pending merge and deployment.

## References

- [Google: SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google: canonical URL signals](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: request recrawling](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
- [Google: site names](https://developers.google.com/search/docs/appearance/site-names)
- [Search Console: verify ownership](https://support.google.com/webmasters/answer/9008080)

Knowledge-base source labels: `Current main routes and styling`, `Current landing copy`, `Website relevant metadata API`, `SEO review metadata implementation`, `SEO review Next local metadata docs`, `SEO review homepage claims and schema placement`. Live HTTP audit findings are indexed under `execute:javascript` (search `ERR_TLS_CERT_ALTNAME_INVALID`, `robots.txt`, `sitemap.xml`).
