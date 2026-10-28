import { PublicShell } from "../public-shell";
import WorkspaceLink from "../components/workspace-link";
import Icon from "../components/invest-icon";
import { appDistribution } from "../../lib/app-distribution";
import { planLimits } from "../../lib/subscriptions";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata({
  title: "Planos Gratuito e Plus | invest.ao",
  description:
    "Explora o mercado sem conta. Compara os limites do plano Gratuito e do invest.ao Plus antes de escolher.",
  path: "/planos",
});
const rows = [
  [
    "Pesquisa, mercado, instrumentos e notícias",
    "Consulta pública, sem conta",
    "A mesma consulta pública",
  ],
  [
    "Instrumentos na lista",
    `Até ${planLimits.freeWatchlist}`,
    `Até ${planLimits.plusWatchlist}`,
  ],
  [
    "Movimentos automáticos",
    "1 instrumento seleccionado",
    "Instrumentos guardados na lista",
  ],
  [
    "Comparação",
    "1 par de 2 instrumentos por semana",
    "Sem limite semanal; até 3 instrumentos no iPhone",
  ],
  [
    "Reabrir o par e alterar o período",
    "Incluído no mesmo par semanal",
    "Incluído",
  ],
  [
    "Comparação no navegador",
    "2 instrumentos",
    "2 instrumentos; a opção de 3 está em desenvolvimento na web",
  ],
  [
    "Alertas com preços definidos por ti",
    "Disponíveis com conta",
    "Disponíveis com conta",
  ],
];
export default function PlansPage() {
  const distribution = appDistribution();
  return (
    <PublicShell>
      <header className="page-heading plans-intro">
        <h1>
          O mercado é o começo.
          <br />
          <span className="accent-text">O plano é teu.</span>
        </h1>
      </header>
      <div className="plans-grid">
        <section className="plan-card" aria-labelledby="free-plan">
          <h2 id="free-plan">Gratuito</h2>
          <p className="plan-price">Sem custo</p>
          <ul>
            {[
              `Até ${planLimits.freeWatchlist} instrumentos na tua lista`,
              "Movimentos automáticos de 1 instrumento",
              "1 par de 2 instrumentos por semana",
              "Reabre o mesmo par e muda o período",
            ].map((text) => (
              <li key={text}>
                <Icon name="check" size={18} />
                {text}
              </li>
            ))}
          </ul>
          <WorkspaceLink className="secondary-button" href="/dashboard">
            Entrar ou criar conta gratuita
          </WorkspaceLink>
        </section>
        <section className="plan-card plus" aria-labelledby="plus-plan">
          <h2 id="plus-plan">invest.ao Plus</h2>
          <p className="plan-price">Mensal ou anual</p>
          <ul>
            {[
              `Até ${planLimits.plusWatchlist} instrumentos na tua lista`,
              "Movimentos automáticos nos instrumentos guardados",
              "Comparações sem limite semanal",
              "Até 3 instrumentos por comparação no iPhone",
            ].map((text) => (
              <li key={text}>
                <Icon name="check" size={18} />
                {text}
              </li>
            ))}
          </ul>
          {distribution.url ? (
            <a
              className="primary-button"
              href={distribution.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Conhecer o Plus no iPhone <Icon name="arrow-up-right" size={16} />
            </a>
          ) : (
            <p className="plan-note">
              O destino oficial da aplicação está temporariamente indisponível.
              Contacta info@invest.ao para conhecer a disponibilidade.
            </p>
          )}
        </section>
      </div>
      <p className="plan-note">
        Os preços são apresentados pela App Store na moeda da tua loja, antes de
        confirmares a subscrição. A opção mensal é cobrada por mês e a anual por
        ano. A disponibilidade de um período experimental depende da
        elegibilidade apresentada na aplicação. Não efectuamos subscrições ou
        cobranças neste site.
      </p>
      <section className="plan-comparison" aria-labelledby="compare-plans">
        <h2 id="compare-plans">O que muda em cada plano.</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Funcionalidade</th>
              <th scope="col">Gratuito</th>
              <th scope="col">Plus</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([feature, free, plus]) => (
              <tr key={feature}>
                <th scope="row">{feature}</th>
                <td data-plan="Gratuito">{free}</td>
                <td data-plan="Plus">{plus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="plan-faq question-list" aria-labelledby="plan-questions">
        <h2 id="plan-questions">Antes de escolher.</h2>
        <details>
          <summary>O que posso consultar sem conta?<Icon name="chevron-down" size={18} /></summary>
          <p>
            A pesquisa, o catálogo de mercado, os detalhes dos instrumentos, os
            históricos disponíveis, as notícias publicadas e esta comparação de
            planos. Guardar uma lista, registar uma carteira, criar alertas e
            utilizar a comparação requer uma conta.
          </p>
        </details>
        <details>
          <summary>Como funciona o par semanal gratuito?<Icon name="chevron-down" size={18} /></summary>
          <p>
            Escolhes um par de dois instrumentos ao confirmar uma comparação com
            dados suficientes. Podes voltar ao mesmo par, mesmo com a ordem
            invertida, e alterar o período. O limite renova à segunda-feira, às
            00:00 de Luanda. O servidor confirma os limites aplicáveis à tua
            conta.
          </p>
        </details>
        <details>
          <summary>O Plus dá acesso a tudo no navegador?<Icon name="chevron-down" size={18} /></summary>
          <p>
            O acesso é confirmado pela mesma conta. Algumas opções continuam
            específicas do iPhone: a comparação de três instrumentos e as
            notificações no dispositivo. A comparação na web permite actualmente
            dois instrumentos; as notificações fora do navegador estão em
            desenvolvimento.
          </p>
        </details>
        <details>
          <summary>Como consulto o preço e giro a subscrição?<Icon name="chevron-down" size={18} /></summary>
          <p>
            Na aplicação para iPhone, consulta as opções disponíveis e o preço
            total do período escolhido antes de confirmar. A subscrição renova
            automaticamente salvo cancelamento nas definições da App Store.
            Eliminar a conta invest.ao não cancela uma subscrição Apple.
          </p>
        </details>
      </section>
    </PublicShell>
  );
}
