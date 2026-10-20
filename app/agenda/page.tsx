import Events from "./events";
import ListingEvents from "../components/listing-events";
import Link from "next/link";
import { PublicShell } from "../public-shell";
import { read } from "../../lib/public-data";
import { date } from "../../lib/market-presentation";
import { todayLuanda } from "../../lib/finance";
import { DataError } from "../public-content";
import DevelopmentState from "../components/development-state";
type Calendar = {
  contract_version: number;
  timezone: string;
  source: string;
  valid_until: string;
  days: {
    day: string;
    kind: string;
    opens_at: string | null;
    closes_at: string | null;
  }[];
};
type Dividend = {
  id: string;
  issuer_id: string;
  record_date: string | null;
  ex_dividend_date: string | null;
  payment_date: string | null;
  source_url: string;
  issuers: { name: string };
};
export const metadata = { title: "Agenda do mercado | invest.ao" };
export default async function Page() {
  const start = todayLuanda();
  const end = new Date(Date.parse(`${start}T12:00:00Z`) + 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const [calendar, dividends, securities] = await Promise.all([
    read<Calendar>("rpc/get_market_calendar", {
      starts_on: start,
      ends_on: end,
    }).catch(() => null),
    read<Dividend[]>("issuer_dividends", {
      select:
        "id,issuer_id,record_date,ex_dividend_date,payment_date,source_url,issuers(name)",
      order: "payment_date.desc.nullslast",
      limit: "1000",
    }).catch(() => null),
    read<{ id: string; issuer_id: string }[]>("securities", {
      select: "id,issuer_id",
      limit: "1000",
    }).catch(() => []),
  ]);
  const valid =
    calendar?.contract_version === 2 &&
    calendar.timezone === "Africa/Luanda" &&
    Date.parse(calendar.valid_until) > new Date().getTime();
  const events = (dividends || [])
    .flatMap((d) =>
      (
        [
          [d.record_date, "Data de registo"],
          [d.ex_dividend_date, "Ex-dividendo"],
          [d.payment_date, "Pagamento de dividendos"],
        ] as const
      )
        .filter(([day]) => day && day >= start && day <= end)
        .map(([day, title]) => ({
          id: `${d.id}-${title}`,
          assets: securities
            .filter((s) => s.issuer_id === d.issuer_id)
            .map((s) => s.id),
          day: day!,
          title,
          issuer: d.issuers?.name || "Emitente",
          source: d.source_url,
        })),
    )
    .sort((a, b) => a.day.localeCompare(b.day));
  return (
    <PublicShell>
      <header className="page-heading">
        <p className="eyebrow">OS PRÓXIMOS 14 DIAS</p>
        <h1>O que vem a seguir.</h1>
        <p>
          Datas anunciadas pelos emitentes e calendário de sessões da BODIVA.
          Horas de Luanda.
        </p>
      </header>
      <DevelopmentState feature="weekAhead" compact />
      <ListingEvents />
      <div className="split-layout">
        <section className="dashboard-panel">
          <h2>Eventos dos emitentes</h2>
          {dividends === null ? (
            <DataError content="os eventos" />
          ) : (
            <Events events={events} />
          )}
          <p className="fine-print">
            As datas de dividendos mantêm-se como foram anunciadas. Uma sessão
            encerrada não altera automaticamente a data de um evento.
          </p>
        </section>
        <section className="dashboard-panel">
          <h2>Sessões de mercado</h2>
          {valid ? (
            calendar!.days.map((day) => (
              <div className="calendar-row" key={day.day}>
                <div>
                  <h3>{date(day.day)}</h3>
                  <p>
                    {day.opens_at && day.closes_at
                      ? `${day.opens_at.slice(0, 5)} – ${day.closes_at.slice(0, 5)}`
                      : day.kind === "holiday"
                        ? "Feriado · sem sessão"
                        : "Sem sessão"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <DataError content="o calendário verificado" />
          )}
          {valid && /^https:\/\//.test(calendar!.source) && (
            <a
              className="text-button"
              href={calendar!.source}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar fonte BODIVA
            </a>
          )}
          <p className="fine-print">
            Estado verificado nesta consulta.{" "}
            <Link href="/agenda">Actualizar calendário</Link>
          </p>
        </section>
      </div>
    </PublicShell>
  );
}
