"use client";

import { useRef, useState } from "react";

// This preview demonstrates organisation without simulating live market data.
const assets = [
  { ticker: "BAI", name: "Banco Angolano de Investimentos" },
  { ticker: "BCGA", name: "Banco Caixa Geral Angola" },
];

const views = [
  {
    id: "mercado",
    name: "Mercado",
    number: "01",
    title: "Explore os títulos do mercado.",
    description:
      "Consulte os títulos desta demonstração e seleccione a estrela para guardar um favorito.",
  },
  {
    id: "carteira",
    name: "Carteira",
    number: "02",
    title: "As suas posições, organizadas.",
    description:
      "Um espaço para reunir as suas posições e acompanhar a composição da carteira.",
  },
  {
    id: "favoritos",
    name: "Favoritos",
    number: "03",
    title: "Os títulos que pretende acompanhar.",
    description:
      "Os títulos guardados no separador Mercado ficam reunidos nesta lista de favoritos.",
  },
] as const;

export default function MarketExplorer() {
  const [active, setActive] = useState<(typeof views)[number]["id"]>("mercado");
  const [favorites, setFavorites] = useState<string[]>([]);
  const viewButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const view = views.find((item) => item.id === active)!;
  const visibleAssets =
    active === "favoritos"
      ? assets.filter((asset) => favorites.includes(asset.ticker))
      : assets;

  function toggleFavorite(ticker: string) {
    setFavorites((current) =>
      current.includes(ticker)
        ? current.filter((item) => item !== ticker)
        : [...current, ticker],
    );
  }

  function returnToMarket() {
    setActive("mercado");
    viewButtons.current[0]?.focus();
  }

  return (
    <div className="explorer">
      <div
        className="explorer-nav"
        role="group"
        aria-label="Vistas da demonstração"
      >
        {views.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              viewButtons.current[index] = element;
            }}
            type="button"
            aria-pressed={active === item.id}
            aria-controls="explorer-content"
            onClick={() => setActive(item.id)}
          >
            <span>{item.number}</span>
            {item.name}
          </button>
        ))}
        <span className="demo-label">PRÉ-VISUALIZAÇÃO</span>
      </div>
      <div className="explorer-body" id="explorer-content">
        <div className="explorer-context">
          <span className="label">
            {active === "carteira"
              ? "CARTEIRA DE TÍTULOS"
              : "MERCADO DE CAPITAIS · AO"}
          </span>
          <h3>{view.title}</h3>
          <p>{view.description}</p>
          <div className="context-bottom">
            <strong>
              {active === "carteira"
                ? "00"
                : String(visibleAssets.length).padStart(2, "0")}
              <span className="context-slash">/</span>
            </strong>
            <span>
              {active === "carteira"
                ? "posições nesta pré-visualização"
                : active === "favoritos"
                  ? "títulos nos favoritos"
                  : "títulos nesta pré-visualização"}
            </span>
          </div>
        </div>
        <div className="ledger">
          <div className="ledger-heading">
            <span>{view.name}</span>
            <span className="ledger-currency">
              {active === "carteira" ? "POSIÇÕES" : "ACÇÕES / ANGOLA"}
            </span>
          </div>
          {active === "carteira" ? (
            <div className="empty-state portfolio-empty">
              <span className="label">AINDA SEM POSIÇÕES</span>
              <h4>Organize a carteira na aplicação.</h4>
              <p>
                Na aplicação, poderá reunir as suas posições e consultar a
                composição da carteira. Esta demonstração não permite adicionar
                posições nem está ligada a uma conta.
              </p>
              <button type="button" onClick={returnToMarket}>
                Conhecer os títulos
              </button>
            </div>
          ) : visibleAssets.length > 0 ? (
            <table>
              <caption className="sr-only">
                Títulos para explorar a interface. Não estão disponíveis
                cotações nesta pré-visualização.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Título / emitente</th>
                  <th scope="col">Cotação / Kz</th>
                  <th scope="col">Guardar</th>
                </tr>
              </thead>
              <tbody>
                {visibleAssets.map((asset) => (
                  <tr key={asset.ticker}>
                    <th scope="row">
                      <span className="ticker">{asset.ticker}</span>
                      <span className="company-name">{asset.name}</span>
                    </th>
                    <td className="quote-unavailable">
                      <span aria-hidden="true">—</span>
                      <span className="quote-caption">Indisponível</span>
                    </td>
                    <td>
                      <button
                        className="favorite-button"
                        type="button"
                        aria-label={`Favorito: ${asset.ticker}`}
                        aria-pressed={favorites.includes(asset.ticker)}
                        onClick={() => {
                          // Removing the focused row must leave keyboard users in the preview.
                          if (active === "favoritos") {
                            viewButtons.current[2]?.focus();
                          }
                          toggleFavorite(asset.ticker);
                        }}
                      >
                        <span aria-hidden="true">
                          {favorites.includes(asset.ticker) ? "★" : "☆"}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <span className="label">AINDA SEM FAVORITOS</span>
              <h4>Guarde o primeiro favorito.</h4>
              <p>
                Seleccione a estrela junto de um título no separador Mercado.
                O título ficará disponível nesta lista.
              </p>
              <button type="button" onClick={returnToMarket}>
                Explorar títulos
              </button>
            </div>
          )}
          <div className="ledger-note">
            <span className="status-dot" />
            <span>
              {active === "carteira"
                ? "Pré-visualização da carteira · Sem posições associadas"
                : "Pré-visualização da interface · Sem cotações de mercado"}
            </span>
          </div>
        </div>
      </div>
      <p className="sr-only" role="status">
        {view.name}. {favorites.length}{" "}
        {favorites.length === 1 ? "título guardado" : "títulos guardados"} na
        demonstração.
      </p>
    </div>
  );
}
