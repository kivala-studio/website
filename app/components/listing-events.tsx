import Link from "next/link";
import { read } from "../../lib/public-data";
import { date } from "../../lib/market-presentation";
type Listing = {
  id: string;
  title: string;
  scheduled_date: string;
  status: string;
  source_url: string;
  source_name: string;
  confirmation_url: string | null;
  starts_at: string;
  expires_at: string;
  effective_at: string | null;
  updated_at: string;
  security_id: string | null;
  issuers: { name: string };
};
export default async function ListingEvents() {
  const now = new Date();
  const recent = new Date(now.getTime() - 5 * 86400000).toISOString();
  const rows = await read<Listing[]>("market_events", {
    select:
      "id,title,scheduled_date,status,source_url,source_name,confirmation_url,starts_at,expires_at,effective_at,updated_at,security_id,issuers(name)",
    kind: "eq.new_listing",
    status: "neq.cancelled",
    or: `(expires_at.gt.${now.toISOString()},and(status.eq.confirmed,effective_at.gte.${recent}))`,
    order: "scheduled_date",
    limit: "50",
  }).catch(() => null);
  const valid = rows?.filter(
    (r) =>
      r.title &&
      r.issuers?.name &&
      ["scheduled", "confirmed"].includes(r.status) &&
      /^https:\/\//.test(r.source_url) &&
      Date.parse(r.starts_at) <= now.getTime() &&
      Date.parse(r.updated_at) <= now.getTime() &&
      (r.status !== "confirmed" ||
        (r.confirmation_url && /^https:\/\//.test(r.confirmation_url))),
  );
  return (
    <section className="dashboard-panel public-section">
      <h2>Admissões à BODIVA</h2>
      {rows === null ? (
        <p className="error-state">Não foi possível consultar os anúncios.</p>
      ) : !valid?.length ? (
        <p className="empty-state">
          Sem novas admissões anunciadas neste momento.
        </p>
      ) : (
        valid.map((row) => (
          <article className="calendar-row" key={row.id}>
            <div>
              <p className="eyebrow">
                {row.status === "confirmed"
                  ? "ADMISSÃO CONFIRMADA"
                  : "ADMISSÃO PREVISTA"}{" "}
                · {date(row.scheduled_date)}
              </p>
              <h3>{row.title}</h3>
              <p>{row.issuers.name}</p>
              <div className="row-actions">
                <a
                  href={row.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {row.source_name || "Fonte do anúncio"}
                </a>
                {row.confirmation_url && (
                  <a
                    href={row.confirmation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Confirmação
                  </a>
                )}
                {row.security_id && (
                  <Link href={`/mercado/${row.security_id}`}>
                    Ver instrumento
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
