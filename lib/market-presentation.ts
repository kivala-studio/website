import type { Market, Security, Quote, Reference, Close } from "./public-data";

export const number = (value: number) =>
  new Intl.NumberFormat("pt-AO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
export function date(value?: string | null, time = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-AO", {
    timeZone: "Africa/Luanda",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(new Date(value.length === 10 ? `${value}T12:00:00+01:00` : value));
}
function day(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
export function kind(s: Security) {
  const text = `${s.security_type} ${s.name ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    /^OT-|^[BO][A-Z][0-9]{2}[A-Z0-9]{4}$/.test(s.symbol) ||
    /treasury_bond|tesouro|bilhete|bt-|ot-/.test(text)
  )
    return "Obrigações do Tesouro";
  if (
    /^[A-Z0-9]{4}DOF[A-Z0-9]$/.test(s.symbol) ||
    /corporate_bond|obrig|bond|instrumento de divida/.test(text)
  )
    return "Obrigações";
  if (/^[A-Z0-9]{4}UFV[A-Z0-9]$/.test(s.symbol) || /fund|fundo/.test(text))
    return "Fundos";
  if (
    /^(?:[A-Z]{3}A{5}|[A-Z]{4}A{4})$/.test(s.symbol) ||
    /equity|stock|accao|accoes/.test(text)
  )
    return "Acções";
  return "Outro instrumento";
}
export function priceText(s: Security, price: number | null) {
  if (price === null) return "Indisponível";
  return kind(s).startsWith("Obrigações")
    ? `${number(price)}%`
    : `${number(price)} ${s.currency === "AOA" ? "Kz" : s.currency}`;
}
export type Reading = {
  price: number | null;
  label: string;
  priceDate: string | null;
  verifiedAt: string | null;
  change: number | null;
  changeLabel: string;
  stale: boolean;
  source: string | null;
  note?: string;
  deadline?: number;
};

// Display-only references preserve the iOS quality boundary and precedence.
export function reading(s: Security, m: Market, now = Date.now()): Reading {
  function unique<T>(items: T[], predicate: (item: T) => boolean) {
    const matches = items.filter(predicate);
    return matches.length === 1 ? matches[0] : undefined;
  }
  const q: Quote | undefined = unique(
    m.quotes.prices,
    (q) => q.security_id === s.id,
  );
  const r: Reference | undefined = unique(
    m.quotes.reference_prices ?? [],
    (r) => r.security_id === s.id,
  );
  const c: Close | undefined = unique(m.closes, (c) => c.security_id === s.id);
  const currentDay = day(new Date(now).toISOString());
  const quality = q?.data_quality;
  const raw = q?.last_price ?? q?.close_price;
  const validDay = (v: string | null | undefined): v is string =>
    !!v &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v &&
    v <= currentDay;
  const status = m.quotes.overview[0]?.status;
  const deadline = quality?.validUntilEpoch;
  const observed = quality?.sourceObservedAtEpoch;
  const current =
    positive(raw) &&
    validDay(q?.trading_date) &&
    quality?.status === "valid" &&
    Array.isArray(quality.reasons) &&
    quality.reasons.length === 0 &&
    typeof deadline === "number" &&
    Number.isFinite(deadline) &&
    now / 1000 < deadline &&
    (observed == null ||
      (observed <= now / 1000 && Number.isFinite(observed))) &&
    (status === "closed" ||
      status === "opening_soon" ||
      (status === "open" &&
        q?.trading_date === currentDay &&
        typeof observed === "number" &&
        deadline <= observed + 120));
  const reference = r?.reference_price;
  const refValid =
    reference &&
    positive(reference.price) &&
    validDay(reference.price_date) &&
    Number.isFinite(Date.parse(reference.collected_at)) &&
    Date.parse(reference.collected_at) <= now &&
    reference.price_date <= day(reference.collected_at) &&
    (!reference.traded_at ||
      (Number.isFinite(Date.parse(reference.traded_at)) &&
        Date.parse(reference.traded_at) <= Date.parse(reference.collected_at) &&
        day(reference.traded_at) === reference.price_date)) &&
    /^https:\/\/(www\.)?bodiva\.ao\//i.test(reference.source_url) &&
    /^[a-f\d]{64}$/i.test(reference.source_hash) &&
    !!reference.parser_version?.trim();
  const updateNote =
    r?.reference_update_status && r.reference_update_status !== "verified"
      ? "A última verificação da referência não confirmou novos preços."
      : undefined;
  if (refValid && (!current || (q?.trading_date ?? "") < reference.price_date))
    return {
      price: reference.price,
      label: "Referência BODIVA",
      priceDate: reference.price_date,
      verifiedAt: reference.collected_at,
      change: null,
      changeLabel: "Sem referência de variação confirmada",
      stale: true,
      source: reference.source_url,
      note: updateNote,
    };
  const closeValid =
    c &&
    positive(c.price) &&
    validDay(c.trading_date) &&
    Number.isFinite(Date.parse(c.confirmed_at)) &&
    Date.parse(c.confirmed_at) <= now &&
    c.trading_date <= day(c.confirmed_at);
  if (
    (status === "closed" || status === "opening_soon") &&
    closeValid &&
    typeof deadline === "number" &&
    deadline > now / 1000 &&
    (!current || c.trading_date >= (q?.trading_date ?? ""))
  )
    return {
      price: c.price,
      label: "Último fecho BODIVA",
      priceDate: c.trading_date,
      verifiedAt: c.confirmed_at,
      change: Number.isFinite(c.verified_change_percent)
        ? c.verified_change_percent
        : null,
      changeLabel: "Face ao fecho da sessão anterior",
      stale: c.trading_date !== currentDay,
      source: null,
      deadline,
    };
  const displayable =
    positive(raw) &&
    validDay(q?.trading_date) &&
    quality &&
    ["valid", "stale", "delayed"].includes(quality.status) &&
    Array.isArray(quality.reasons) &&
    quality.reasons.every((r) =>
      ["staleFetch", "staleObservation", "delayedIngestion"].includes(r),
    ) &&
    (observed == null || (Number.isFinite(observed) && observed <= now / 1000));
  if (displayable)
    return {
      price: raw,
      label: current ? "Cotação BODIVA" : "Última cotação BODIVA",
      priceDate: q.trading_date,
      verifiedAt: observed ? new Date(observed * 1000).toISOString() : null,
      change:
        current && Number.isFinite(q.verified_change_percent)
          ? q.verified_change_percent
          : null,
      changeLabel: "Face ao fecho da sessão anterior",
      stale: !current,
      source: null,
      deadline: current ? deadline : undefined,
    };
  return {
    price: null,
    label: "Sem cotação confirmada",
    priceDate: null,
    verifiedAt: null,
    change: null,
    changeLabel: "Variação indisponível",
    stale: false,
    source: null,
  };
}
