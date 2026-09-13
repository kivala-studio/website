# Invest.ao landing page

The home page uses the app's current IAO monogram and semantic colour palette. The navigation wordmark retains the original Geist font, 27px size, 650 weight, and -1.3px letter spacing.

## Brand sources

- Logo: `Invest.AO/logo.icon/Assets/Investao Logo Icon.svg` in the adjacent app checkout. Both `public/investao-logo.svg` and `app/icon.svg` preserve this asset's geometry, black background, and white mark.
- Colours: `Invest.AO/Core/DesignSystem/SemanticColors.swift`. Light background #F5F7FA, surfaces #FFFFFF, primary text #101318, secondary text #5D6675, accent #146DFF, positive #07875B, separators #DDE2E9.
- The older gold orbit icon under Design/AppIcon is not the active app logo.
- Removed the generic green/ivory theme, invented bar-chart mark, serif headlines, floating cards, and simulated phone.

## Content and launch

- Portuguese copy describes market discovery, portfolio tracking, favourites, and market updates.
- The market table is explicitly an illustration, with fictitious prices and changes. It is not represented as an app screenshot or live market data.
- Launch for iPhone remains in preparation. Add the verified App Store URL when available.
- No new runtime dependencies or personal-data collection. Native links and FAQ disclosures work without client-side JavaScript.

## Verification

- ESLint, production build with TypeScript/static generation, and git whitespace checks.
- Desktop and mobile visual inspection; no horizontal document overflow at 390px or 320px.
- Logo assets load and match the app source apart from a final newline.
- All internal anchors resolve; FAQ expands with Enter.
- Reduced-motion preference disables smooth scrolling and transitions; keyboard focus styles remain visible.

Run `npm run dev` locally, or `npm run build && npm run start` for a production preview.
