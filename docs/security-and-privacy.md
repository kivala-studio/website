# Security and privacy

## Response headers

Sent on every response, static assets included (`SECURITY_HEADERS` in `src/config/security.ts`, applied in `next.config.ts`):

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` |

`poweredByHeader` is off. `/partilha/:token` and `/en/partilha/:token` add `Referrer-Policy: no-referrer`, `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`.

## Content-Security-Policy

Built per request in the proxy with a fresh nonce (`buildContentSecurityPolicy`, `src/config/security.ts`; `src/proxy.ts`). Next.js reads the nonce from the `x-nonce` request header. Route handlers under `/api` and `/auth` are outside the proxy's matcher and get no CSP from it; `/api/logos/[issuer]` sets its own `default-src 'none'`.

| Directive | Sources |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self'`, the nonce, `'strict-dynamic'`; `'unsafe-eval'` in development only |
| `style-src` | `'self'` and the nonce; `'unsafe-inline'` instead of the nonce in development only |
| `img-src` | `'self'`, `blob:`, `data:`, the Supabase origin |
| `font-src` | `'self'` |
| `connect-src` | `'self'`, the Supabase origin and its `ws`/`wss` form, `https://us.i.posthog.com`, `https://us-assets.i.posthog.com`, the Sentry DSN's origin |
| `worker-src`, `manifest-src`, `base-uri` | `'self'` |
| `object-src`, `frame-ancestors` | `'none'` |
| `form-action` | `'self'`, plus the site and app origins when the hosts are split |
| `upgrade-insecure-requests` | Added on HTTPS requests only |

Issuer logos are served from the site's origin by `/api/logos/[issuer]`, so `img-src` needs no third-party host. That route takes the source only from the issuer row, requires HTTPS, an image content type, at most 512 KiB and a 4-second timeout.

## Session and cookies

- Session cookies are `HttpOnly`, `SameSite=Lax`, path `/`, `Secure` on HTTPS, with a parent `Domain` when the hosts are split (`src/data/auth/cookies.ts`).
- Identity is verified with `auth.getClaims()` before any account read or write. Data access is also scoped by row-level security on the backend.
- Signed-in responses and every response that sets or clears a session carry `Cache-Control: private, no-store`.
- Sign-out sends `Clear-Site-Data: "cache"`; account deletion sends `"cache", "storage"`.
- All cookies are listed in [configuration.md](configuration.md).

## Request checks

- State-changing route handlers accept only a POST whose `Origin` header equals the request's origin (`isSameOriginPost` in `src/data/auth/request-client.ts`): `/auth/sign-out`, `/auth/local-password`, `/api/account/delete`, `/api/account/apple-deletion/start`, `/api/billing/checkout`, `/api/billing/order/[id]/cancel`.
- Post-sign-in destinations are validated by `safeNextPath` (same-origin absolute path; rejects protocol-relative URLs, backslashes, control characters and the sign-in flow itself) (`src/domain/auth/next-path.ts`).
- Server actions verify the session and compare it with the expected user id before writing (`accountWrite` in `src/features/account/write.ts`).
- Identifiers from the URL are validated (UUIDs with `isUUID`, share tokens, invite codes, article slugs) before any read.
- External links from articles are filtered to safe URLs and opened with `rel="noopener noreferrer"`.

## Secrets

- Only `NEXT_PUBLIC_*` values reach the browser. The build rejects a `NEXT_PUBLIC_SUPABASE_KEY` that contains `service_role` or starts with `sb_secret_` (`parseServerEnv` in `src/config/env.ts`).
- `scripts/scan-client-bundle.mjs` runs after every `next build` and fails when a client chunk contains `service_role`, the name of a server-only variable, the value of a server-only variable (8 characters or longer; `SITE_URL` and `APP_URL` are exempt by value), or the string `local-password`. In builds other than `local`, `local-password` must not appear in server files either.
- The repository holds no secret values; `.env*` is ignored by git except `.env.example`.

## Sensitive values in URLs

- A share token appears only in the visitor's own URL. The server sends it to the backend in a POST body; it is never in metadata, a cache key or a client prop (`src/app/[locale]/(store-linked)/partilha/[token]/page.tsx`).
- An invite code is kept in `sessionStorage`, not a cookie (`src/features/site/invite-keeper.tsx`).
- The checkout's phone number and NIF travel only in a POST body.
- The OAuth callback answers with `Referrer-Policy: no-referrer`.

## Telemetry

`src/data/telemetry`. Off in demo mode and on the server; on in the browser when `NEXT_PUBLIC_POSTHOG_TOKEN` is set.

- Events are sent to PostHog with `fetch`, `credentials: "omit"`. The distinct id is a random UUID per page load, kept in memory only: no cookie, no storage, no identification.
- Every event is rebuilt from an allow-list by `sanitize` (`privacy.ts`). Allowed event names: `$pageview`, `$exception`, `onboarding_started`, `onboarding_step_viewed`, `onboarding_completed`, `telemetry_verification`.
- The code sends two of them: `$pageview` on load and on every client navigation (`src/instrumentation-client.ts`), and `$exception` for handled failures (`src/features/errors/error-presenter.tsx`).
- A page view carries the route template and the locale, never the concrete path (`route-template.ts`). See [divergences.md](divergences.md), G1, for routes missing from the template list.
- Handled failures are reported only for the categories `server`, `serviceUnavailable`, `decoding`, `invalidResponse`, `invalidState`, `unknown`, at most 20 per hour and one per category and domain per minute (`limiter.ts`).

## Crash reports

`src/data/telemetry/sentry.ts`. On when `NEXT_PUBLIC_SENTRY_DSN` is set and the mode is not demo.

- Browser: unhandled errors and promise rejections (`src/instrumentation-client.ts`). Server: `onRequestError` (`src/instrumentation.ts`).
- The event carries the error's type (native JavaScript error names, otherwise `BrowserException`), the fixed text "Unhandled application exception", reduced stack frames, the route template and the environment. It carries no message text, URL, user, breadcrumbs, request data or cookies.
- No Sentry SDK is used; the envelope is posted with `fetch`.

## Maintenance flag

The server asks PostHog's `/flags` endpoint with the fixed distinct id `investao-web` and the person properties `platform: web` and the environment. No visitor data is sent (`src/data/flags/maintenance.ts`).
