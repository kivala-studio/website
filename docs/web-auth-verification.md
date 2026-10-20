# Production website verification — 20 October 2026

## Confirmed causes and live fixes

The production Vercel project had no environment variables. This prevented both the browser authentication client and the server-rendered landing prices from using Supabase. Added the project's active `SUPABASE_URL` and modern `SUPABASE_PUBLISHABLE_KEY` to Production and Preview, then redeployed the existing `main` commit `c681e01`. The deployment [completed successfully](https://vercel.com/jos-tonys-projects/website/6kXm3c19jmS7JYehhpLc3tctvUSH) and serves [invest.ao](https://invest.ao/).

A second configuration issue caused the Google loop: Supabase's Site URL was `investao://auth/callback`, and its additional redirect allowlist was empty. Auth logs showed browser OAuth attempts falling back to that native callback. Added the exact `https://invest.ao/auth/callback` URL to the allowlist through the Management API and read the configuration back to verify it. The native Site URL and Google provider configuration were preserved.

## Verified in production

- The public Auth settings endpoint returned HTTP 200 with Google enabled. Anonymous requests to the security catalogue, current quotes RPC and verified closes also returned HTTP 200 using the active publishable key.
- A signed-out Chrome visit to the landing page displayed five real equity quotations, with source dates and movements: BAI, Caixa Angola, BODIVA, BFA and ENSA. The panel does not require authentication.
- Selecting **Continuar com Google** completed the real provider round trip, reached the website's `/auth/callback`, established a session and opened `/dashboard` for an existing account.
- Reloading `/dashboard` retained the authenticated session. Account navigation and the existing account's data were available. A later successful market response displayed 143 instruments and current equity quotations.
- No Google password was entered by the agent, no new account was created, and no user portfolio, watchlist or notification records were changed. The browser was left signed in. Global sign-out was not used because it can affect the account's other device sessions.

Intermittent public Data API HTTP 500 responses were also observed during dashboard checks; the corresponding database logs contained statement timeouts. Anonymous queries currently have a three-second database deadline. Subsequent requests succeeded. The accompanying website change avoids automatic background prefetching of market-backed navigation routes and retries SQLSTATE `57014` once within the existing ten-second request deadline. Reads remain uncached, and permission/other errors are not retried. Three focused HTTP-fixture checks verify fresh-response recovery, bounded retries and immediate failure for other errors. This does not raise database timeouts or change financial-data validation; persistent backend slowness can still surface an error.

## Existing callback behavior and automated coverage

OAuth requests one exact `/auth/callback` URL per origin. The internal destination/query remains in tab-scoped sessionStorage for at most 30 minutes and is consumed once. Legacy callback destinations remain supported and sanitized. The installed Supabase client owns automatic PKCE exchange; the callback reuses initialization rather than exchanging a one-time code twice.

`tests/web-auth.test.mjs` covers exact callback URLs, one-time destinations and expiry, fixed error messages, denied storage, and installed-client PKCE exchange/session persistence using intercepted fictional responses. Those checks do not replace the production provider verification above.

## Remaining coverage

- Apple provider consent and return have not been verified by this check. A successful Google login does not establish Apple behavior.
- Localhost and preview callback allowlisting were not changed or verified. Add each intended callback explicitly before testing that origin.
- Repeat cancellation, first-account onboarding and custom destination/query checks when testing changes to those paths. This production check used an existing account and the default `/dashboard` destination.

References: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google), [Management API Auth configuration](https://supabase.com/docs/reference/api/v1-update-auth-service-config).
