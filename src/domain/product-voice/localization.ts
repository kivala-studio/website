import type { Translate } from "../format";
import { BUNDLED_CATALOGUE, FALLBACK_COMPOSITION, type ProductVoiceCatalogue, type VoiceComposition } from "./voice";

/*
 * iOS `VoiceComposition+Localization`: compositions are stored in Portuguese; at the display boundary a known
 * catalogue template is matched against the stored text and rendered again in the page's language. Publication
 * titles and measurements stay as they were verified. The templates' translations live in `messages/*.json`.
 */

/** Catalogue component id → message key. `publication-fact` (`{publicationTitle}`) has nothing to translate. */
export const TEMPLATE_KEYS: Readonly<Record<string, string>> = {
  "move-neutral": "legacy.issuerEstaAMexer",
  "move-curious": "legacy.temMovimentoEmIssuer",
  "move-playful": "legacy.issuerHojeNaoVeioBrincar",
  "move-early": "legacy.issuerAcordouComVontade",
  "move-down": "legacy.issuerLevouUmAbanao",
  "move-attention": "legacy.istoJaMereceAtencao",
  "watched-neutral": "legacy.umDosTeusFavoritosEstaA",
  "watched-curious": "legacy.aTuaListaQuerAtencao",
  "watched-rank": "legacy.quemSeDestacouNaTuaLista",
  "watched-breadth": "legacy.oMovimentoNaTuaLista",
  "watched-run": "legacy.issuerMantemOPasso",
  "watched-extreme": "legacy.issuerFechouEmDestaque",
  "watched-news": "legacy.haNovidadesSobreIssuer",
  "listing-neutral": "legacy.novoNaBodiva",
  "listing-welcome": "legacy.newcomerInTheBuilding",
  "listing-conversation": "legacy.issuerChegouABodiva",
  "portfolio-neutral": "legacy.aTuaCarteiraEmMovimento",
  "portfolio-up": "legacy.aTuaCarteiraGanhouTerreno",
  "portfolio-down": "legacy.hojeACarteiraRecuou",
  "wrap-neutral": "legacy.oMercadoPelosNumeros",
  "wrap-curious": "legacy.vamosVerOQueMexeu",
  "quiet-neutral": "legacy.mercadoEmModoTranquilo",
  "quiet-playful": "legacy.hojeABodivaDecidiuDescansar",
  "empty-neutral": "legacy.oTeuRadarAindaEstaVazio",
  "empty-welcome": "legacy.quemVaisAcompanhar",
  unavailable: "legacy.aindaFaltamDados",
  "reference-break": "legacy.osReferencepriceNaoDuraramMuito",
  record: "legacy.temosNovoMaximo",
  capitalization: "legacy.umaNovaMarcaNoMercado",
  "wrap-watchlist": "legacy.aTuaListaAoFecho",
  "wrap-portfolio": "legacy.aTuaCarteiraPelosNumeros",
  "movement-fact": "legacy.symbolSignedpercentageComparisonlabel",
  "intraday-fact": "legacy.symbolSignedpercentageEntreNegociacoesEmAte",
  "listing-fact": "legacy.issuerJaEstaOficialmenteEmNegociacao",
  "rank-fact": "legacy.symbolSignedpercentageMaiorVariacaoAbsolutaNa",
  "breadth-fact": "legacy.risingEmSubidaFallingEmDescida",
  "run-fact": "legacy.symbolSessionsSessoesDeDirectionlabelReferenceperiod",
  "extreme-fact": "legacy.symbolExtremelabelDeFechoDoPeriodo",
  "portfolio-fact": "legacy.signedpercentagePorVariacaoDasCotacoesEntre",
  "wrap-fact": "legacy.oQueMarcouReferenceperiodComDados",
  "quiet-fact": "legacy.semGrandesMovimentosNoPeriodoObservado",
  "empty-fact": "legacy.adicionaOsInstrumentosQueQueresAcompanhar",
  "unavailable-fact": "legacy.aindaNaoHaDadosVerificadosSuficientes",
  "reference-fact": "legacy.symbolUltrapassouAReferenciaVerificadaDe",
  "record-fact": "legacy.symbolAtingiuUmNovoMaximoEm",
  "capitalization-fact": "legacy.aCapitalizacaoVerificadaUltrapassouReferencepriceKz",
};

/** Stored Portuguese labels and fallback copy → message key (iOS looks these up by their source text). */
export const SOURCE_KEYS: Readonly<Record<string, string>> = {
  "face ao último fecho": "legacy.faceAoUltimoFecho",
  "entre negociações em até 5 min": "legacy.entreNegociacoesEmAte5Min",
  subida: "legacy.subida",
  descida: "legacy.descida",
  máximo: "legacy.maximo",
  mínimo: "legacy.minimo",
  [FALLBACK_COMPOSITION.title]: "legacy.novaInformacaoEmInvestAo",
  [FALLBACK_COMPOSITION.body]: "legacy.abraAAplicacaoParaConsultarA",
};

const VERIFIED_CLOSES_PREFIX = "entre os fechos verificados de ";
const VERIFIED_CLOSES_KEY = "legacy.entreOsFechosVerificadosDe";
const LABEL_TOKENS = new Set(["comparisonLabel", "directionLabel", "extremeLabel"]);
const TOKEN = /\{([^}]+)\}/g;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every key the localisation can read: client pages add them to their messages. */
export const PRODUCT_VOICE_MESSAGE_KEYS: readonly string[] = [
  ...new Set([...Object.values(TEMPLATE_KEYS), ...Object.values(SOURCE_KEYS), VERIFIED_CLOSES_KEY]),
].sort();

function sourceText(source: string, t: Translate): string {
  const key = SOURCE_KEYS[source];
  return key ? t(key) : source;
}

function render(source: string, template: { id: string; text: string } | undefined, t: Translate): string {
  if (!template) return sourceText(source, t);
  const tokens = [...template.text.matchAll(TOKEN)].map((match) => match[1]);
  const pattern = template.text
    .split(TOKEN)
    .map((part, index) => (index % 2 === 1 ? "(.+?)" : escape(part)))
    .join("");
  const match = new RegExp(`^${pattern}$`, "u").exec(source);
  if (!match) return sourceText(source, t);
  const values: Record<string, string> = {};
  tokens.forEach((token, index) => {
    const raw = match[index + 1];
    if (token === "comparisonLabel" && raw.startsWith(VERIFIED_CLOSES_PREFIX))
      values[token] = t(VERIFIED_CLOSES_KEY, { arg1: raw.slice(VERIFIED_CLOSES_PREFIX.length) });
    else if (LABEL_TOKENS.has(token)) values[token] = sourceText(raw, t);
    else values[token] = raw;
  });
  const key = TEMPLATE_KEYS[template.id];
  if (key) return t(key, values);
  return template.text.replace(TOKEN, (whole, token: string) => values[token] ?? whole);
}

/** The composition in the page's language. Portuguese is the stored language and returns unchanged. */
export function localizeComposition(
  composition: VoiceComposition,
  locale: "pt" | "en",
  t: Translate,
  catalogue: ProductVoiceCatalogue | null = BUNDLED_CATALOGUE,
): VoiceComposition {
  if (locale === "pt") return composition;
  const title = render(
    composition.title,
    catalogue?.hooks.find((hook) => hook.id === composition.hookId),
    t,
  );
  const body = render(
    composition.body,
    catalogue?.factClauses.find((clause) => clause.id === composition.factClauseId),
    t,
  );
  return { ...composition, title, body, accessibilityText: `${title}. ${body}` };
}
