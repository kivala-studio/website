import "server-only";
import { validReceiptSecret } from "./apple-deletion-receipt";

// Enable only after deploying and verifying the Apple browser-return backend.
// Only this boolean reaches the UI; the receipt secret stays on the server.
export function appleWebDeletionAvailable() {
  return process.env.APPLE_WEB_DELETION_ENABLED === "true" &&
    validReceiptSecret(process.env.APPLE_WEBSITE_RECEIPT_SECRET);
}
