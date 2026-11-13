/*
 * iOS `StatementTextParser`: turns text read from a broker statement into the ledger CSV, so the import
 * review validates every row before anything is saved. A line is used only when it names a known symbol
 * and a date is known (on the line, or carried from the previous dated line). The type comes from
 * keywords; the first number is the quantity and the second the price (income: the first is the gross).
 *
 * One deliberate difference: a dot decimal such as `101.5` reads as one number. iOS tries the plain
 * integer pattern first and splits it into `101` and `5`.
 */

const DATE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\b/;
/** Space or dot grouped thousands with an optional decimal comma, then dot decimals, then plain numbers. */
const AMOUNT = /\d{1,3}(?:[   .]\d{3})+(?:,\d+)?|\d+\.\d+|\d+(?:,\d+)?/g;
const GROUPING = /[   ]/;

function firstDate(line: string): string | null {
  const match = DATE.exec(line);
  if (!match) return null;
  const parts = match[0].split(/[-/.]/).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [year, month, day] = parts[0] > 31 ? parts : [parts[2], parts[1], parts[0]];
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Grouping separators go; the decimal comma stays for the CSV parser. */
function amounts(text: string): string[] {
  return [...text.matchAll(AMOUNT)].map(([raw]) => {
    const dots = raw.split(".").length - 1;
    if (GROUPING.test(raw) || dots > 1 || (raw.includes(".") && raw.includes(","))) return raw.replace(/[   .]/g, "");
    if (dots === 1 && raw.split(".").at(-1)!.length === 3) return raw.replace(".", "");
    return raw;
  });
}

const folded = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function kindOf(line: string): "venda" | "compra" | "rendimento" | null {
  const text = folded(line);
  if (["venda", "sell", "sale"].some((word) => text.includes(word))) return "venda";
  if (["compra", "buy", "purchase", "subscricao"].some((word) => text.includes(word))) return "compra";
  if (["dividendo", "dividend", "cupao", "coupon", "juro", "interest", "rendimento"].some((word) => text.includes(word))) return "rendimento";
  return null;
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The ledger CSV (`;`, LF) for the lines that name a known symbol, or null when none does. */
export function statementCsv(lines: readonly string[], securities: readonly { symbol: string }[]): string | null {
  const symbols = new Set(securities.map((security) => security.symbol.toUpperCase()));
  const rows: string[][] = [];
  let lastDate: string | null = null;
  for (const line of lines) {
    const date = firstDate(line);
    if (date) lastDate = date;
    const tokens = line
      .split(/\s+/)
      .filter((token) => token !== "")
      .map((token) => token.toUpperCase().replace(/^\p{P}+|\p{P}+$/gu, ""));
    const symbol = tokens.find((token) => symbols.has(token));
    const tradedOn = date ?? lastDate;
    if (!symbol || !tradedOn) continue;
    const remainder = line.replace(new RegExp(escaped(symbol), "gi"), " ").replace(DATE, "");
    const numbers = amounts(remainder);
    const kind = kindOf(line);
    if (kind === "rendimento") {
      if (numbers.length === 0) continue;
      rows.push([tradedOn, symbol, kind, "1", numbers[0], "0"]);
    } else {
      if (numbers.length < 2) continue;
      rows.push([tradedOn, symbol, kind ?? "", numbers[0], numbers[1], "0"]);
    }
  }
  if (rows.length === 0) return null;
  return [["data", "simbolo", "tipo", "quantidade", "preco", "custos"], ...rows].map((row) => row.join(";")).join("\n") + "\n";
}

/** A piece of text on a page, as a PDF text layer or a recognizer gives it: left edge and baseline. */
export type TextPiece = { text: string; x: number; y: number; height: number };

/** Pieces on the same baseline (within half a line height) joined into rows, top to bottom, left to right. */
export function joinRows(pieces: readonly TextPiece[], topDown = false): string[] {
  const sorted = [...pieces].filter((piece) => piece.text.trim() !== "").sort((a, b) => (topDown ? a.y - b.y : b.y - a.y) || a.x - b.x);
  const rows: { y: number; tolerance: number; pieces: TextPiece[] }[] = [];
  for (const piece of sorted) {
    const row = rows.find((candidate) => Math.abs(candidate.y - piece.y) <= candidate.tolerance);
    if (row) row.pieces.push(piece);
    else rows.push({ y: piece.y, tolerance: Math.max(piece.height / 2, 1), pieces: [piece] });
  }
  return rows.map((row) =>
    row.pieces
      .sort((a, b) => a.x - b.x)
      .map((piece) => piece.text.trim())
      .join(" "),
  );
}
