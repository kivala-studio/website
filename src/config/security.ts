/** Telemetry host shared with iOS (`INVESTAO_POSTHOG_HOST`). */
export const POSTHOG_HOST = "https://us.i.posthog.com";
const POSTHOG_ASSETS_HOST = "https://us-assets.i.posthog.com";

/** Headers sent on every response, static assets included. CSP is per request (see src/proxy.ts). */
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

type CspInput = {
  nonce: string;
  isDev: boolean;
  supabaseUrl: string | null;
  sentryDsn: string | null;
};

const originOf = (value: string | null) => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export function buildContentSecurityPolicy({ nonce, isDev, supabaseUrl, sentryDsn }: CspInput): string {
  const supabase = originOf(supabaseUrl);
  const realtime = supabase?.replace(/^http/, "ws") ?? null;
  const connect = ["'self'", supabase, realtime, POSTHOG_HOST, POSTHOG_ASSETS_HOST, originOf(sentryDsn)];

  const directives: Record<string, (string | null)[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", isDev ? "'unsafe-eval'" : null],
    "style-src": ["'self'", isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`],
    "img-src": ["'self'", "blob:", "data:"],
    "font-src": ["'self'"],
    "connect-src": connect,
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(
    ([name, sources]) => `${name} ${sources.filter((source): source is string => source !== null).join(" ")}`,
  );
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
