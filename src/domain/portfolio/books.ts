/*
 * Named portfolios (contract §5.2, iOS `PortfolioBooks`). The main portfolio has no record: its rows carry
 * `portfolio_id = null`. The selection is the combined view, the main portfolio, or one named portfolio.
 */

export type PortfolioBook = { id: string; name: string };

/** `combined`, `main`, or a book id. */
export type PortfolioSelection = string;

export const COMBINED = "combined";
export const MAIN = "main";

/** `portfolios.name`: 1..40 characters once trimmed. */
export const BOOK_NAME_MAX = 40;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function decodeBook(value: unknown): PortfolioBook | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, name } = value as Record<string, unknown>;
  if (typeof id !== "string" || !UUID.test(id) || typeof name !== "string" || name.trim() === "") return null;
  return { id: id.toLowerCase(), name };
}

/** The name to save, or null when it is blank or too long. */
export function bookName(text: string): string | null {
  const name = text.trim();
  return name.length > 0 && [...name].length <= BOOK_NAME_MAX ? name : null;
}

/** The server's unique index is case-insensitive. */
export const hasBookNamed = (books: readonly PortfolioBook[], name: string, except?: string) =>
  books.some((book) => book.id !== except && book.name.toLocaleLowerCase("pt") === name.toLocaleLowerCase("pt"));

/** A remembered selection that still exists; without named portfolios the view is always combined. */
export function resolveSelection(stored: string | null | undefined, books: readonly PortfolioBook[]): PortfolioSelection {
  if (books.length === 0 || !stored) return COMBINED;
  if (stored === MAIN || stored === COMBINED) return stored;
  return books.some((book) => book.id === stored) ? stored : COMBINED;
}

export function selectionIncludes(selection: PortfolioSelection, portfolioId: string | null | undefined): boolean {
  if (selection === COMBINED) return true;
  if (selection === MAIN) return portfolioId == null;
  return portfolioId === selection;
}

/** New records go to the selected portfolio, or to the main one in the combined view. */
export const writableBookId = (selection: PortfolioSelection): string | null => (selection === COMBINED || selection === MAIN ? null : selection);

/** One portfolio is selected (shares and the report name it); the combined view with named portfolios is not one. */
export const isSinglePortfolio = (selection: PortfolioSelection, books: readonly PortfolioBook[]) => selection !== COMBINED || books.length === 0;
