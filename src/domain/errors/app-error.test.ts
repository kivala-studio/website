// Port of Tests/MarketDiscoveryTests/AppErrorTests.swift (13 cases).
import { describe, expect, it } from "vitest";

import pt from "../../../messages/pt.json";
import {
  AppError,
  CancellationError,
  DecodingError,
  ErrorCoordinator,
  HttpError,
  mapError,
  presentError,
  type AppErrorCategory,
  type ErrorMessageKey,
} from "./index";

const ptText = (key: ErrorMessageKey | null): string =>
  key === null ? "" : (key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], pt) as string);

const fetchFailure = (code: string) =>
  Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(code), { code }) });
const sessionMissing = () => ({ __isAuthError: true, name: "AuthSessionMissingError", message: "Auth session missing!", status: 400 });
const authApi = (code: string) => ({ __isAuthError: true, name: "AuthApiError", message: "private", status: 400, code });

/** Lets a test hold a retry open and observe when it started. */
function actionGate() {
  let release!: () => void;
  let markStarted!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  const started = new Promise<void>((resolve) => (markStarted = resolve));
  return {
    wait: () => {
      markStarted();
      return released;
    },
    started: () => started,
    release: () => release(),
  };
}

describe("AppError", () => {
  it("grouped retry stops when authentication expires", async () => {
    const coordinator = new ErrorCoordinator();
    let secondOperationRan = false;
    coordinator.present(new DOMException("timed out", "TimeoutError"), "first", {
      retry: () => {
        throw sessionMissing();
      },
    });
    coordinator.present(fetchFailure("ENETUNREACH"), "second", { retry: () => void (secondOperationRan = true) });
    await coordinator.retryCurrent();
    expect(coordinator.requiresAuthentication).toBe(true);
    expect(secondOperationRan).toBe(false);
    expect(coordinator.isRetrying).toBe(false);
    expect(coordinator.current).toBeNull();
  });

  it("connectivity mapping and Portuguese copy", () => {
    const cases: [unknown, AppErrorCategory][] = [
      [fetchFailure("ENETUNREACH"), "offline"],
      [new DOMException("timed out", "TimeoutError"), "timeout"],
      [fetchFailure("ECONNRESET"), "connectionLost"],
      [fetchFailure("EAI_AGAIN"), "offline"],
    ];
    for (const [source, category] of cases) {
      const error = mapError(source, "market.load")!;
      expect(error.category).toBe(category);
      expect(error.userCanRetry).toBe(true);
      expect(ptText(presentError(error).actionKey)).toBe("Tentar novamente");
      expect(ptText(presentError(error).messageKey)).toBe("Verifica a ligação à Internet e tenta novamente.");
    }
    const offline = new AppError("offline");
    expect(ptText(presentError(offline).titleKey)).toBe("Sem ligação à Internet");
    expect(ptText(presentError(offline, "refresh").titleKey)).toBe("Não foi possível atualizar os dados");
    expect(presentError(offline, "refresh").style).toBe("banner");
  });

  it("failures describe the operation without changing recovery", () => {
    const cases: [string, string][] = [
      ["portfolio.delete", "Não foi possível eliminar a compra"],
      ["watchlist.BAI", "Não foi possível atualizar a lista de acompanhamento"],
      ["chart.export", "Não foi possível preparar o gráfico para partilhar"],
      ["auth.signOut", "Não foi possível terminar sessão"],
    ];
    for (const [operation, title] of cases) {
      const presentation = presentError(new AppError("server", { operation }), "action");
      expect(ptText(presentation.titleKey)).toBe(title);
      expect(ptText(presentation.actionKey)).toBe("Tentar novamente");
      expect(presentation.style).toBe("banner");
      expect(ptText(presentation.messageKey)).not.toContain(operation);
    }
  });

  it("HTTP and function errors never expose response bodies", () => {
    const cases: [number, AppErrorCategory][] = [
      [400, "validation"],
      [401, "sessionExpired"],
      [403, "unauthorized"],
      [404, "missingData"],
      [408, "timeout"],
      [429, "rateLimited"],
      [500, "server"],
      [503, "serviceUnavailable"],
    ];
    for (const [status, category] of cases) {
      const body = "secret SQL token password";
      const sources = [
        new HttpError(status, body),
        { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code", context: { status, body } },
      ];
      for (const source of sources) {
        const error = mapError(source, "backend.request")!;
        expect(error.category).toBe(category);
        expect(error.httpStatus).toBe(status);
        expect(error.cause).toBe(source);
        expect(ptText(presentError(error).messageKey)).not.toContain("secret");
        expect(ptText(presentError(error).titleKey)).not.toContain("HTTP");
      }
    }
  });

  it("Supabase codes have safe domain categories", () => {
    const cases: [string, AppErrorCategory][] = [
      ["PGRST301", "sessionExpired"],
      ["42501", "unauthorized"],
      ["PGRST002", "serviceUnavailable"],
      ["23505", "validation"],
      ["42883", "server"],
    ];
    for (const [code, category] of cases) {
      const source = { code, details: "private SQL", hint: null, message: "internal RPC failed" };
      const mapped = mapError(source, "supabase.load")!;
      expect(mapped.category).toBe(category);
      expect(ptText(presentError(mapped).messageKey)).not.toContain("RPC");
      expect(mapped.cause).toBe(source);
    }
  });

  it("authentication errors and permission are distinct", () => {
    const missing = mapError(sessionMissing(), "auth")!;
    expect(missing.requiresAuthentication).toBe(true);
    expect(ptText(presentError(missing, "authentication").titleKey)).toBe("Inicia sessão");
    expect(ptText(presentError(missing, "authentication").messageKey)).toBe("Inicia sessão para continuar.");
    expect(mapError(authApi("refresh_token_not_found"), "auth")?.category).toBe("sessionExpired");
    expect(mapError(authApi("invalid_credentials"), "auth")?.category).toBe("validation");
    expect(new AppError("unauthorized").requiresAuthentication).toBe(false);
    expect(new AppError("unauthorized").userCanRetry).toBe(false);
  });

  it("decoding and unknown preserve the original without displaying it", () => {
    const underlying = new DecodingError("private column");
    const error = mapError(underlying, "decode")!;
    expect(error.category).toBe("decoding");
    expect(error.userCanRetry).toBe(false);
    expect(error.cause).toBe(underlying);
    expect(ptText(presentError(error).titleKey)).toBe("Não foi possível apresentar os dados");
    expect(mapError(new Error("test failure"), "unknown")?.category).toBe("unknown");
    expect(mapError(new AppError("unsupportedOperation"), "domain")?.category).toBe("unsupportedOperation");
  });

  it("cancellation, including wrapped fetch cancellation, is not an error", () => {
    const aborted = new DOMException("aborted", "AbortError");
    for (const error of [new CancellationError(), aborted, new AppError("unknown", { cause: aborted })]) {
      expect(mapError(error, "cancelled")).toBeNull();
    }
  });

  it("deduplicated group retains every retry and recovers once", async () => {
    const coordinator = new ErrorCoordinator();
    const attempts: string[] = [];
    coordinator.present(fetchFailure("ENETUNREACH"), "one", { retry: () => attempts.push("obsolete") });
    coordinator.present(fetchFailure("ENETUNREACH"), "one", { retry: () => attempts.push("one") });
    coordinator.present(fetchFailure("ENETUNREACH"), "two", { retry: () => attempts.push("two") });
    expect(coordinator.entries).toHaveLength(2);
    expect(coordinator.current?.id).toBe("one");
    await coordinator.retryCurrent();
    expect(attempts).toEqual(["one", "two"]);
    expect(coordinator.current).toBeNull();
    expect(coordinator.isRetrying).toBe(false);
  });

  it("concurrent retries are blocked and a failed retry remains visible", async () => {
    const coordinator = new ErrorCoordinator();
    const gate = actionGate();
    let attempts = 0;
    coordinator.present(new DOMException("timed out", "TimeoutError"), "one", {
      retry: async () => {
        attempts += 1;
        await gate.wait();
        throw new DOMException("timed out", "TimeoutError");
      },
    });
    const first = coordinator.retryCurrent();
    await gate.started();
    await coordinator.retryCurrent();
    expect(attempts).toBe(1);
    gate.release();
    await first;
    expect(coordinator.current?.error.category).toBe("timeout");
    expect(coordinator.isRetrying).toBe(false);
  });

  it("permanent errors have no retry and session failures use one recovery path", async () => {
    const coordinator = new ErrorCoordinator();
    let retried = false;
    coordinator.present(new AppError("decoding"), "decode", { retry: () => void (retried = true) });
    await coordinator.retryCurrent();
    expect(retried).toBe(false);
    expect(coordinator.current?.retry).toBeNull();
    coordinator.present(sessionMissing(), "one");
    coordinator.present(sessionMissing(), "two");
    expect(coordinator.requiresAuthentication).toBe(true);
    expect(coordinator.current).toBeNull();
    coordinator.reset();
    expect(coordinator.requiresAuthentication).toBe(false);
  });

  it("cancelled work does not present an unrelated failure", () => {
    const coordinator = new ErrorCoordinator();
    const controller = new AbortController();
    controller.abort();
    coordinator.present(new Error("test failure"), "cancelled", { signal: controller.signal });
    expect(coordinator.current).toBeNull();
  });

  it("coordinator reset invalidates an in-flight retry", async () => {
    const coordinator = new ErrorCoordinator();
    const gate = actionGate();
    coordinator.present(new DOMException("timed out", "TimeoutError"), "one", {
      retry: async () => {
        await gate.wait();
        throw new DOMException("timed out", "TimeoutError");
      },
    });
    const task = coordinator.retryCurrent();
    await gate.started();
    coordinator.reset();
    gate.release();
    await task;
    expect(coordinator.current).toBeNull();
    expect(coordinator.isRetrying).toBe(false);
  });
});
