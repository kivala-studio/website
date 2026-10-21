# Página inicial e consulta pública invest.ao

A página inicial apresenta a invest.ao para web e iPhone, com consulta pública de mercado e acesso contextual à conta. A referência de hierarquia é a [CoinStats](https://coinstats.app/); marca, paleta, conteúdo e capturas são próprios.

## Acesso público e pessoal

`lib/public-routes.ts` permite apenas `/`, `/pesquisa`, `/mercado`, `/mercado/[id]`, `/noticias`, `/noticias/[slug]`, `/planos` e as páginas de políticas. `PublicShell` apresenta a navegação pública nestes destinos, antes de resolver uma sessão. Nas restantes rotas continua a usar `WorkspaceShell`, com a guarda de sessão existente. A página 404 é pública e não recebe conteúdos pessoais.

`SiteHeader` partilha pesquisa por instrumento/emitente/notícia e ligações para mercado, notícias e planos. `WorkspaceLink` deixa a consulta pública navegar directamente; os destinos pessoais continuam a abrir o início de sessão. Guardar um instrumento mantém o seu ID no destino da lista após o login, sem efectuar uma inserção automática. Criar alertas mantém o instrumento no destino de alertas. As contas Google/Apple e o onboarding não foram substituídos.

Pesquisa e catálogo reutilizam dados anónimos, filtros, ordenação, cotações datadas e estados de falha existentes. Os detalhes incluem histórico por período, factos do instrumento, emitente, dividendos/relatórios disponíveis e notícias relacionadas. Notícias continuam limitadas a artigos publicados e datas já decorridas. Não foram alterados grants, RLS, funções SQL ou segredos; não se usam credenciais privilegiadas para a consulta pública.

`app/homepage.css` contém a apresentação da home; `app/browse.css` contém o cabeçalho e as páginas públicas. Ambos usam os tokens de aparência de `globals.css`. As antigas folhas `landing.css` e `product-layout.css` não são importadas pela home. As capturas do iPhone estão identificadas como históricas. Sitemap e texto de privacidade reflectem as entradas públicas.

## Apresentação das listas públicas

Catálogo, resultados de pesquisa e painel de acções da home usam linhas abertas, sem divisórias horizontais. O espaçamento, os monogramas circulares e o realce de hover/foco agrupam cada instrumento. No desktop, preço/referência e variação têm colunas alinhadas; no mobile, a variação fica junto ao preço, mantendo as datas e os avisos de referências datadas. A comparação de planos também prescinde de grelha interna, com grupos por funcionalidade no mobile.

## Planos e limites

`/planos` compara o Gratuito e o Plus sem exigir conta. Os limites vêm do contrato nativo e das funções de subscrição existentes: Gratuito com 3 instrumentos guardados, movimentos automáticos de 1 instrumento e um par de 2 instrumentos por semana; Plus com até 500 guardados e comparações sem limite semanal, até 3 instrumentos no iPhone. A web continua a suportar 2 instrumentos por comparação e identifica a diferença. Alertas com preços definidos pelo utilizador não são apresentados como exclusivos do Plus.

A página identifica as opções mensal/anual e encaminha para a distribuição oficial do iPhone. Não publica preços de demonstração do código iOS, não oferece um teste incondicional e não cria checkout web. O preço localizado, a disponibilidade e a elegibilidade são apresentados na aplicação/App Store antes da confirmação.

A comparação permanece protegida. `get_subscription_access()` lê o estado da conta; `authorize_chart_comparison(security_ids)` decide e aplica o acesso e a quota. A web exige confirmação explícita do par, verifica primeiro dois fechos comuns no período seleccionado e só depois pede autorização. Não monta o gráfico se houver falha, resposta de acesso inválida, mudança de conta ou recusa da quota. Reabrir o par ou mudar o período não contorna a decisão do servidor. A activação global de limites e as excepções de teste continuam controladas pelo backend. Os limites de lista e movimentos mantêm os triggers existentes; erros específicos agora explicam o limite e ligam aos planos.

## Verificação

- Seis testes dirigidos de fronteira de rotas e autorização de comparação: rotas pessoais/disfarçadas, quota recusada, falha de dados, período sem dois fechos comuns, mudança de conta, Plus/rollout e resposta de acesso inválida.
- Quatro testes existentes do fluxo OAuth/PKCE, restauro de sessão e logout.
- ESLint nos ficheiros alterados e build de produção com TypeScript.
- Consulta anónima real: catálogo HTTP 200; lista pessoal, regras de alerta e RPCs de acesso/autorização recusam pedidos anónimos com HTTP 401. Não se alterou qualquer registo ou configuração no backend.
- Inspecção no browser: pesquisa, catálogo/filtros, detalhe/histórico, notícias/leitura, planos e destinos pessoais protegidos; layouts mobile claros/escuros.

Não foi efectuada uma compra, um login real num fornecedor externo ou uma alteração de subscrição/quotas em contas reais. As respostas Free/Plus e de recusa são verificadas nos testes dirigidos. A alteração não publica em produção.
