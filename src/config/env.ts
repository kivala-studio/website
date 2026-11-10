export const DATA_MODES = ["demo", "local", "production"] as const;
export type DataMode = (typeof DATA_MODES)[number];

/** Server-only names. They must never reach a client bundle (checked by scripts/scan-client-bundle.mjs). */
export const SERVER_ONLY_ENV_NAMES = [
  "APPLE_WEBSITE_RECEIPT_SECRET",
  "SITE_URL",
  "ANDROID_APP_PACKAGE",
  "ANDROID_APP_SHA256_FINGERPRINTS",
] as const;

export type PublicEnv = {
  dataMode: DataMode;
  supabaseUrl: string | null;
  supabaseKey: string | null;
  posthogToken: string | null;
  sentryDsn: string | null;
  revenueCatWebKey: string | null;
};

export type ServerEnv = PublicEnv & {
  siteUrl: string;
  appleWebsiteReceiptSecret: string | null;
  /** Android App Links (`/.well-known/assetlinks.json`); empty until the Android app exists. */
  androidApp: { packageName: string; sha256Fingerprints: string[] } | null;
};

type Source = Readonly<Record<string, string | undefined>>;

export class EnvError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid environment:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    this.name = "EnvError";
  }
}

const read = (source: Source, name: string) => {
  const value = source[name]?.trim();
  return value ? value : null;
};

const isLocalHost = (url: URL) => ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

function checkUrl(name: string, value: string | null, problems: string[]) {
  if (value === null) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalHost(url))) {
      problems.push(`${name} must use https (http is allowed only for localhost)`);
    }
  } catch {
    problems.push(`${name} is not a valid URL`);
  }
}

function collectPublic(source: Source, problems: string[]): PublicEnv {
  const rawMode = read(source, "NEXT_PUBLIC_DATA_MODE");
  let dataMode: DataMode = "demo";
  if (rawMode === null) {
    problems.push("NEXT_PUBLIC_DATA_MODE is missing");
  } else if ((DATA_MODES as readonly string[]).includes(rawMode)) {
    dataMode = rawMode as DataMode;
  } else {
    problems.push(`NEXT_PUBLIC_DATA_MODE must be one of ${DATA_MODES.join(", ")}`);
  }

  const supabaseUrl = read(source, "NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = read(source, "NEXT_PUBLIC_SUPABASE_KEY");
  if (dataMode !== "demo") {
    if (supabaseUrl === null) problems.push("NEXT_PUBLIC_SUPABASE_URL is missing");
    if (supabaseKey === null) problems.push("NEXT_PUBLIC_SUPABASE_KEY is missing");
  }
  checkUrl("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl, problems);

  const sentryDsn = read(source, "NEXT_PUBLIC_SENTRY_DSN");
  checkUrl("NEXT_PUBLIC_SENTRY_DSN", sentryDsn, problems);

  return {
    dataMode,
    supabaseUrl,
    supabaseKey,
    posthogToken: read(source, "NEXT_PUBLIC_POSTHOG_TOKEN"),
    sentryDsn,
    revenueCatWebKey: read(source, "NEXT_PUBLIC_REVENUECAT_WEB_KEY"),
  };
}

export function parsePublicEnv(source: Source): PublicEnv {
  const problems: string[] = [];
  const env = collectPublic(source, problems);
  if (problems.length > 0) throw new EnvError(problems);
  return env;
}

const ANDROID_PACKAGE = /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/;
const SHA256_FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function collectAndroidApp(source: Source, problems: string[]): ServerEnv["androidApp"] {
  const packageName = read(source, "ANDROID_APP_PACKAGE");
  const fingerprints = (read(source, "ANDROID_APP_SHA256_FINGERPRINTS") ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (packageName !== null && !ANDROID_PACKAGE.test(packageName)) {
    problems.push("ANDROID_APP_PACKAGE must be an application id such as ao.invest.android");
  }
  if (fingerprints.some((value) => !SHA256_FINGERPRINT.test(value))) {
    problems.push("ANDROID_APP_SHA256_FINGERPRINTS must be comma-separated SHA-256 fingerprints (AB:CD:…)");
  }
  if (packageName === null || fingerprints.length === 0) return null;
  return { packageName, sha256Fingerprints: fingerprints };
}

export function parseServerEnv(source: Source): ServerEnv {
  const problems: string[] = [];
  const env = collectPublic(source, problems);
  // Checked only here (`next build` and `next start` run it): in `collectPublic` the pattern
  // itself would ship in every client bundle that reads the public environment.
  if (env.supabaseKey !== null && /service_role|^sb_secret_/.test(env.supabaseKey)) {
    problems.push("NEXT_PUBLIC_SUPABASE_KEY must be the publishable key, not a secret key");
  }
  const androidApp = collectAndroidApp(source, problems);
  const siteUrl = read(source, "SITE_URL");
  if (siteUrl === null) problems.push("SITE_URL is missing");
  checkUrl("SITE_URL", siteUrl, problems);
  if (problems.length > 0) throw new EnvError(problems);
  return {
    ...env,
    siteUrl: siteUrl!.replace(/\/+$/, ""),
    appleWebsiteReceiptSecret: read(source, "APPLE_WEBSITE_RECEIPT_SECRET"),
    androidApp,
  };
}
