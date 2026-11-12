import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { deletionConfirmation } from "@/domain/account/deletion";

vi.mock("server-only", () => ({}));
vi.mock("@/config/public-env", () => ({
  publicEnv: { dataMode: "local", supabaseUrl: "http://127.0.0.1:54321", supabaseKey: "publishable-test-key" },
}));
vi.mock("@/config/server-env", () => ({ serverEnv: { appleWebsiteReceiptSecret: null } }));

const { deleteWithoutApple, startAppleDeletion } = await import("./deletion");
const { ATTEMPT_COOKIE, ATTEMPT_COOKIE_OPTIONS, accountDeleted, toApple } = await import("./deletion-responses");

const USER = "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60";
const SECRET = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const CHALLENGE = "c".repeat(64);

/** A Supabase client double: the verified user, a session token and the RPCs it was asked for. */
function client(providers: string[], id = USER) {
  const rpc = vi.fn(async () => ({ error: null }));
  return {
    rpc,
    auth: {
      getUser: async () => ({ data: { user: { id, identities: providers.map((provider) => ({ provider })), app_metadata: {} } }, error: null }),
      getSession: async () => ({ data: { session: { access_token: "access-token" } } }),
    },
  } as never as Parameters<typeof deleteWithoutApple>[0] & { rpc: typeof rpc };
}

const reply = (body: Record<string, unknown>, status = 200) => vi.fn(async () => Response.json(body, { status }));
const started = { authorizationURL: "https://appleid.apple.com/auth/authorize?state=x", returnPlatform: "web", receiptVersion: 1, userID: USER, expiresAt: "" };

describe("account deletion paths", () => {
  it("an Apple-linked account never calls delete_user_account; another account is refused", async () => {
    const apple = client(["google", "apple"]);
    expect(await deleteWithoutApple(apple, USER)).toBe("retry");
    expect(apple.rpc).not.toHaveBeenCalled();
    const switched = client(["google"], "11111111-2222-4333-8444-555555555555");
    expect(await deleteWithoutApple(switched, USER)).toBe("changed");
    expect(switched.rpc).not.toHaveBeenCalled();
    const google = client(["google"]);
    expect(await deleteWithoutApple(google, USER)).toBe("deleted");
    expect(google.rpc).toHaveBeenCalledWith("delete_user_account");
  });

  it("start sends a fresh web challenge with the session token and accepts only Apple's URL for this user", async () => {
    const send = reply(started);
    const result = await startAppleDeletion(client(["apple"]), USER, { fetch: send, challenge: CHALLENGE, secret: SECRET });
    expect(result).toEqual({ url: started.authorizationURL, attempt: { challenge: CHALLENGE, userID: USER } });
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:54321/functions/v1/apple-web-deletion/start");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer access-token");
    expect(JSON.parse(String(init.body))).toEqual({ returnPlatform: "web", browserChallenge: CHALLENGE });

    for (const body of [
      { ...started, authorizationURL: "https://evil.example/authorize" },
      { ...started, userID: "11111111-2222-4333-8444-555555555555" },
      { ...started, returnPlatform: "native" },
      { ...started, receiptVersion: 2 },
    ]) {
      expect(await startAppleDeletion(client(["apple"]), USER, { fetch: reply(body), challenge: CHALLENGE, secret: SECRET })).toEqual({ failure: "retry" });
    }
  });

  it("start stops before the server without the receipt key, and refuses accounts without Apple", async () => {
    const send = reply(started);
    expect(await startAppleDeletion(client(["apple"]), USER, { fetch: send, secret: null })).toEqual({ failure: "retry" });
    expect(await startAppleDeletion(client(["google"]), USER, { fetch: send, secret: SECRET })).toEqual({ failure: "retry" });
    expect(send).not.toHaveBeenCalled();
  });

  it("the attempt cookie is HttpOnly, Secure, SameSite=Lax, host-only, scoped to the flow and lives five minutes", () => {
    const request = new NextRequest("https://invest.ao/api/account/apple-deletion/start", { method: "POST" });
    const response = toApple(request, started.authorizationURL);
    response.cookies.set(ATTEMPT_COOKIE, "value", ATTEMPT_COOKIE_OPTIONS);
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toMatch(/^investao-apple-deletion=value; /);
    expect(header).toContain("Path=/api/account/apple-deletion");
    expect(header).toContain("Max-Age=300");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header.toLowerCase()).toContain("samesite=lax");
    expect(header).not.toMatch(/domain=/i);
    expect(response.status).toBe(303);
  });

  it("after deletion every account cookie expires and the browser clears its storage", () => {
    const request = new NextRequest("https://invest.ao/api/account/delete", {
      method: "POST",
      headers: { cookie: "sb-ref-auth-token=a; demo-watchlist=b; theme=dark; investao-privacy=on" },
    });
    const response = accountDeleted(request, "pt", null);
    expect(response.headers.get("location")).toBe("https://invest.ao/entrar?motivo=eliminada");
    expect(response.headers.get("clear-site-data")).toBe('"cache", "storage"');
    const cleared = response.cookies.getAll().map((cookie) => cookie.name);
    expect(cleared).toEqual(expect.arrayContaining(["demo-watchlist", ATTEMPT_COOKIE]));
    expect(cleared).not.toContain("theme");
    expect(cleared).not.toContain("investao-privacy");
  });

  it("only a confirmed absence clears the session; another account and an unreachable server keep it", () => {
    expect(deletionConfirmation(USER, { hasSession: true, user: null, error: { code: "user_not_found", status: 403 } })).toBe("gone");
    expect(deletionConfirmation(USER, { hasSession: false, user: null, error: null })).toBe("gone");
    expect(deletionConfirmation(USER, { hasSession: true, user: { id: USER.toUpperCase() }, error: null })).toBe("present");
    expect(deletionConfirmation(USER, { hasSession: true, user: { id: "11111111-2222-4333-8444-555555555555" }, error: null })).toBe("other");
    expect(deletionConfirmation(USER, { hasSession: true, user: null, error: { status: 0 } })).toBe("unknown");
  });
});
