import { describe, expect, it } from "vitest";

import { type DeletionReceipt, completeAttempt, constantTimeEqual, decodeAttempt, encodeAttempt, signDeletionReceipt, verifyDeletionReceipt } from "./deletion-receipt";

// A test key, never a deployed one. The vector was signed by the backend's `signDeletionReceipt`.
const SECRET = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const USER = "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60";
const CHALLENGE = `${"a".repeat(32)}0123456789abcdef0123456789abcdef`;
const ISSUED = 1_794_000_000;
const VECTOR =
  "eyJ2ZXJzaW9uIjoxLCJhdWRpZW5jZSI6ImludmVzdGFvLXdlYi1hY2NvdW50LWRlbGV0aW9uIiwidXNlcklEIjoiNmYxYzJhNGUtOGIzZC00YzVlLTlmN2EtMWIyYzNkNGU1ZjYwIiwiY2hhbGxlbmdlIjoiYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWEwMTIzNDU2Nzg5YWJjZGVmMDEyMzQ1Njc4OWFiY2RlZiIsIm91dGNvbWUiOiJkZWxldGVkIiwiaXNzdWVkQXQiOjE3OTQwMDAwMDAsImV4cGlyZXNBdCI6MTc5NDAwMDMwMH0.1tnkR8uEDyvYywmDH7UZbdpTLyTYhYA3MQA9csp_-Sc";
const NOW = (ISSUED + 60) * 1000;

const receipt = (overrides: Partial<Record<keyof DeletionReceipt, unknown>> = {}) =>
  ({
    version: 1,
    audience: "investao-web-account-deletion",
    userID: USER,
    challenge: CHALLENGE,
    outcome: "deleted",
    issuedAt: ISSUED,
    expiresAt: ISSUED + 300,
    ...overrides,
  }) as DeletionReceipt;

describe("Apple deletion receipt", () => {
  it("verifies the backend's vector", async () => {
    expect(await verifyDeletionReceipt(SECRET, VECTOR, NOW)).toEqual(receipt());
    expect(await signDeletionReceipt(SECRET, receipt())).toBe(VECTOR);
  });

  it("rejects a tampered signature or payload, and another key", async () => {
    const [data, signature] = VECTOR.split(".");
    // A middle character: the last one also carries padding bits.
    const flipped = `${signature.slice(0, 10)}${signature[10] === "A" ? "B" : "A"}${signature.slice(11)}`;
    expect(await verifyDeletionReceipt(SECRET, `${data}.${flipped}`, NOW)).toBeNull();
    const forged = Buffer.from(JSON.stringify(receipt({ outcome: "cancelled" }))).toString("base64url");
    expect(await verifyDeletionReceipt(SECRET, `${forged}.${signature}`, NOW)).toBeNull();
    expect(await verifyDeletionReceipt("ff".repeat(32), VECTOR, NOW)).toBeNull();
    expect(await verifyDeletionReceipt(null, VECTOR, NOW)).toBeNull();
  });

  it("rejects a wrong audience or version, even when correctly signed", async () => {
    expect(await verifyDeletionReceipt(SECRET, await signDeletionReceipt(SECRET, receipt({ audience: "investao-native" })), NOW)).toBeNull();
    expect(await verifyDeletionReceipt(SECRET, await signDeletionReceipt(SECRET, receipt({ version: 2 })), NOW)).toBeNull();
  });

  it("rejects an expired receipt, one from the future and one with another lifetime", async () => {
    expect(await verifyDeletionReceipt(SECRET, VECTOR, (ISSUED + 300) * 1000)).toBeNull();
    expect(await verifyDeletionReceipt(SECRET, VECTOR, (ISSUED - 31) * 1000)).toBeNull();
    const long = await signDeletionReceipt(SECRET, receipt({ expiresAt: ISSUED + 3600 }));
    expect(await verifyDeletionReceipt(SECRET, long, NOW)).toBeNull();
  });

  it("acts only for the attempt this browser started: same challenge and user", async () => {
    const attempt = { challenge: CHALLENGE, userID: USER };
    expect(await completeAttempt({ secret: SECRET, token: VECTOR, attempt, now: NOW })).toMatchObject({ outcome: "deleted" });
    expect(await completeAttempt({ secret: SECRET, token: VECTOR, attempt: { ...attempt, challenge: "b".repeat(64) }, now: NOW })).toBeNull();
    expect(await completeAttempt({ secret: SECRET, token: VECTOR, attempt: { ...attempt, userID: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f61" }, now: NOW })).toBeNull();
  });

  it("a replay finds no attempt cookie and does nothing", async () => {
    // `/complete` consumes the cookie on the first return; the same receipt again arrives without it.
    expect(await completeAttempt({ secret: SECRET, token: VECTOR, attempt: decodeAttempt(undefined), now: NOW })).toBeNull();
    expect(decodeAttempt(encodeAttempt({ challenge: CHALLENGE, userID: USER, locale: "en" }))).toEqual({ challenge: CHALLENGE, userID: USER, locale: "en" });
    expect(decodeAttempt("not-json")).toBeNull();
  });

  it("compares strings of any length", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
});
