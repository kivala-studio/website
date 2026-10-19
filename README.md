# invest.ao web

The browser client for the same invest.ao accounts and market data used by iOS. Next.js App Router renders public market/editorial content at request time; authenticated browser requests use Supabase Auth and the existing ownership policies.

The public landing page is served at `/`; its dashboard buttons open `/dashboard`. Workspace home navigation returns to `/dashboard`, and “Sobre a invest.ao” opens the landing page.

## Local development

```sh
npm ci
cp .env.example .env.local
npm run dev -- --port 3100
```

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Only modern publishable keys (`sb_publishable_…`) are accepted. Never put a service-role key in the website environment. The publishable key is deliberately delivered to the browser; private rows remain protected by the user's JWT and database RLS.

## Account configuration

Enable the existing Google/Apple providers and allow the website's exact `/auth/callback` URL in Supabase Auth, including `http://localhost:3100/auth/callback` for local testing. Email access supports a magic link or an OTP when the configured template includes one. Use the same provider as iOS to recover the same account.

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
