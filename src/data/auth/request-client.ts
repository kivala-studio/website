import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";

import { CLIENT_OPTIONS, supabaseConfig } from "../supabase/options";
import { PRIVATE_NO_STORE, isSupabaseCookie, sessionCookieOptions } from "./cookies";

type Write = { name: string; value: string; options: CookieOptions };

export interface RequestSupabase {
  readonly client: SupabaseClient;
  readonly secure: boolean;
  /** Copies the session cookies the client wrote (refresh, sign-in, sign-out) onto a response and marks it private. */
  applyTo<T extends NextResponse>(response: T): T;
  /** Expires every Supabase cookie the request carried, whatever the client did. */
  clearAll<T extends NextResponse>(response: T): T;
}

/**
 * A Supabase client bound to one proxy or route-handler request. Cookies it writes also update the request,
 * so a page rendered after a refresh in the proxy sees the new session instead of refreshing again.
 */
export function requestSupabase(request: NextRequest): RequestSupabase {
  const { url, key } = supabaseConfig();
  const secure = request.nextUrl.protocol === "https:";
  const writes = new Map<string, Write>();
  // Writes also delete from `request.cookies` (sign-out does), so the names the request arrived with are kept here.
  const arrived = request.cookies.getAll().map(({ name }) => name);
  let cacheHeaders: Record<string, string> = {};
  const client = createServerClient(url, key, {
    ...CLIENT_OPTIONS,
    cookieOptions: sessionCookieOptions(secure),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values, headers) => {
        for (const write of values) {
          if (write.value) request.cookies.set(write.name, write.value);
          else request.cookies.delete(write.name);
          writes.set(write.name, write);
        }
        cacheHeaders = { ...cacheHeaders, ...headers };
      },
    },
  });
  const markPrivate = <T extends NextResponse>(response: T) => {
    for (const [name, value] of Object.entries(cacheHeaders)) response.headers.set(name, value);
    response.headers.set("Cache-Control", PRIVATE_NO_STORE);
    return response;
  };
  return {
    client,
    secure,
    applyTo(response) {
      for (const { name, value, options } of writes.values()) response.cookies.set(name, value, options);
      return writes.size > 0 ? markPrivate(response) : response;
    },
    clearAll(response) {
      for (const name of new Set([...arrived, ...writes.keys(), ...request.cookies.getAll().map((cookie) => cookie.name)])) {
        if (isSupabaseCookie(name)) response.cookies.set(name, "", { ...sessionCookieOptions(secure), maxAge: 0 });
      }
      return markPrivate(response);
    },
  };
}

/** A form post from this site (sign-out, local sign-in). Browsers send `Origin` on every POST. */
export function isSameOriginPost(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === request.nextUrl.origin;
}
