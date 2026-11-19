import { describe, expect, it } from "vitest";

import { issuerLogoPath, logoImageType, resolvedLogoURL } from "./logo";

describe("issuer logos", () => {
  it("prefers the curated issuer logo", () => {
    expect(resolvedLogoURL({ logoURL: "https://cdn.example.com/bai.png", websiteURL: "https://www.bancobai.ao" })).toBe(
      "https://cdn.example.com/bai.png",
    );
  });

  it("falls back to the official website icon", () => {
    const url = new URL(resolvedLogoURL({ websiteURL: "https://www.bancobai.ao" }) ?? "");
    expect(url.host).toBe("www.google.com");
    expect(url.searchParams.get("domain_url")).toBe("https://www.bancobai.ao");
    expect(url.searchParams.get("sz")).toBe("128");
  });

  it("has no source without issuer metadata", () => {
    expect(resolvedLogoURL({})).toBeUndefined();
  });

  it("builds the same-origin path only for a well-formed issuer id", () => {
    expect(issuerLogoPath("7398E912-AAF8-430F-AAAE-883931C9CD84")).toBe("/api/logos/7398e912-aaf8-430f-aaae-883931c9cd84");
    expect(issuerLogoPath("../secrets")).toBeUndefined();
    expect(issuerLogoPath(undefined)).toBeUndefined();
  });

  it("accepts raster types only", () => {
    expect(logoImageType("image/png")).toBe("image/png");
    expect(logoImageType("Image/JPEG; charset=binary")).toBe("image/jpeg");
    expect(logoImageType("image/vnd.microsoft.icon")).toBe("image/x-icon");
    expect(logoImageType("image/svg+xml")).toBeUndefined();
    expect(logoImageType("text/html")).toBeUndefined();
    expect(logoImageType(null)).toBeUndefined();
  });
});
