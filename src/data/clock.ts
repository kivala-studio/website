import "server-only";

/**
 * The instant a server render assesses data at. Pages render per request (the CSP nonce needs it), so one
 * reading per render is the request's clock; client components receive it as a prop instead of reading their own.
 */
export const requestTime = (): number => Date.now();
