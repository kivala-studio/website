import Link from "next/link";
import { pageMetadata } from "../../lib/seo";
import "../policy/policy.css";

export const metadata = pageMetadata({
  title: "Política de Cookies | invest.ao",
  description: "Os cookies e o armazenamento do navegador usados pela invest.ao, para que servem e como os podes gerir.",
  path: "/cookies",
});

export default function CookiesPolicy() {
  return (
    <main className="policy-page" lang="pt-AO">
      <nav aria-label="Navegação da política">
        <Link href="/">invest.ao</Link>
        <Link href="/">Voltar ao início</Link>
      </nav>
      <header>
        <span>COOKIES E ARMAZENAMENTO DO NAVEGADOR</span>
        <h1>Política de Cookies</h1>
        <p>Última atualização: 20 de outubro de 2026</p>
      </header>
      <p>Esta política explica como a invest.ao usa cookies e outras formas de armazenamento no navegador. Complementa a <Link href="/policy">Política de Privacidade</Link> e descreve os mecanismos incluídos na versão atual do site.</p>
      <section>
        <h2>1. O que são cookies e armazenamento local?</h2>
        <p>Os cookies são pequenos registos que o navegador pode enviar ao site em pedidos seguintes. O armazenamento local (localStorage) e o IndexedDB permitem guardar dados no próprio navegador. O nosso site usa estes mecanismos para manter a sessão, memorizar definições e disponibilizar funcionalidades da tua conta.</p>
      </section>
      <section>
        <h2>2. O que usamos e durante quanto tempo?</h2>
        <div className="policy-table-wrap" role="region" aria-label="Cookies e armazenamento utilizados" tabIndex={0}>
          <table className="policy-table">
            <thead><tr><th scope="col">Mecanismo</th><th scope="col">Finalidade</th><th scope="col">Duração</th></tr></thead>
            <tbody>
              <tr>
                <th scope="row"><code>__Host-investao-apple-attempt</code><br />Cookie de segurança</th>
                <td>Associar o regresso da autorização Apple ao navegador que iniciou um pedido de eliminação da conta. Só é criado nesse processo.</td>
                <td>Até 5 minutos; removido quando o regresso é validado.</td>
              </tr>
              <tr>
                <th scope="row"><code>__Host-investao-apple-result</code><br />Cookie de segurança</th>
                <td>Permitir a confirmação do resultado desse pedido e a conclusão da limpeza local, quando aplicável.</td>
                <td>Até ao fim da validade da confirmação, no máximo 5 minutos após a sua emissão; removido quando o resultado é confirmado pelo site.</td>
              </tr>
              <tr>
                <th scope="row">Sessão Supabase<br /><code>sb-…-auth-token</code> e verificadores de acesso em localStorage</th>
                <td>Manter a sessão e concluir o início de sessão com Google ou Apple. O site não guarda as palavras-passe destes fornecedores.</td>
                <td>A sessão pode manter-se entre visitas, enquanto for válida, até terminares sessão ou limpares os dados do site. Os verificadores são consumidos no processo de acesso.</td>
              </tr>
              <tr>
                <th scope="row">Definições<br /><code>investao.appearance</code><br /><code>investao.privacy</code></th>
                <td>Memorizar a aparência e a opção de ocultar valores pessoais neste navegador.</td>
                <td>Até alterares as definições ou limpares os dados do site.</td>
              </tr>
              <tr>
                <th scope="row">Preferências funcionais da conta<br />Registos locais <code>investao.…</code></th>
                <td>Guardar sinais de utilização, observações já apresentadas e escolhas de personalização. Alguns sinais são sincronizados com a tua conta para adaptar a informação apresentada.</td>
                <td>Conforme os limites de validade dos registos, as opções da conta e a limpeza dos dados do site.</td>
              </tr>
              <tr>
                <th scope="row">Histórico de resumos<br /><code>investao-wrap-history</code> em IndexedDB</th>
                <td>Guardar edições e o estado de reprodução dos resumos associados à tua conta neste navegador.</td>
                <td>Até expirar a validade dos registos ou serem removidos pelas opções da conta ou pela limpeza dos dados do site.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>Os cookies de segurança indicados são próprios do site, transmitidos por HTTPS e protegidos contra leitura por JavaScript. O armazenamento de preferências no navegador não é enviado automaticamente como um cookie; a aplicação pode sincronizar os dados necessários às funcionalidades da tua conta.</p>
      </section>
      <section>
        <h2>3. Publicidade e serviços externos</h2>
        <p>O código atual do site não inclui cookies publicitários, píxeis de marketing nem ferramentas de análise de terceiros. A personalização funcional da conta é distinta de publicidade e pode ser gerida nas definições disponíveis.</p>
        <p>Quando escolhes Google ou Apple para iniciar sessão, ou abres a App Store, passas por serviços externos que podem usar os seus próprios cookies. Consulta as políticas da <a href="https://policies.google.com/privacy">Google</a>, da <a href="https://www.apple.com/legal/privacy/">Apple</a> e da <a href="https://supabase.com/privacy">Supabase</a> para conhecer as respetivas práticas.</p>
      </section>
      <section>
        <h2>4. Como podes gerir os teus dados?</h2>
        <p>Podes terminar sessão e alterar a aparência, a privacidade e as opções de personalização na tua conta. Nas definições do navegador, podes consultar, bloquear ou eliminar cookies e dados locais de invest.ao.</p>
        <p>Bloquear ou eliminar estes dados pode terminar a sessão, repor preferências e remover o histórico guardado apenas neste navegador. Limpar os dados do site não elimina, por si só, a tua conta nem os dados já guardados no serviço. O modo de privacidade oculta valores no ecrã; não apaga cookies ou dados locais.</p>
      </section>
      <section>
        <h2>5. Alterações e contacto</h2>
        <p>Atualizaremos esta página se os mecanismos ou as suas finalidades mudarem. Se introduzirmos utilizações que exijam uma escolha prévia, apresentaremos essa escolha antes de as ativar.</p>
        <p>Para questões sobre cookies ou dados pessoais, escreve para <a href="mailto:info@invest.ao">info@invest.ao</a>. Para mais informação sobre o tratamento de dados, consulta a <Link href="/policy">Política de Privacidade</Link>.</p>
      </section>
      <footer><Link href="/">Voltar à invest.ao</Link></footer>
    </main>
  );
}
