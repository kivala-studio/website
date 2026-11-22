import "server-only";

import { parseServerEnv } from "./env";
import { hostSplit } from "./hosts";

export const serverEnv = parseServerEnv(process.env);

/** The site and the app on their own hosts, or null when one host serves both (local, previews). */
export const hosts = hostSplit(serverEnv.siteUrl, serverEnv.appUrl);
