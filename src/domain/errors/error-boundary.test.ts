// Port of Tests/MarketDiscoveryTests/SupabaseErrorBoundaryTests.swift (11 cases).
// The two error-boundary cases run here against `boundaryError`, which repositories rethrow.
// The other nine exercise the Supabase market repository (snapshot assembly, pagination, history
// ranges) and live beside it in src/data/market/repository.test.ts (src/domain may not import it).
import { describe, expect, it } from "vitest";

import pt from "../../../messages/pt.json";
import { AppError, CancellationError, boundaryError, presentError, type ErrorMessageKey } from "./index";

const ptText = (key: ErrorMessageKey): string =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], pt) as string;

describe("Supabase error boundary", () => {
  it("repository throws a domain error instead of the Supabase payload", () => {
    const source = { name: "PostgrestError", code: "42501", message: "private_table SQL", details: null, hint: null, status: 403 };
    const error = boundaryError(source, "supabase.fetchPriceHistory");
    expect(error).toBeInstanceOf(AppError);
    const mapped = error as AppError;
    expect(mapped.category).toBe("unauthorized");
    expect(mapped.cause).toBe(source);
    expect(ptText(presentError(mapped).messageKey)).not.toContain("private_table");
  });

  it("repository preserves cancellation as control flow", () => {
    // postgrest-js turns an aborted fetch into an error body named after the fetch error.
    const aborted = { code: "", message: "AbortError: This operation was aborted", details: "", hint: "" };
    for (const source of [aborted, new DOMException("aborted", "AbortError")]) {
      expect(boundaryError(source, "supabase.fetchPriceHistory")).toBeInstanceOf(CancellationError);
    }
  });
});
