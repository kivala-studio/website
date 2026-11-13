/*
 * A small PDF 1.4 writer for text documents made in the browser: Helvetica and Helvetica-Bold (standard
 * fonts, nothing embedded), WinAnsi text, thin rules. Enough for a statement table; no dependency.
 */

export type PdfFont = "regular" | "bold";
export type PdfAlign = "left" | "right";

/** Helvetica advance widths (1/1000 em) for printable ASCII, from the standard AFM metrics. */
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722,
  667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722,
  667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278,
  556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Characters outside Latin-1 that WinAnsi still has, or a close stand-in. */
const WIN_ANSI: Record<string, number> = { "−": 0x2d, "–": 0x96, "—": 0x97, "…": 0x85, "’": 0x92, " ": 0x20, " ": 0x20 };

function encode(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0)!;
    const byte = WIN_ANSI[char] ?? (code >= 0x20 && code <= 0xff && (code < 0x7f || code >= 0xa0) ? code : 0x3f);
    out += String.fromCharCode(byte === 0xa0 ? 0x20 : byte);
  }
  return out;
}

/** Width in points of `text` at `size`; accented letters measure as their base letter. */
export function textWidth(text: string, size: number, font: PdfFont = "regular"): number {
  const table = font === "bold" ? BOLD : REGULAR;
  let units = 0;
  for (const char of encode(text.normalize("NFD").replace(/\p{M}/gu, ""))) {
    const code = char.charCodeAt(0);
    units += code >= 32 && code <= 126 ? table[code - 32] : code === 0x85 ? 1000 : 556;
  }
  return (units * size) / 1000;
}

/** `text` cut with an ellipsis to fit `width`. */
export function fitText(text: string, width: number, size: number, font: PdfFont = "regular"): string {
  if (textWidth(text, size, font) <= width) return text;
  let cut = [...text];
  while (cut.length > 0 && textWidth(`${cut.join("")}…`, size, font) > width) cut = cut.slice(0, -1);
  return `${cut.join("").trimEnd()}…`;
}

const escapeText = (text: string) => text.replace(/[\\()]/g, "\\$&");
const num = (value: number) => (Math.round(value * 100) / 100).toString();

/** One page, drawn from the top-left in points (y grows downwards). */
export class PdfPage {
  private readonly ops: string[] = [];

  constructor(readonly width: number, readonly height: number) {}

  /** `y` is the baseline. `gray` is 0 (black) to 1 (white). */
  text(text: string, x: number, y: number, { size, font = "regular", align = "left", gray = 0 }: { size: number; font?: PdfFont; align?: PdfAlign; gray?: number }) {
    const left = align === "right" ? x - textWidth(text, size, font) : x;
    this.ops.push(`BT /${font === "bold" ? "F2" : "F1"} ${num(size)} Tf ${num(gray)} g ${num(left)} ${num(this.height - y)} Td (${escapeText(encode(text))}) Tj ET`);
  }

  rule(x1: number, x2: number, y: number, gray = 0.8) {
    this.ops.push(`${num(gray)} G 0.5 w ${num(x1)} ${num(this.height - y)} m ${num(x2)} ${num(this.height - y)} l S`);
  }

  get content(): string {
    return this.ops.join("\n");
  }
}

/** The file's bytes. Latin-1 throughout, so string length equals byte length for the cross-reference table. */
export function pdfBytes(pages: readonly PdfPage[], title: string): Uint8Array {
  const objects: string[] = [];
  /** Object numbers start at 1. */
  const add = (body: string) => objects.push(body);
  const catalog = add("");
  const tree = add("");
  const regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const info = add(`<< /Title (${escapeText(encode(title))}) >>`);
  const kids = pages.map((page) => {
    const stream = page.content;
    const contents = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    return add(
      `<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${contents} 0 R >>`,
    );
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objects[tree - 1] = `<< /Type /Pages /Kids [${kids.map((kid) => `${kid} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let file = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(file.length);
    file += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  file += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(file, (char) => char.charCodeAt(0));
}
