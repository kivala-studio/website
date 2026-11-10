import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { CLIENT_OPTIONS, supabaseConfig } from "./options";

/** Per request, with the visitor's session cookies. Responses that use it are never cached. */
export async function serverSupabase() {
  const { url, key } = supabaseConfig();
  const store = await cookies();
  return createServerClient(url, key, {
    ...CLIENT_OPTIONS,
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
