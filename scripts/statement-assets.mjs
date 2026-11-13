// Copies the statement reader's recognition files from node_modules into public/statement, so they are
// served from this site and fetched only when someone reads a statement (no CDN; nothing else loads them).
// Runs before `next dev` and `next build` (the "predev" and "prebuild" scripts); public/statement is ignored by git.
import { copyFile, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "statement");
const require = createRequire(import.meta.url);
const dir = (name) => path.dirname(require.resolve(`${name}/package.json`));

const files = [
  // Text recognition for photos and scanned pages: worker, LSTM cores (relaxed SIMD, SIMD, plain), Portuguese and English.
  [path.join(dir("tesseract.js"), "dist", "worker.min.js"), "worker.min.js"],
  ...["relaxedsimd-lstm", "simd-lstm", "lstm"].map((variant) => [path.join(dir("tesseract.js-core"), `tesseract-core-${variant}.wasm.js`), `core/tesseract-core-${variant}.wasm.js`]),
  ...["por", "eng"].map((lang) => [path.join(dir(`@tesseract.js-data/${lang}`), "4.0.0_best_int", `${lang}.traineddata.gz`), `lang/${lang}.traineddata.gz`]),
  // PDF text layer and page images.
  [path.join(dir("pdfjs-dist"), "build", "pdf.worker.min.mjs"), "pdf.worker.min.mjs"],
  ...["openjpeg.wasm", "openjpeg_nowasm_fallback.js", "jbig2.wasm", "jbig2_nowasm_fallback.js", "qcms_bg.wasm"].map((name) => [path.join(dir("pdfjs-dist"), "wasm", name), `pdf-wasm/${name}`]),
];

await rm(OUT, { recursive: true, force: true });
for (const [from, to] of files) {
  const target = path.join(OUT, to);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(from, target);
}
console.log(`statement assets: ${files.length} files in public/statement`);
