# Invest.ao landing page

The home page uses the app's current IAO monogram and semantic colour palette. The navigation wordmark uses Geist; page text uses the platform system font.

## Product presentation

- References inspected on 15 September 2026: https://www.exodus.com and https://wallet.coinbase.com. The centred headline, overlapping devices, and spacious product sections inform the composition; colours remain the app's own dark theme.
- Three original app screenshots appear in CSS device frames. The market overview leads the hero, with title details and comparisons alongside it. Dedicated feature sections explain each screen. Screenshots are non-clickable.
- CSS entrance, hover and progressive scroll transitions respect reduced-motion settings; unsupported scroll animations leave content visible.
- Screenshot prices and dates are historical captures, clearly labelled separately from the interactive demo. No crypto trading, security, or availability claims were borrowed from the references.
- `app/product-layout.css` owns the product presentation overrides; `app/landing.css` owns app theme tokens and device frames.

## Brand sources

- Logo: `Invest.AO/logo.icon/Assets/Investao Logo Icon.svg` in the adjacent app checkout. Both `public/investao-logo.svg` and `app/icon.svg` preserve this asset's geometry, black background, and white mark.
- Colours: `Invest.AO/Core/DesignSystem/SemanticColors.swift`, dark appearance. Background #090B0F, card surfaces #171B22, elevated surfaces #12151B, primary text #F5F7FA, secondary text #A6AFBD, accent #5A9BFF, positive #35C98B, separators #2A303A. The website uses this dark appearance regardless of the visitor's system preference, with dark browser controls and dark text on blue buttons for contrast.
- The older gold orbit icon under Design/AppIcon is not the active app logo.
- Removed the generic green/ivory theme, invented bar-chart mark, serif headlines, floating cards, and simulated phone.

## Content and launch

- Portuguese copy describes market discovery, portfolio tracking, favourites, and market updates.
- The interactive market preview uses BAI and BCGA with unavailable quotes. It contains no invented prices, performance charts, or simulated app screenshots. Favourites are held only in memory and reset on reload.
- Launch for iPhone remains in preparation. Add the verified App Store URL when available.
- No new runtime dependencies or personal-data collection. Native links and FAQ disclosures work without client-side JavaScript.

## Verification

- ESLint, production build with TypeScript/static generation, and git whitespace checks.
- Desktop and mobile visual inspection; no horizontal document overflow at 390px or 320px.
- Logo assets load and match the app source apart from a final newline.
- All internal anchors resolve; FAQ expands with Enter.
- Reduced-motion preference disables smooth scrolling and transitions; keyboard focus styles remain visible.

Run `npm run dev` locally, or `npm run build && npm run start` for a production preview.
