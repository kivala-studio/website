# Invest.ao landing page

The home page introduces the iPhone app in Angolan Portuguese, with an ivory and forest-green visual identity, an illustrative device preview, three feature cards, getting-started steps, native expandable FAQs, and launch information.

## Content and launch

- Product scope is based on the adjacent Invest.ao app: market discovery, favourites, portfolio tracking, and market updates.
- All preview balances, prices, and percentage changes are fictional and labelled as such.
- No verified App Store URL was available during implementation. The page explicitly says the launch is in preparation; replace the launch status with the verified App Store link when available.
- There is no registration form or personal-data collection. Navigation and FAQs work without client-side JavaScript.
- Metadata and document language use Portuguese for Angola. The custom SVG icon matches the landing-page wordmark.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript and static generation.
- `git diff --check`: passed.
- Production page visually inspected at desktop and 390px mobile width.
- No horizontal document overflow at 1280px, 390px, or 320px viewport widths.
- Every internal anchor resolves to an existing section.
- FAQ opens using Enter; back-to-top navigation works.
- Browser console reported no errors or warnings.
- Reduced-motion preference disables smooth scrolling and transitions; links and summaries have visible keyboard focus styles.

Run `npm run dev` for development or `npm run build && npm run start` for a production preview.
