// Copies the Rive runtime's WebAssembly from node_modules into public/rive-runtime, so the landing's hero loads it
// from this site (no CDN). Runs before `next dev` and `next build`; public/rive-runtime is ignored by git.
// The hero's scene is `rive/hero` (Rive CLI project); its export, public/rive/hero.riv, is committed.
import { copyFile, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "rive-runtime");
const require = createRequire(import.meta.url);
const from = path.dirname(require.resolve("@rive-app/canvas/package.json"));
const files = ["rive.wasm", "rive_fallback.wasm"];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const name of files) await copyFile(path.join(from, name), path.join(OUT, name));
console.log(`rive assets: ${files.length} files in public/rive-runtime`);
