# invest.ao web

The browser client for the same invest.ao accounts and market data used by iOS. Next.js App Router renders public market/editorial content at request time; authenticated browser requests use Supabase Auth and the existing ownership policies.

The public landing page is served at `/`; its dashboard buttons open `/dashboard`. Workspace routes wait for the verified browser session and send signed-out visitors to `/?entrar=1&next=…`, which opens Google/Apple sign-in in a modal over the landing page; after sign-in and onboarding, the original route and query are restored. Apple deletion returns keep their receipt-verification path available after sign-out. Legacy `/conta` links also open the landing modal for guests; signed-in visitors use `/conta` for profile, settings and onboarding. Callbacks show only an access-status frame while the session resolves. The streamed price panel reuses `getMarket` and `reading`, including reference dates and expiry behaviour. Download links and the desktop QR code use `appDistribution`; an absent or invalid distribution URL falls back to the web dashboard. Workspace home navigation returns to `/dashboard`, and “Sobre a invest.ao” opens the landing page.

The browser icon, Apple touch icon and brand mark use the native `PalancaMark.imageset/palanca.png` template artwork, copied into `public/palanca.png`. Branding uses a CSS mask to match the current appearance; the browser and Apple icons use a solid light background.

The [dashboard feature audit](docs/dashboard-feature-audit.md) tracks confirmed unfinished features. A shared registry supplies inline “Em desenvolvimento · Em breve” states beside each relevant feature, without a separate dashboard list. Existing working controls remain available; missing data and temporary errors retain their own states. Apple account deletion stays unavailable until its backend is verified and `APPLE_WEB_DELETION_ENABLED=true` is explicitly set alongside the server receipt secret.

The public cookies/storage policy is at `/cookies`, with links from the landing footer, privacy policy and sign-in modal. Its inventory covers the short-lived Apple deletion cookies, browser authentication, preferences, personalisation and recap archives.

On the first visit, the consent prompt offers equally prominent accept-all and reject-optional actions. `investao.cookie-consent.v1` stores the choice for 180 days; the landing footer, policy and account settings can reopen it. Behavioural personalisation and exposure/installation storage stay off until acceptance. Rejecting stops those reads/writes and removes their local records; it does not delete existing server-side account data. Essential authentication, user-selected appearance/privacy settings and requested account features remain available. When browser storage is blocked, the choice lasts only for the current visit. The prompt takes precedence over landing sign-in so two dialogs never compete for focus.

## Appearance

The entire website uses the same light/dark palette as the apps. The landing page always follows the system theme and has no theme selector, even when a different appearance is saved for the dashboard. Access pages, policy pages, the workspace sidebar and account settings offer Sistema, Claro and Escuro. The browser-local `investao.appearance` preference applies before the first paint on those pages and stays in sync across tabs. Sistema follows live OS changes through CSS and is also the fallback when storage is unavailable or the saved value is invalid. Device screenshots and generated social preview images keep their original artwork.

## Local development

```sh
npm ci
cp .env.example .env.local
npm run dev -- --port 3100
```

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Only modern publishable keys (`sb_publishable_…`) are accepted. Never put a service-role key in the website environment. The publishable key is deliberately delivered to the browser; private rows remain protected by the user's JWT and database RLS.

## Account configuration

Enable the existing Google/Apple providers and allow the website's exact `/auth/callback` URL in Supabase Auth, including `http://localhost:3100/auth/callback` for local testing and `https://invest.ao/auth/callback` for production. The provider receives that stable callback URL; the requested workspace route/query is kept in this tab's `investao.auth-return.v1` sessionStorage record, expires after 30 minutes and is consumed once on return. Legacy callback `next` parameters remain supported and validated. The browser SDK detects/exchanges the PKCE code once; the callback reuses its initialization result instead of exchanging it twice. Cancelled or failed callbacks reopen the modal with a fixed, safe explanation and the original internal destination. The supported sign-in methods are Google and Apple; email authentication is not offered. Use the same provider as iOS to recover the same account.

Focused auth checks: `node --experimental-strip-types --test tests/web-auth.test.mjs`. These use the installed browser client and intercepted, fictional token/user responses; they verify PKCE code exchange, session reload, sign-out, exact provider redirect URLs, safe one-time destinations and callback errors. They do not replace real Google/Apple consent and provider-return checks.

See the [web auth verification report](docs/web-auth-verification.md) for confirmed checks and the remaining live provider/allowlist verification.

The website uses the existing watchlist, notification preferences/rules, transaction ledger and account-notification RPCs. No separate web accounts or parallel portfolio database are created. Appearance and privacy are browser-local preferences, matching the device-local iOS model.

Apple account deletion additionally requires the backend platform-return change and `APPLE_WEBSITE_RETURN_URL=https://invest.ao/conta`. The same-origin web endpoint forwards the confirmed account's bearer to the existing Apple flow, checks that the backend supports a web return, and never uses a service credential. Existing native callback configuration must remain unchanged. Do not test deletion against a real account as part of routine verification.

## Verification

```sh
npm run lint
npm run build
node --experimental-strip-types --test tests/market-presentation.test.mjs tests/finance.test.mjs tests/wrap-evidence.test.mjs
npm audit --omit=dev
```

Focused checks cover price/reference eligibility, quotation units, financial precision, backdated sells, historical coverage, monthly compounding and verified recap evidence. See [the parity inventory](docs/web-parity.md) for implementation coverage and remaining release checks.
