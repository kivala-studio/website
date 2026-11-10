// Fails when a server-only variable name, a server-only value or `service_role` appears in client chunks.
// Runs after `next build` (see the "build" script); run alone with `npm run scan:bundle`.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLIENT_DIR = path.join(ROOT, ".next", "static");
const ENV_SOURCE = path.join(ROOT, "src", "config", "env.ts");

const envSource = await readFile(ENV_SOURCE, "utf8");
const namesBlock = envSource.match(/SERVER_ONLY_ENV_NAMES = \[([^\]]*)\]/);
if (!namesBlock) throw new Error(`SERVER_ONLY_ENV_NAMES not found in ${ENV_SOURCE}`);
const serverNames = [...namesBlock[1].matchAll(/"([A-Z0-9_]+)"/g)].map((match) => match[1]);

const needles = [
  { label: "service_role", text: "service_role" },
  ...serverNames.map((name) => ({ label: `name ${name}`, text: name })),
  ...serverNames
    .filter((name) => (process.env[name] ?? "").trim().length >= 8)
    .map((name) => ({ label: `value of ${name}`, text: process.env[name].trim() })),
];

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (/\.(js|mjs|json|html|css)$/.test(entry.name)) yield full;
  }
}

let scanned = 0;
const leaks = [];
try {
  for await (const file of files(CLIENT_DIR)) {
    scanned += 1;
    const content = await readFile(file, "utf8");
    for (const needle of needles) {
      if (content.includes(needle.text)) leaks.push(`${needle.label} in ${path.relative(ROOT, file)}`);
    }
  }
} catch (error) {
  if (error.code === "ENOENT") {
    console.error("Bundle scan: .next/static not found. Run `next build` first.");
    process.exit(1);
  }
  throw error;
}

if (leaks.length > 0) {
  console.error(`Bundle scan failed. Server-only content in client chunks:\n${leaks.map((leak) => `  - ${leak}`).join("\n")}`);
  process.exit(1);
}
console.log(`Bundle scan passed: ${scanned} client files, ${needles.length} patterns.`);
