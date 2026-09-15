# Invest.ao landing page

## Design direction

Reference inspected on 15 September 2026: [Deep Beyond](https://www.deep.ao/en). The adaptation uses its oversized typography, generous section spacing, numbered feature stories, alternating compositions, and prominent closing section. All copy, imagery, and colours belong to Invest.ao.

The page moves through:

1. An oversized headline and a real market screenshot, framed by decorative blue orbital lines.
2. A statement of purpose and three benefits: market discovery, portfolio tracking, and favourites.
3. Three full-width chapters covering the market overview, title details, and comparison. Each pairs specific features with an actual app screenshot; the middle chapter reverses the desktop composition.
4. The existing interactive market preview.
5. Frequently asked questions.
6. A blue iPhone launch section, followed by the privacy link and brand footer.

`app/page.tsx` contains the server-rendered content. `app/product-layout.css` owns the current layout and motion styling; `app/landing.css` retains the app colour tokens, device frames, and market preview styling. The privacy policy is unchanged.

## Motion and navigation

- The headline enters line by line. The phone and orbital decoration have brief entrance animations.
- A small `PageMotion` client component reveals sections once with the Web Animations API and IntersectionObserver. Content is visible in the server-rendered HTML and remains visible without JavaScript.
- Supporting browsers add a small scroll-linked rotation to the opening visual. Other browsers keep its static composition.
- Hover effects respond on links and product screens. There are no looping animations, video downloads, or scroll interception.
- Reduced-motion preferences disable CSS animations, transitions, and smooth scrolling. The reveal component checks the preference and cancels active animations when it changes.
- The sticky navigation becomes a native disclosure menu on mobile. Selecting a link closes it; Escape closes it and returns focus to its summary. FAQs remain native keyboard-operable disclosures.

## Brand and product sources

- Logo: `Invest.AO/logo.icon/Assets/Investao Logo Icon.svg` in the adjacent app checkout. Both `public/investao-logo.svg` and `app/icon.svg` preserve its geometry, black background, and white mark.
- Colours: the app's dark semantic palette. Background #090B0F, card #171B22, elevated surface #12151B, text #F5F7FA, secondary text #A6AFBD, accent #5A9BFF, positive #35C98B, separators #2A303A.
- Typography: Geist for the landing page, with the existing app screenshots and CSS device frames.
- Screenshot prices and dates are historical captures and labelled accordingly. Decorative orbital lines and chapter numerals represent no financial data.
- The preview uses BAI and BCGA with unavailable quotes. Favourites stay in memory and reset on reload. It does not execute trades or connect to an account.
- Launch for iPhone remains in preparation. Add the verified App Store URL when available.
- No new runtime dependencies or personal-data collection.

## Verification

- ESLint and production build, including TypeScript and static page generation.
- Desktop and mobile browser inspection, including 390px and 320px widths.
- Internal anchors, loaded screenshots, mobile menu navigation, keyboard FAQ disclosure, and favourites add/remove and empty-state navigation.
- `git diff --check`.

Run `npm run dev` locally, or `npm run build` followed by `npm run start` for a production preview.
