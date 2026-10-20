/** Request-time public reads, with one retry for a cancelled database statement. */
export async function fetchPublicData<T>(url: URL, key: string): Promise<T> {
  const signal = AbortSignal.timeout(10000);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, {
      headers: { apikey: key },
      cache: "no-store",
      signal,
    });
    if (response.ok) return response.json();
    const error = await response.json().catch(() => null);
    // PostgREST reports statement_timeout as HTTP 500 / SQLSTATE 57014.
    // Retry only this transient failure, within the original request deadline.
    if (attempt === 0 && response.status === 500 && error?.code === "57014") {
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }
    throw new Error("Public data unavailable");
  }
  throw new Error("Public data unavailable");
}
