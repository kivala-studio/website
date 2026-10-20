// Portable Web Crypto contract shared with the website. Never expose the key.
export type DeletionReceipt = {
  version: 1;
  audience: "investao-web-account-deletion";
  userID: string;
  challenge: string;
  outcome: "deleted" | "cancelled" | "failed";
  issuedAt: number;
  expiresAt: number;
};
const encoder = new TextEncoder();
const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
function decode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value))
    throw new Error("Invalid receipt encoding");
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
export function validReceiptSecret(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}
async function key(secret: string) {
  if (!validReceiptSecret(secret))
    throw new Error("Receipt signing unavailable");
  const bytes = Uint8Array.from(secret.match(/../g)!, (part) =>
    parseInt(part, 16),
  );
  return await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function signDeletionReceipt(
  secret: string,
  payload: DeletionReceipt,
) {
  const data = base64url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(secret),
    encoder.encode(`investao.apple-deletion.v1.${data}`),
  );
  return `${data}.${base64url(new Uint8Array(signature))}`;
}
export async function verifyDeletionReceipt(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<DeletionReceipt | null> {
  try {
    if (token.length > 4096) return null;
    const parts = token.split(".");
    if (
      parts.length !== 2 ||
      !(await crypto.subtle.verify(
        "HMAC",
        await key(secret),
        decode(parts[1]),
        encoder.encode(`investao.apple-deletion.v1.${parts[0]}`),
      ))
    )
      return null;
    const value = JSON.parse(
      new TextDecoder().decode(decode(parts[0])),
    ) as DeletionReceipt;
    const seconds = Math.floor(now / 1000);
    if (
      value.version !== 1 ||
      value.audience !== "investao-web-account-deletion" ||
      typeof value.userID !== "string" ||
      typeof value.challenge !== "string" ||
      !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value.userID) ||
      !/^[a-f0-9]{64}$/.test(value.challenge) ||
      !["deleted", "cancelled", "failed"].includes(value.outcome) ||
      !Number.isInteger(value.issuedAt) ||
      !Number.isInteger(value.expiresAt) ||
      value.issuedAt > seconds + 30 ||
      value.expiresAt <= seconds ||
      value.expiresAt - value.issuedAt !== 300
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
