import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { sessionCookieOptions } from "../auth/cookies";
import { CLIENT_OPTIONS, supabaseConfig } from "./options";

/**
 * Per request, with the visitor's session cookies. Responses that use it are never cached. Server components
 * cannot write cookies (the proxy refreshes sessions before they render); server actions can.
 */
export async function serverSupabase() {
  const { url, key } = supabaseConfig();
  const store = await cookies();
  const secure = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
  return createServerClient(url, key, {
    ...CLIENT_OPTIONS,
    cookieOptions: sessionCookieOptions(secure),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values) store.set(name, value, options);
        } catch {
          // Server components cannot set cookies; route handlers and the proxy refresh sessions.
        }
      },
    },
  });
}
