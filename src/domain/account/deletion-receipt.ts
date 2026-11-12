/*
 * The browser receipt of an Apple-account deletion (backend `_shared/apple_deletion_receipt.ts`, contract §1.5 C):
 * `base64url(JSON) "." base64url(HMAC-SHA256(key, "investao.apple-deletion.v1." + data))`, key = 32 bytes from
 * the 64-hex server secret. Only the website server holds the secret; this module runs in route handlers only.
 * Every check fails closed: any problem is `null`, never a partial receipt.
 */

export type DeletionOutcome = "deleted" | "cancelled" | "failed";

export interface DeletionReceipt {
  readonly version: 1;
  readonly audience: "investao-web-account-deletion";
  readonly userID: string;
  readonly challenge: string;
  readonly outcome: DeletionOutcome;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export const RECEIPT_AUDIENCE = "investao-web-account-deletion";
const SIGNING_PREFIX = "investao.apple-deletion.v1.";
const MAX_TOKEN_LENGTH = 4096;
/** Receipts live five minutes; a clock this far ahead of ours is tolerated. */
const LIFETIME_S = 300;
const CLOCK_SKEW_S = 30;

const HEX_64 = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const OUTCOMES: readonly string[] = ["deleted", "cancelled", "failed"];

export const isReceiptSecret = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
export const isChallenge = (value: unknown): value is string => typeof value === "string" && HEX_64.test(value);

const encoder = new TextEncoder();

function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("encoding");
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export const toBase64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  const bytes = Uint8Array.from(secret.match(/../g)!, (pair) => parseInt(pair, 16));
  return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

/** Signs a receipt exactly as the backend does; tests and the local stub use it, production never does. */
export async function signDeletionReceipt(secret: string, receipt: DeletionReceipt): Promise<string> {
  if (!isReceiptSecret(secret)) throw new Error("Receipt signing unavailable");
  const data = toBase64url(encoder.encode(JSON.stringify(receipt)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), encoder.encode(`${SIGNING_PREFIX}${data}`));
  return `${data}.${toBase64url(new Uint8Array(signature))}`;
}

/**
 * The receipt if its signature, version, audience, identifiers, outcome and lifetime are all valid at `now`.
 * The signature check is Web Crypto's `verify`, which compares in constant time.
 */
export async function verifyDeletionReceipt(secret: string | null, token: string | null, now: number): Promise<DeletionReceipt | null> {
  if (!isReceiptSecret(secret) || typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), fromBase64url(parts[1]), encoder.encode(`${SIGNING_PREFIX}${parts[0]}`));
    if (!valid) return null;
    const value = JSON.parse(new TextDecoder().decode(fromBase64url(parts[0]))) as Record<string, unknown>;
    const seconds = Math.floor(now / 1000);
    if (
      value.version !== 1 ||
      value.audience !== RECEIPT_AUDIENCE ||
      typeof value.userID !== "string" ||
      !UUID.test(value.userID) ||
      !isChallenge(value.challenge) ||
      typeof value.outcome !== "string" ||
      !OUTCOMES.includes(value.outcome) ||
      !Number.isInteger(value.issuedAt) ||
      !Number.isInteger(value.expiresAt) ||
      (value.issuedAt as number) > seconds + CLOCK_SKEW_S ||
      (value.expiresAt as number) <= seconds ||
      (value.expiresAt as number) - (value.issuedAt as number) !== LIFETIME_S
    ) {
      return null;
    }
    return value as unknown as DeletionReceipt;
  } catch {
    return null;
  }
}

/** The browser half of an attempt, kept in the HttpOnly attempt cookie between `/start` and `/complete`. */
export interface DeletionAttempt {
  readonly challenge: string;
  readonly userID: string;
  /** The page language to come back to. */
  readonly locale?: "pt" | "en";
}

export const encodeAttempt = (attempt: DeletionAttempt) => toBase64url(encoder.encode(JSON.stringify(attempt)));

export function decodeAttempt(value: string | undefined): DeletionAttempt | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64url(value))) as Record<string, unknown>;
    if (!isChallenge(parsed.challenge) || typeof parsed.userID !== "string" || !UUID.test(parsed.userID)) return null;
    return { challenge: parsed.challenge, userID: parsed.userID.toLowerCase(), locale: parsed.locale === "en" ? "en" : "pt" };
  } catch {
    return null;
  }
}

/** Equal strings, compared without an early exit. */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

/**
 * What a returning browser may act on: the verified receipt's outcome, but only for the attempt this browser
 * started (same challenge and user). No attempt cookie (consumed, expired, or another browser) is `null`.
 */
export async function completeAttempt(input: { secret: string | null; token: string | null; attempt: DeletionAttempt | null; now: number }) {
  if (!input.attempt) return null;
  const receipt = await verifyDeletionReceipt(input.secret, input.token, input.now);
  if (!receipt) return null;
  const challenge = constantTimeEqual(receipt.challenge, input.attempt.challenge);
  const user = constantTimeEqual(receipt.userID.toLowerCase(), input.attempt.userID);
  return challenge && user ? receipt : null;
}
