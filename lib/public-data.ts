import "server-only";
import { cache } from "react";

export type Result<T> = { data: T; error: false } | { data: null; error: true };
export type Security = {
  id: string;
  symbol: string;
  name: string | null;
  isin: string | null;
  currency: string;
  security_type: string;
  issuer_id: string | null;
  is_active: boolean;
  issuers?: {
    name: string;
    short_name?: string | null;
    sector?: string | null;
  } | null;
};
export type Quality = {
  status: string;
  reasons: string[];
  validUntilEpoch?: number;
  sourceObservedAtEpoch?: number | null;
};
export type Quote = {
  security_id: string;
  trading_date: string | null;
  last_price: number | null;
  close_price: number | null;
  verified_change_percent: number | null;
  data_quality: Quality | null;
};
export type Reference = {
  security_id: string;
  reference_price: {
    price: number;
    price_date: string;
    traded_at: string | null;
    collected_at: string;
    source_url: string;
    source_hash: string;
    parser_version: string;
  } | null;
  reference_update_status?: string;
  reference_update_reason?: string;
};
export type Close = {
  security_id: string;
  price: number;
  trading_date: string;
  confirmed_at: string;
  verified_change_percent: number | null;
};
export type Quotes = {
  prices: Quote[];
  reference_prices?: Reference[];
  active_security_ids?: string[];
  overview: {
    status: string;
    data_status: string;
    last_updated_at: string | null;
    source: string;
  }[];
};
export type Market = {
  securities: Security[];
  quotes: Quotes;
  closes: Close[];
  closesUnavailable: boolean;
  fetchedAt: string;
};
export type Issuer = {
  name: string;
  description: string | null;
  sector: string | null;
};
export type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  published_at: string;
  body_markdown?: string;
  news_article_securities: {
    securities: { id: string; symbol: string; name: string | null };
  }[];
  news_article_sources: {
    source_url: string;
    source_title: string | null;
    news_sources: { name: string };
  }[];
};

// Only an anonymous publishable key is accepted. Never use a service-role key.
export async function read<T>(
  path: string,
  parameters: Record<string, string> = {},
): Promise<T> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key?.startsWith("sb_publishable_"))
    throw new Error("Public data configuration unavailable");
  const url = new URL(`/rest/v1/${path}`, base);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error("Invalid data origin");
  url.search = new URLSearchParams(parameters).toString();
  // Request-time reads: no stale-while-revalidate for prices or withdrawn articles.
  const response = await fetch(url, {
    headers: { apikey: key },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Public data unavailable");
  return response.json();
}

async function all<T>(
  path: string,
  parameters: Record<string, string>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await read<T[]>(path, {
      ...parameters,
      limit: "1000",
      offset: String(offset),
    });
    rows.push(...page);
    if (page.length < 1000) return rows;
    if (offset >= 99000) throw new Error("Catalogue exceeded supported size");
  }
}

export const getMarket = cache(async (): Promise<Result<Market>> => {
  try {
    const [securities, quotes, closeResult] = await Promise.all([
      all<Security>("securities", {
        select:
          "id,symbol,isin,name,currency,security_type,issuer_id,is_active,issuers(name,short_name)",
        order: "symbol,id",
      }),
      read<Quotes>("rpc/get_current_market_quotes"),
      all<Close>("latest_verified_market_closes", {
        select:
          "security_id,price,trading_date,confirmed_at,verified_change_percent",
        order: "security_id",
      })
        .then((data) => ({ data, error: false }))
        .catch(() => ({ data: [] as Close[], error: true })),
    ]);
    if (!Array.isArray(quotes.prices) || !Array.isArray(quotes.overview))
      throw new Error("Unsupported contract");
    const active = quotes.active_security_ids
      ? new Set(quotes.active_security_ids)
      : null;
    return {
      data: {
        securities: securities.filter((s) =>
          active ? active.has(s.id) : s.is_active,
        ),
        quotes,
        closes: closeResult.data,
        closesUnavailable: closeResult.error,
        fetchedAt: new Date().toISOString(),
      },
      error: false,
    };
  } catch {
    return { data: null, error: true };
  }
});

export const getIssuer = cache(
  async (id: string): Promise<Result<Issuer | null>> => {
    try {
      return {
        data:
          (
            await read<Issuer[]>("issuers", {
              select: "name,description,sector",
              id: `eq.${id}`,
              limit: "1",
            })
          )[0] ?? null,
        error: false,
      };
    } catch {
      return { data: null, error: true };
    }
  },
);

const articleSelection =
  "id,slug,title,summary,published_at,news_article_securities(securities(id,symbol,name)),news_article_sources(source_url,source_title,news_sources(name))";
export const getNews = cache(
  async (offset = 0, securityID?: string): Promise<Result<Article[]>> => {
    try {
      const select = securityID
        ? articleSelection.replace(
            "news_article_securities(",
            "news_article_securities!inner(",
          )
        : articleSelection;
      return {
        data: await read<Article[]>("news_articles", {
          select,
          status: "eq.published",
          published_at: `lte.${new Date().toISOString()}`,
          order: "published_at.desc,id.desc",
          limit: "13",
          offset: String(offset),
          ...(securityID
            ? { "news_article_securities.security_id": `eq.${securityID}` }
            : {}),
        }),
        error: false,
      };
    } catch {
      return { data: null, error: true };
    }
  },
);

export const getArticle = cache(
  async (slug: string): Promise<Result<Article | null>> => {
    try {
      return {
        data:
          (
            await read<Article[]>("news_articles", {
              select: `body_markdown,${articleSelection}`,
              status: "eq.published",
              published_at: `lte.${new Date().toISOString()}`,
              slug: `eq.${slug}`,
              limit: "1",
            })
          )[0] ?? null,
        error: false,
      };
    } catch {
      return { data: null, error: true };
    }
  },
);
