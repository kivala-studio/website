# Web auth verification — 20 October 2026

- Live public Auth settings returned HTTP 200 with Google and Apple enabled. This endpoint does not reveal the redirect allowlist or verify the provider credentials/consent round trip.
- OAuth now requests one exact `/auth/callback` URL per origin. The internal destination/query stays in tab-scoped sessionStorage for at most 30 minutes and is consumed once. Legacy callback destinations remain supported and sanitized.
- The installed Supabase browser client owns automatic PKCE exchange. The callback waits for/reuses initialization; it does not exchange the same one-time code again. Existing users default to `/dashboard`, and users who need onboarding retain their destination through `/conta`.
- Cancelled, expired and failed callbacks reopen the landing modal with fixed error messages, without reflecting raw provider text. A browser check of the local cancellation callback returned to `/?entrar=1&next=%2Fpesquisa%3Fq%3DBAI&auth_error=cancelled`, preserved the destination and displayed readable feedback.
- Four focused checks pass in `tests/web-auth.test.mjs`: exact callback/one-time destinations and expiry; callback error handling; storage-denied fallback; and actual installed-client PKCE exchange, verified-user lookup, reload persistence and local sign-out using intercepted fictional responses. Google/Apple authorization URL generation includes the PKCE challenge and stable callback.
- Production build/TypeScript, focused ESLint and diff checks pass. No remote Auth configuration, provider secrets, account data or database schema was changed.

## Remaining live provider verification

The computer-use browser security policy blocked navigation from the Google button to the external provider. No alternate browser, direct provider request or other workaround was used. A user must complete real Google and Apple sign-in before end-to-end provider login can be marked verified. No real provider credentials were entered and no account was created.

Allow `http://localhost:3100/auth/callback` for local testing and `https://invest.ao/auth/callback` for production in the Supabase redirect configuration. Real verification must check return to the requested page, persisted access after reload, onboarding when applicable, and sign-out returning protected routes to the landing modal. Live redirect allowlisting remains unconfirmed by this audit.

### Manual acceptance check (repeat for each provider)

1. Open `http://localhost:3100/?entrar=1&next=%2Fpesquisa%3Fq%3DBAI` and complete sign-in with Google or Apple in that same tab.
2. Confirm the browser returns to `/pesquisa?q=BAI`. If onboarding is required, finish or skip its optional steps and confirm that the same destination opens afterward.
3. Reload and confirm that the account remains signed in. Open `/conta`, sign out, then visit `/pesquisa?q=BAI` again; the landing sign-in modal must open with that destination preserved.
4. Start another attempt and cancel at the provider, where cancellation is available. Confirm that the landing modal explains the cancellation and still retains the search destination.

Record the provider, tested origin and observed results separately. A Google result does not verify Apple, and a localhost result does not verify the production redirect allowlist. For the PR preview, the exact callback is `https://website-git-feat-web-app-parity-jos-tonys-projects.vercel.app/auth/callback`; it also needs an allowed redirect before a preview provider round trip can succeed.

References: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google), [Apple sign-in](https://supabase.com/docs/guides/auth/social-login/auth-apple). The installed `@supabase/auth-js` source was also inspected to confirm its PKCE initialization behavior.
