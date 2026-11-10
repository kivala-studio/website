import { describe, expect, it } from "vitest";

import { EnvError, parseServerEnv } from "./env";

const problemsOf = (source: Record<string, string>) => {
  try {
    parseServerEnv(source);
    return [];
  } catch (error) {
    if (error instanceof EnvError) return error.problems;
    throw error;
  }
};

describe("parseServerEnv", () => {
  it("accepts demo mode without backend values", () => {
    const env = parseServerEnv({ NEXT_PUBLIC_DATA_MODE: "demo", SITE_URL: "http://localhost:3000/" });
    expect(env).toMatchObject({ dataMode: "demo", siteUrl: "http://localhost:3000", supabaseUrl: null });
  });

  it("names every missing required variable", () => {
    expect(problemsOf({})).toEqual(["NEXT_PUBLIC_DATA_MODE is missing", "SITE_URL is missing"]);
    expect(problemsOf({ NEXT_PUBLIC_DATA_MODE: "production", SITE_URL: "https://invest.ao" })).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL is missing",
      "NEXT_PUBLIC_SUPABASE_KEY is missing",
    ]);
  });

  it("reads Android App Links only when package and fingerprints are both set", () => {
    const base = { NEXT_PUBLIC_DATA_MODE: "demo", SITE_URL: "https://invest.ao" };
    const fingerprint = Array.from({ length: 32 }, () => "ab").join(":");
    expect(parseServerEnv(base).androidApp).toBeNull();
    expect(parseServerEnv({ ...base, ANDROID_APP_PACKAGE: "ao.invest.android" }).androidApp).toBeNull();
    expect(
      parseServerEnv({ ...base, ANDROID_APP_PACKAGE: "ao.invest.android", ANDROID_APP_SHA256_FINGERPRINTS: ` ${fingerprint} ` })
        .androidApp,
    ).toEqual({ packageName: "ao.invest.android", sha256Fingerprints: [fingerprint.toUpperCase()] });
    expect(problemsOf({ ...base, ANDROID_APP_SHA256_FINGERPRINTS: "AB:CD" })).toEqual([
      "ANDROID_APP_SHA256_FINGERPRINTS must be comma-separated SHA-256 fingerprints (AB:CD:…)",
    ]);
  });

  it("rejects secret keys and insecure URLs", () => {
    expect(
      problemsOf({
        NEXT_PUBLIC_DATA_MODE: "local",
        NEXT_PUBLIC_SUPABASE_URL: "http://example.com",
        NEXT_PUBLIC_SUPABASE_KEY: "sb_secret_abc",
        SITE_URL: "https://invest.ao",
      }),
    ).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL must use https (http is allowed only for localhost)",
      "NEXT_PUBLIC_SUPABASE_KEY must be the publishable key, not a secret key",
    ]);
  });
});
