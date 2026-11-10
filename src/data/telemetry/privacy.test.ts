import { describe, expect, it } from "vitest";

import { AppError } from "@/domain/errors";

import { TelemetryErrorLimiter } from "./limiter";
import { operationDomain, sanitize } from "./privacy";
import { createCrashReporter } from "./sentry";
import { Telemetry } from "./telemetry";

/*
 * Port of Tests/MarketDiscoveryTests/TelemetryPrivacyTests.swift (4 cases) with `platform: "web"`,
 * plus the W3 exit checks: route templates and no user id, token, instrument id or amount on the wire.
 */

const SECRETS = ["person@example.com", "private-user", "500000", "abc123token", "SEC-UUID-1", "1234.56"];

/** Captures what would leave the browser. */
function wire() {
  const bodies: string[] = [];
  const urls: string[] = [];
  const send: typeof fetch = async (input, init) => {
    urls.push(String(input));
    bodies.push(String(init?.body ?? ""));
    return new Response(null, { status: 200 });
  };
  return { bodies, urls, send };
}

describe("telemetry privacy", () => {
  it("product events drop account, financial and free-text properties", () => {
    const input = {
      email: "person@example.com",
      user_id: "private-user",
      balance: 500000,
      query: "private search",
      $set: { name: "Private" },
      $pathname: "/carteira",
      locale: "pt",
      $lib_version: "1.1.1",
      onboarding_step: "portfolio",
      completion_method: "skipped",
    };
    const safe = sanitize("$pageview", input, "production")!;
    expect(safe.$pathname).toBe("/carteira");
    expect(safe.$lib_version).toBe("1.1.1");
    expect(safe.environment).toBe("production");
    expect(safe.platform).toBe("web");
    expect(safe.$process_person_profile).toBe(false);
    for (const key of ["email", "user_id", "balance", "query", "$set"]) expect(safe[key], key).toBeUndefined();
    expect(sanitize("$identify", input, "production")).toBeNull();
    expect(sanitize("arbitrary user text", input, "production")).toBeNull();
    const unknown = sanitize("$pageview", { $pathname: "/carteira/secret-account" }, "untrusted")!;
    expect(unknown.$pathname).toBeUndefined();
    expect(unknown.environment).toBe("development");
  });

  it("browser errors keep symbolication metadata but remove descriptions, paths and context", () => {
    const input = {
      $exception_level: "fatal",
      url: "https://example.com/private?token=secret",
      $exception_list: [
        {
          type: "TypeError",
          value: "Balance 500000 account private-user",
          userinfo: { token: "secret" },
          mechanism: { type: "onerror", handled: false, data: { private: "secret" } },
          stacktrace: {
            frames: [
              {
                filename: "https://invest.ao/_next/static/chunks/app.js?token=secret",
                abs_path: "/Users/private/project/app.js",
                function: "perform",
                lineno: 1,
                colno: 2,
                vars: { balance: 500000 },
              },
            ],
          },
        },
      ],
    };
    const safe = sanitize("$exception", input, "production")!;
    const [exception] = safe.$exception_list as Record<string, unknown>[];
    expect(exception.type).toBe("TypeError");
    expect(exception.value).toBe("Unhandled application exception");
    const [frame] = (exception.stacktrace as { frames: Record<string, unknown>[] }).frames;
    expect(frame.lineno).toBe(1);
    expect(frame.filename).toBe("app.js");
    const serialized = JSON.stringify(safe);
    for (const secret of ["private-user", "500000", "secret", "/Users/", "userinfo", "abs_path", "vars", "example.com"]) {
      expect(serialized, secret).not.toContain(secret);
    }
  });

  it("handled error limiter suppresses routine failures, duplicates and bursts", () => {
    const limiter = new TelemetryErrorLimiter();
    const now = 1_000_000_000;
    expect(limiter.allows("offline", "market.load", now)).toBe(false);
    expect(limiter.allows("validation", "portfolio.save", now)).toBe(false);
    expect(limiter.allows("server", "market.load", now)).toBe(true);
    expect(limiter.allows("server", "market.refresh", now + 1000)).toBe(false);
    for (let index = 1; index < 20; index += 1) expect(limiter.allows("server", "market.load", now + index * 61_000)).toBe(true);
    expect(limiter.allows("unknown", "account.delete", now + 1_300_000)).toBe(false);
    expect(limiter.allows("server", "market.load", now + 3_600_000)).toBe(true);
  });

  it("the identity is random per page load and operation names keep only their domain", () => {
    const { bodies, send } = wire();
    let next = 0;
    const randomId = () => `page-load-${(next += 1)}`;
    new Telemetry({ token: "phc_test", environment: "production", send, randomId }).pageview("/");
    new Telemetry({ token: "phc_test", environment: "production", send, randomId }).pageview("/");
    expect(bodies.map((body) => JSON.parse(body).distinct_id)).toEqual(["page-load-1", "page-load-2"]);
    expect(operationDomain("portfolio.account-private-uuid.balance")).toBe("portfolio");
    expect(operationDomain("private-account-uuid")).toBe("application");
  });

  it("a share link is reported as /partilha/[token]", () => {
    const { bodies, send } = wire();
    const telemetry = new Telemetry({ token: "phc_test", environment: "production", send });
    telemetry.pageview("https://invest.ao/en/partilha/abc123token?ref=x#y");
    const event = JSON.parse(bodies[0]);
    expect(event.properties.$pathname).toBe("/partilha/[token]");
    expect(event.properties.locale).toBe("en");
    expect(bodies[0]).not.toContain("abc123token");
  });

  it("no user id, token, instrument id or amount can be sent", async () => {
    const { bodies, send } = wire();
    const telemetry = new Telemetry({ token: "phc_test", environment: "production", send });
    telemetry.capture("$pageview", {
      $pathname: "/mercado/SEC-UUID-1",
      user_id: "private-user",
      email: "person@example.com",
      security_id: "SEC-UUID-1",
      amount: 1234.56,
      $current_url: "https://invest.ao/partilha/abc123token",
    });
    telemetry.pageview("/carteira/posicao/SEC-UUID-1?amount=1234.56");
    telemetry.reportError(new AppError("server", { operation: "portfolio.private-user.SEC-UUID-1", httpStatus: 500 }));
    const crash = createCrashReporter({ dsn: "https://key@o1.ingest.sentry.io/42", environment: "production", send });
    const error = new TypeError("amount 1234.56 for private-user");
    error.stack = "TypeError: amount 1234.56 for private-user\n    at value (https://invest.ao/_next/static/chunks/page.js?token=abc123token:1:2)";
    await crash(error, "https://invest.ao/partilha/abc123token");
    expect(bodies).toHaveLength(4);
    for (const body of bodies) for (const secret of SECRETS) expect(body, secret).not.toContain(secret);
    expect(bodies.at(-1)).toContain("/partilha/[token]");
  });
});
