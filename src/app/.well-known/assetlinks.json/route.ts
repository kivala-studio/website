import { serverEnv } from "@/config/server-env";

/**
 * Android App Links. Package and signing fingerprints come from ANDROID_APP_PACKAGE and
 * ANDROID_APP_SHA256_FINGERPRINTS; until both are set this is a valid empty statement list.
 */
export function GET() {
  const app = serverEnv.androidApp;
  const statements = app
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: { namespace: "android_app", package_name: app.packageName, sha256_cert_fingerprints: app.sha256Fingerprints },
        },
      ]
    : [];
  return Response.json(statements, { headers: { "Cache-Control": "public, max-age=3600" } });
}
