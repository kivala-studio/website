import Decimal from "decimal.js";

import type { Instant } from "../format";
import { foldText } from "../market/classification";
import type { MarketSecurity } from "../market/models";
import type { PortfolioTransaction, PortfolioTransactionKind } from "./models";
import { ledgerOrder, netAmount, priceScaleOf, recordIssues, supportsLedger } from "./records";

/*
 * Ledger files in the iOS format (`PortfolioCSV`): semicolons, CRLF, decimal commas, oldest record first.
 * Import also accepts commas or tabs, either decimal mark, and Portuguese or English headers, so a file
 * exported by iOS imports here unchanged and the other way round.
 */

export const CSV_FILE_NAME = "invest-ao-carteira.csv";
export const CSV_MAX_BYTES = 2 * 1024 * 1024;

export type CsvIssue = "missingColumns" | "unknownSymbol" | "unsupportedInstrument" | "invalidDate" | "invalidKind" | "invalidNumber" | "invalidRecord" | "duplicate";

export type CsvRow = { line: number; symbol: string } & ({ transaction: PortfolioTransaction; issue?: never } | { issue: CsvIssue; transaction?: never });

type CsvSecurity = Pick<MarketSecurity, "id" | "symbol" | "name" | "kind" | "currency">;

export const CSV_HEADER = ["data", "simbolo", "instrumento", "tipo", "quantidade", "preco", "custos", "valor_liquido", "moeda"] as const;

const KIND_NAMES: Record<PortfolioTransactionKind, string> = { buy: "compra", sell: "venda", income: "rendimento" };

const number = (value: Decimal) => (value.isFinite() ? value.toFixed().replace(".", ",") : "");

const quoted = (field: string) => (/[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field);

export function exportCsv(transactions: readonly PortfolioTransaction[], securities: readonly CsvSecurity[]): string {
  const byID = new Map(securities.map((security) => [security.id, security]));
  const rows = [...transactions].sort(ledgerOrder).map((transaction) => {
    const security = byID.get(transaction.securityId);
    const scale = security ? priceScaleOf(security.kind) : new Decimal(1);
    return [
      transaction.tradedOn,
      security?.symbol ?? transaction.securityId,
      security?.name ?? "",
      KIND_NAMES[transaction.kind],
      number(transaction.quantity),
      number(transaction.unitPrice),
      number(transaction.fees),
      number(netAmount(transaction, scale)),
      security?.currency ?? "AOA",
    ];
  });
  return [[...CSV_HEADER], ...rows].map((row) => row.map(quoted).join(";")).join("\r\n") + "\r\n";
}

/** The text of a file of at most 2 MB, in UTF-8 or else Latin-1; null when it is larger. */
export function decodeCsvBytes(bytes: Uint8Array): string | null {
  if (bytes.byteLength > CSV_MAX_BYTES) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("latin1").decode(bytes);
  }
}

const COLUMNS = {
  date: ["data", "date", "tradedate", "datadaoperacao", "datadeoperacao"],
  symbol: ["simbolo", "symbol", "ticker", "codigo", "code"],
  kind: ["tipo", "type", "operacao", "side"],
  quantity: ["quantidade", "quantity", "qty", "valornominal", "nominal"],
  price: ["preco", "price", "precounitario", "unitprice", "cotacao", "valor", "amount"],
  fees: ["custos", "comissoes", "fees", "comissoesimpostos", "imposto", "impostoretido", "tax"],
} as const;

const KINDS: Record<string, PortfolioTransactionKind> = {
  ...Object.fromEntries(["compra", "buy", "c", "b", "purchase"].map((name) => [name, "buy"])),
  ...Object.fromEntries(["venda", "sell", "v", "s", "sale"].map((name) => [name, "sell"])),
  ...Object.fromEntries(["rendimento", "dividendo", "dividend", "cupao", "coupon", "juro", "juros", "interest", "income"].map((name) => [name, "income"])),
};

const normalized = (text: string) => foldText(text).replace(/[^\p{L}\p{N}]/gu, "");

function delimiterOf(header: string): string {
  const candidates = [";", "\t", ","];
  const counts = candidates.map((candidate) => header.split(candidate).length - 1);
  const best = counts.indexOf(Math.max(...counts));
  return counts[best] > 0 ? candidates[best] : ";";
}

function fields(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let isQuoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (isQuoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else isQuoted = !isQuoted;
    } else if (char === delimiter && !isQuoted) {
      result.push(current);
      current = "";
    } else current += char;
  }
  result.push(current);
  return result;
}

/** Either decimal mark; thousands groups, spaces and a `kz`, `aoa` or `%` suffix are tolerated. */
export function parseCsvDecimal(text: string): Decimal | null {
  let value = text.replace(/[\s\u00A0\u202F]/g, "");
  for (const suffix of ["kz", "aoa", "%"]) if (value.toLowerCase().endsWith(suffix)) value = value.slice(0, -suffix.length);
  const comma = value.lastIndexOf(",");
  const dot = value.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    // The later mark is the decimal separator; the other groups thousands.
    value = value.replaceAll(comma > dot ? "." : ",", "").replace(",", ".");
  } else if (comma >= 0) {
    value = value.replaceAll(",", ".");
  } else if (dot >= 0 && value.split(".").length > 2) {
    // "1.000.000" groups thousands; a single dot is a decimal point.
    value = value.replaceAll(".", "");
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(value)) return null;
  return new Decimal(value);
}

function parseDate(text: string): string | null {
  const parts = text
    .slice(0, 10)
    .split(/[-/.]/)
    .filter((part) => part !== "")
    .map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN))
    .filter((part) => !Number.isNaN(part));
  if (parts.length !== 3) return null;
  const [year, month, day] = parts[0] > 31 ? parts : [parts[2], parts[1], parts[0]];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const signature = (transaction: PortfolioTransaction) =>
  [transaction.securityId, transaction.kind, transaction.tradedOn, transaction.quantity.toFixed(), transaction.unitPrice.toFixed()].join("|");

export type CsvParseOptions = {
  securities: readonly CsvSecurity[];
  /** Records already in the ledger: an equal row is a duplicate. */
  existing?: readonly PortfolioTransaction[];
  asOf: Instant;
  newID?: () => string;
};

/** One row per non-empty line after the header, each a record ready to save or the reason it cannot be. */
export function parseCsv(text: string, { securities, existing = [], asOf, newID = () => crypto.randomUUID() }: CsvParseOptions): CsvRow[] {
  const lines = text
    .replaceAll("\uFEFF", "")
    .split(/\r\n|[\n\r\v\f\u0085\u2028\u2029]/)
    .filter((line) => line !== "");
  if (lines.length === 0) return [];
  const delimiter = delimiterOf(lines[0]);
  const columns = fields(lines[0], delimiter).map(normalized);
  const index = (aliases: readonly string[]) => {
    const found = columns.findIndex((column) => aliases.includes(column));
    return found < 0 ? undefined : found;
  };
  const column = Object.fromEntries(Object.entries(COLUMNS).map(([name, aliases]) => [name, index(aliases)])) as Record<keyof typeof COLUMNS, number | undefined>;

  const bySymbol = new Map<string, CsvSecurity>();
  for (const security of securities) if (!bySymbol.has(security.symbol.toUpperCase())) bySymbol.set(security.symbol.toUpperCase(), security);
  const seen = new Set(existing.map(signature));
  // One millisecond apart, in file order: rows of the same day keep their order in the ledger.
  const start = new Date(asOf).getTime();
  const rows: CsvRow[] = [];

  lines.slice(1).forEach((line, offset) => {
    if (line.trim() === "") return;
    const values = fields(line, delimiter);
    const value = (at: number | undefined) => {
      const trimmed = at === undefined ? "" : (values[at] ?? "").trim();
      return trimmed === "" ? undefined : trimmed;
    };
    const lineNumber = offset + 2;
    const rawSymbol = value(column.symbol)?.toUpperCase() ?? "";
    const fail = (issue: CsvIssue) => rows.push({ line: lineNumber, symbol: rawSymbol, issue });

    if (column.date === undefined || column.symbol === undefined || column.kind === undefined || column.price === undefined) return fail("missingColumns");
    const security = bySymbol.get(rawSymbol);
    if (!security) return fail("unknownSymbol");
    if (!supportsLedger(security)) return fail("unsupportedInstrument");
    const dateText = value(column.date);
    const tradedOn = dateText === undefined ? null : parseDate(dateText);
    if (!tradedOn) return fail("invalidDate");
    const kindText = value(column.kind);
    const kind = kindText === undefined ? undefined : KINDS[normalized(kindText)];
    if (!kind) return fail("invalidKind");
    const quantityText = value(column.quantity);
    const units = column.quantity === undefined ? new Decimal(1) : quantityText === undefined ? null : parseCsvDecimal(quantityText);
    const feesText = value(column.fees);
    const fees = feesText === undefined ? new Decimal(0) : parseCsvDecimal(feesText);
    const priceText = value(column.price);
    const price = priceText === undefined ? null : parseCsvDecimal(priceText);
    if (!price || !units || !fees) return fail("invalidNumber");

    // Income is stored as one gross payment; per-unit dividends are multiplied out.
    const isIncome = kind === "income";
    const transaction: PortfolioTransaction = {
      id: newID().toLowerCase(),
      securityId: security.id,
      kind,
      quantity: isIncome ? new Decimal(1) : units,
      unitPrice: isIncome ? units.times(price) : price,
      fees,
      tradedOn,
      createdAt: new Date(start + offset).toISOString(),
    };
    if (recordIssues(transaction, security, asOf).length > 0) return fail("invalidRecord");
    const key = signature(transaction);
    if (seen.has(key)) return fail("duplicate");
    seen.add(key);
    rows.push({ line: lineNumber, symbol: security.symbol, transaction });
  });
  return rows;
}
