import { read, type Quality, type Security } from "../../lib/public-data";
import { date, number, priceText } from "../../lib/market-presentation";
import { DataError } from "../public-content";
type Report = {
  id: string;
  title: string;
  reporting_period: string;
  published_at: string | null;
  url: string;
};
type Dividend = {
  amount_per_share: number;
  currency: string;
  fiscal_year: number;
  ex_dividend_date: string | null;
  payment_date: string | null;
  source_url: string;
};
type Book = {
  trading_date: string;
  data_quality: Quality;
  order_book_levels: {
    side: string;
    level: number;
    price: number;
    quantity: number;
  }[];
};
export default async function InstrumentResearch({
  security,
}: {
  security: Security;
}) {
  const [reports, dividends, books] = await Promise.all([
    security.issuer_id
      ? read<Report[]>("issuer_financial_reports", {
          select: "id,title,reporting_period,published_at,url",
          issuer_id: `eq.${security.issuer_id}`,
          order: "period_end.desc.nullslast",
          limit: "100",
        }).catch(() => null)
      : [],
    security.issuer_id
      ? read<Dividend[]>("latest_issuer_dividends", {
          select:
            "amount_per_share,currency,fiscal_year,ex_dividend_date,payment_date,source_url",
          issuer_id: `eq.${security.issuer_id}`,
          limit: "1",
        }).catch(() => null)
      : [],
    read<Book[]>("quality_latest_order_books", {
      select: "trading_date,data_quality,order_book_levels",
      security_id: `eq.${security.id}`,
      limit: "2",
    }).catch(() => null),
  ]);
  const book = books?.length === 1 ? books[0] : null;
  const q = book?.data_quality;
  const usable =
    q?.status === "valid" &&
    q.reasons?.length === 0 &&
    !!q.validUntilEpoch &&
    q.validUntilEpoch * 1000 > new Date().getTime();
  return (
    <>
      <section className="public-section dashboard-panel">
        <h2>Livro de ordens</h2>
        {books === null ? (
          <DataError content="o livro de ordens" />
        ) : usable && book!.order_book_levels.length ? (
          <>
            <p className="data-note">
              Referência: {date(book!.trading_date)}. Ordens indicativas,
              sujeitas a alteração.
            </p>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lado</th>
                    <th>Nível</th>
                    <th>Preço</th>
                    <th>Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {book!.order_book_levels
                    .filter(
                      (l) =>
                        Number.isFinite(l.price) &&
                        l.price > 0 &&
                        Number.isFinite(l.quantity) &&
                        l.quantity >= 0,
                    )
                    .sort((a, b) => a.level - b.level)
                    .map((l) => (
                      <tr key={`${l.side}-${l.level}`}>
                        <td>
                          {["buy", "bid"].includes(l.side) ? "Compra" : "Venda"}
                        </td>
                        <td>{l.level}</td>
                        <td>{priceText(security, l.price)}</td>
                        <td>{number(l.quantity)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="data-note">
            Não há um livro de ordens com validade confirmada nesta consulta.
          </p>
        )}
      </section>
      <div className="settings-layout public-section">
        <section className="dashboard-panel">
          <h2>Dividendos</h2>
          {dividends === null ? (
            <DataError content="os dividendos" />
          ) : dividends.length ? (
            dividends.map((d) => (
              <div key={d.fiscal_year}>
                <div className="metric-grid">
                  <div>
                    <span>Por acção · {d.fiscal_year}</span>
                    <strong>
                      {number(d.amount_per_share)}{" "}
                      {d.currency === "AOA" ? "Kz" : d.currency}
                    </strong>
                  </div>
                </div>
                <p className="data-note">
                  Ex-dividendo: {date(d.ex_dividend_date)}
                  <br />
                  Pagamento: {date(d.payment_date)}
                </p>
                {/^https:\/\//.test(d.source_url) && (
                  <a
                    className="text-button"
                    href={d.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Fonte do dividendo ↗
                  </a>
                )}
              </div>
            ))
          ) : (
            <p className="data-note">
              Sem dividendos publicados na fonte disponível.
            </p>
          )}
        </section>
        <section className="dashboard-panel">
          <h2>Relatórios do emitente</h2>
          {reports === null ? (
            <DataError content="os relatórios" />
          ) : reports.length ? (
            <div className="quick-links">
              {reports
                .filter((r) => /^https:\/\//.test(r.url))
                .map((r) => (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {r.title} · {r.reporting_period} ↗
                  </a>
                ))}
            </div>
          ) : (
            <p className="data-note">Não há relatórios disponíveis.</p>
          )}
        </section>
      </div>
    </>
  );
}
