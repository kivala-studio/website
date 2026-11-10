import "server-only";

import { parseServerEnv } from "./env";

export const serverEnv = parseServerEnv(process.env);
