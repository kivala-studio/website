"use client";

import { type TextPiece, joinRows } from "@/domain/portfolio/statement";

/*
 * Reads the text of a statement in this browser (iOS `StatementReader`): a PDF's text layer, or text
 * recognition (Portuguese and English) for photos and scanned pages, first 12 pages, each about 2000 px wide.
 * The file is never sent anywhere; the libraries and their data come from this site's /statement/ folder.
 * This module is loaded only when someone reads a statement.
 */

const ASSETS = "/statement";
const MAX_PAGES = 12;
const RENDER_WIDTH = 2000;

type Recognizer = { recognize: (image: HTMLCanvasElement | Blob) => Promise<string[]>; close: () => Promise<void> };

async function recognizer(): Promise<Recognizer> {
  const { createWorker, OEM } = await import("tesseract.js");
  const worker = await createWorker(["por", "eng"], OEM.LSTM_ONLY, {
    workerPath: `${ASSETS}/worker.min.js`,
    corePath: `${ASSETS}/core`,
    langPath: `${ASSETS}/lang`,
    workerBlobURL: false,
    gzip: true,
  });
  return {
    async recognize(image) {
      const { data } = await worker.recognize(image);
      return data.text.split("\n").filter((line) => line.trim() !== "");
    },
    close: async () => void (await worker.terminate()),
  };
}

async function pdfLines(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${ASSETS}/pdf.worker.min.mjs`;
  const task = pdfjs.getDocument({ data: bytes, wasmUrl: `${ASSETS}/pdf-wasm/`, disableFontFace: true });
  const document = await task.promise;
  let ocr: Recognizer | null = null;
  const lines: string[] = [];
  try {
    for (let number = 1; number <= Math.min(document.numPages, MAX_PAGES); number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const pieces: TextPiece[] = content.items.flatMap((item) =>
        "str" in item && item.str.trim() !== "" ? [{ text: item.str, x: item.transform[4], y: item.transform[5], height: item.height || Math.abs(item.transform[3]) }] : [],
      );
      if (pieces.length > 0) {
        lines.push(...joinRows(pieces));
        continue;
      }
      // A scanned page: recognise its image.
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width });
      const canvas = Object.assign(window.document.createElement("canvas"), { width: Math.ceil(viewport.width), height: Math.ceil(viewport.height) });
      await page.render({ canvas, viewport }).promise;
      ocr ??= await recognizer();
      lines.push(...(await ocr.recognize(canvas)));
    }
  } finally {
    await ocr?.close();
    await task.destroy();
  }
  return lines;
}

/** The statement's text, one entry per row. */
export async function readStatementLines(file: File): Promise<string[]> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return pdfLines(new Uint8Array(await file.arrayBuffer()));
  const ocr = await recognizer();
  try {
    return await ocr.recognize(file);
  } finally {
    await ocr.close();
  }
}
