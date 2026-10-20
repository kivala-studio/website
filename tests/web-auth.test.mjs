import test from "node:test";
import assert from "node:assert/strict";
import {
  authCallbackIssue,
  authIssueMessage,
  consumeAuthDestination,
  failedSignInPath,
  oauthCallbackURL,
  rememberAuthDestination,
} from "../lib/web-auth.ts";

function browser(href) {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const window = Object.assign(new EventTarget(), {
    location: new URL(href), localStorage: storage, sessionStorage: storage,
  });
  window.history = { state: null, replaceState: (_state, _title, url) => { window.location = new URL(url); } };
  return window;
}

test("OAuth callback stays exact while a tab retains and consumes its internal destination", () => {
  globalThis.window = browser("http://localhost:3100/");
  try {
    assert.equal(oauthCallbackURL(window.location.origin), "http://localhost:3100/auth/callback");
    rememberAuthDestination("/pesquisa?q=BAI", 1000);
    assert.equal(consumeAuthDestination(null, 1001), "/pesquisa?q=BAI");
    assert.equal(consumeAuthDestination(null, 1002), "/dashboard");
    rememberAuthDestination("https://attacker.invalid", 1000);
    assert.equal(consumeAuthDestination(null, 1001), "/dashboard");
    rememberAuthDestination("/lista", 1000);
    assert.equal(consumeAuthDestination(null, 1000 + 31 * 60000), "/dashboard");
    assert.equal(consumeAuthDestination("/mercado?tipo=accoes"), "/mercado?tipo=accoes");
  } finally { delete globalThis.window; }
});

test("cancelled and expired callbacks return to a useful modal without reflecting raw provider errors", () => {
  const query = authCallbackIssue("https://invest.ao/auth/callback?error=access_denied");
  const fragment = authCallbackIssue("https://invest.ao/auth/callback#error=access_denied&error_description=untrusted");
  assert.equal(query, "cancelled");
  assert.equal(fragment, "cancelled");
  assert.equal(authCallbackIssue("https://invest.ao/auth/callback", {code:"bad_code_verifier"}), "expired");
  const destination = new URL(failedSignInPath("/pesquisa?q=BAI", fragment), "https://invest.ao");
  assert.equal(destination.searchParams.get("next"), "/pesquisa?q=BAI");
  assert.equal(destination.searchParams.get("auth_error"), "cancelled");
  assert.ok(authIssueMessage("cancelled"));
  assert.equal(authIssueMessage("untrusted provider message"), "");
});

test("blocked destination storage falls back safely without breaking callback handling", () => {
  globalThis.window = { get sessionStorage() { throw new Error("Storage blocked"); } };
  try {
    assert.doesNotThrow(() => rememberAuthDestination("/lista"));
    assert.equal(consumeAuthDestination(null), "/dashboard");
    assert.equal(consumeAuthDestination("//attacker.invalid"), "/dashboard");
  } finally { delete globalThis.window; }
});

test("installed browser client performs one PKCE exchange, restores the verified session and signs out", async () => {
  // All provider/token/user traffic in this test is fictional and intercepted.
  // It never opens a provider page, signs in a real account or sends real tokens.
  const originalFetch = globalThis.fetch;
  const originalChannel = globalThis.BroadcastChannel;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const clients = [];
  const requests = [];
  const user = { id:"00000000-0000-4000-8000-000000000001", aud:"authenticated", role:"authenticated", email:"fixture@example.invalid", created_at:"2025-01-01T00:00:00Z", app_metadata:{provider:"google"}, user_metadata:{investao_onboarding_completed:true} };
  globalThis.window = browser("http://localhost:3100/");
  Object.defineProperty(globalThis, "localStorage", {value:window.localStorage, configurable:true, writable:true});
  globalThis.document = Object.assign(new EventTarget(), { visibilityState:"hidden" });
  globalThis.BroadcastChannel = undefined;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://web-auth-fixture.invalid");
    requests.push({ path:url.pathname, body:init?.body });
    if (url.pathname.endsWith("/token")) {
      const body = JSON.parse(init.body);
      assert.equal(body.auth_code, "fixture-code");
      assert.ok(body.code_verifier.length >= 43);
      return Response.json({access_token:"fixture-access-token", refresh_token:"fixture-refresh-token", expires_in:3600, token_type:"bearer", user});
    }
    if (url.pathname.endsWith("/user")) return Response.json(user);
    if (url.pathname.endsWith("/logout")) return new Response(null, {status:204});
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  };
  const config = {url:"https://web-auth-fixture.invalid", key:"sb_publishable_fixture"};
  try {
    const first = (await import("../lib/browser-client.ts?auth-test=start")).browserClient(config);
    clients.push(first);
    await first.auth.initialize();
    for (const provider of ["google", "apple"]) {
      const {data, error} = await first.auth.signInWithOAuth({provider, options:{redirectTo:oauthCallbackURL(window.location.origin), skipBrowserRedirect:true}});
      assert.equal(error, null);
      const authorization = new URL(data.url);
      assert.equal(authorization.searchParams.get("provider"), provider);
      assert.equal(authorization.searchParams.get("redirect_to"), "http://localhost:3100/auth/callback");
      assert.equal(authorization.searchParams.get("code_challenge_method"), "s256");
    }
    window.location = new URL("http://localhost:3100/auth/callback?code=fixture-code");
    const callback = (await import("../lib/browser-client.ts?auth-test=callback")).browserClient(config);
    clients.push(callback);
    assert.equal((await callback.auth.getUser()).data.user.id, user.id);
    assert.equal(window.location.searchParams.has("code"), false);
    assert.equal(requests.filter((r) => r.path.endsWith("/token")).length, 1);
    const reloaded = (await import("../lib/browser-client.ts?auth-test=reload")).browserClient(config);
    clients.push(reloaded);
    assert.equal((await reloaded.auth.getUser()).data.user.id, user.id);
    assert.equal(requests.filter((r) => r.path.endsWith("/token")).length, 1);
    assert.equal((await reloaded.auth.signOut({scope:"local"})).error, null);
    assert.equal((await reloaded.auth.getSession()).data.session, null);
  } finally {
    for (const client of clients) await client.auth.stopAutoRefresh();
    globalThis.fetch = originalFetch;
    globalThis.BroadcastChannel = originalChannel;
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else delete globalThis.localStorage;
    delete globalThis.window;
    delete globalThis.document;
  }
});
