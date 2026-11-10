/** The shape every supabase-js query resolves to. */
export type QueryResult<T> = { data: T | null; error: unknown; status?: number };

/** Rows per offset page (iOS `SupabaseRead.pageSize`). */
export const PAGE_SIZE = 500;

/**
 * The data of a query, or its error with the HTTP status attached so the domain mapper sees it
 * (`PostgrestError` itself carries none).
 */
export function unwrap<T>({ data, error, status }: QueryResult<T>): T {
  if (error) {
    if (typeof error === "object" && status !== undefined && !("status" in error)) Object.assign(error, { status });
    throw error;
  }
  return data as T;
}

/**
 * Every row of an offset-paged query. Paging stops only at an empty page: a server row cap can
 * return short pages before the end.
 */
export async function readAll<T>(page: (from: number, to: number) => PromiseLike<QueryResult<T[]>>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const data = unwrap(await page(rows.length, rows.length + PAGE_SIZE - 1)) ?? [];
    if (data.length === 0) return rows;
    rows.push(...data);
  }
}
