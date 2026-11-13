import type { MarketUpdate } from "@/domain/market";
import { type EpochMs, MINUTE_MS } from "@/domain/market/zone";

const HOUR_MS = 60 * MINUTE_MS;

/*
 * Demo scenario `updates`: market information as iOS `MarketUpdate` describes it. No live source sends any yet,
 * so these exist only to show and test the screens. Related ids are BAI and BCG in the recorded snapshot.
 */
const BAI = "3c55bf40-8544-4598-bf76-15a165dbeff3";
const BCG = "ec7084ad-90ac-4cd2-b481-1572d02e2488";

export function demoMarketUpdates(now: EpochMs): MarketUpdate[] {
  return [
    {
      id: "demo-session-volume",
      category: "market",
      title: "Sessão com 186 negócios",
      detail: "O volume negociado ultrapassou 1,2 mil milhões Kz.",
      timestamp: now - 20 * MINUTE_MS,
      source: "Resumo de mercado BODIVA",
      relatedSecurityIDs: [BAI, BCG],
      body: [
        "A sessão registou 186 negócios e um volume total acima de 1,2 mil milhões de kwanzas.",
        "BAI e BCG estiveram entre os instrumentos com mais negócios.",
      ],
    },
    {
      id: "demo-issuer-report",
      category: "issuers",
      title: "BAI publica o relatório e contas",
      detail: "O emitente disponibilizou o relatório anual no seu sítio.",
      timestamp: now - 2 * HOUR_MS,
      source: "BAI",
      relatedSecurityIDs: [BAI],
      body: ["O relatório inclui as demonstrações financeiras auditadas do exercício.", "A data da assembleia geral será comunicada pelo emitente."],
    },
    {
      id: "demo-daily-bulletin",
      category: "bodiva",
      title: "Novo boletim diário",
      detail: "A BODIVA publicou a informação consolidada da sessão.",
      timestamp: now - 5 * HOUR_MS,
      source: "BODIVA",
      relatedSecurityIDs: [],
      body: ["O boletim reúne negócios, volumes, preços de referência e instrumentos negociados."],
    },
    {
      id: "demo-calendar-notice",
      category: "notices",
      title: "Comunicado de mercado",
      detail: "A BODIVA actualizou o calendário das próximas sessões.",
      timestamp: now - 26 * HOUR_MS,
      source: "BODIVA",
      relatedSecurityIDs: [],
      body: ["O comunicado indica os períodos de negociação e liquidação das próximas sessões."],
    },
  ];
}
