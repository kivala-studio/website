# Página inicial invest.ao

A página inicial apresenta a invest.ao para web e iPhone, com preços públicos de referência e acesso às funcionalidades através da conta existente.

## Direcção visual

A referência é a hierarquia de produto da [CoinStats](https://coinstats.app/): introdução curta, acções claras e mercado próximo do início. A composição usa a marca da palanca, o azul da invest.ao, conteúdo do mercado angolano e capturas próprias. Não reutiliza imagens, texto, ícones de entidades ou código da referência.

`app/page.tsx` organiza introdução, atalhos, mercado, funcionalidades, continuação no iPhone e perguntas. `app/homepage.css` contém os estilos da página e preserva o diálogo de autenticação existente. As antigas folhas `landing.css` e `product-layout.css` não são importadas pela home. As cores continuam a vir de `globals.css`, seguindo o tema do sistema.

`LandingMarket` reutiliza a consulta pública existente e `MarketReading`: cinco acções, preços, datas, variações confirmadas e estados de carregamento, falha e ausência de dados. A tabela passa para uma composição de duas colunas em ecrãs pequenos. Não há gráficos ilustrativos nem preços inventados. As iniciais dos símbolos identificam os instrumentos; não são logótipos dos emitentes.

Os atalhos e convites mantêm `WorkspaceLink`, que abre o diálogo Google/Apple para visitantes e encaminha utilizadores autenticados para o destino. A distribuição iOS e o QR continuam a usar `appDistribution`. As capturas são identificadas como históricas e não representam dados actuais.

## Verificação

Build de produção com TypeScript e ESLint dirigido a `app/page.tsx` e `app/landing-market.tsx`. Inspecção no browser em desktop e em frames de 390px (escuro) e 320px (claro), incluindo preços, navegação, abertura/fecho do diálogo de acesso e perguntas. Não foram adicionados testes para alterações de apresentação. O login completo com fornecedores externos não faz parte desta alteração.
