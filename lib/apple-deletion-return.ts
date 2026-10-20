import { verifyDeletionReceipt } from "./apple-deletion-receipt.ts";
export const attemptCookie = "__Host-investao-apple-attempt";
export const resultCookie = "__Host-investao-apple-result";
export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 300,
};
export async function verifyBrowserReturn(
  secret: string,
  receipt: string,
  binding: string | undefined,
  now = Date.now(),
) {
  try {
    if (!binding || binding.length > 512) return null;
    const expected = JSON.parse(binding);
    const verified = await verifyDeletionReceipt(secret, receipt, now);
    if (
      !verified ||
      expected.userID !== verified.userID ||
      expected.challenge !== verified.challenge
    )
      return null;
    return verified;
  } catch {
    return null;
  }
}
