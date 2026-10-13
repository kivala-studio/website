# Consulta pública e continuação no iPhone

Auditoria: 13 de Outubro de 2026. Repositório `kivala-studio/website`, base `main`. Referências de domínio consultadas nos checkouts adjacentes `invest.ao` e `investao-functions`; esses projetos e o portal editorial não foram alterados.

## Fronteira de produto

| Funcionalidade | Estado anterior | Site | Exclusiva do app | Alteração |
| --- | --- | --- | --- | --- |
| Mercado e pesquisa | Demonstração com dois símbolos e preços indisponíveis | Catálogo público activo, pesquisa local por nome/símbolo, cotação datada | Histórico e análise avançada | `/mercado`; amostra na home |
| Detalhe | Screenshot do iOS | Tipo, emitente, moeda, ISIN quando disponível, referência e notícias relacionadas | Gráficos e ferramentas avançadas | `/mercado/[id]` |
| Notícias | Ausentes da landing page | Listagem paginada e leitura completa de artigos publicados | Personalização e notificações | `/noticias`, `/noticias/[slug]` |
| Favoritos | Demonstração com estado em memória | Convite contextual identificado «No app» | Confirmado em `Features/Watchlist` | Retirada a demonstração |
| Alertas | Sem consulta pública | Explicação contextual | Regras de preço e notificações confirmadas em `Features/Alerts` e `Features/Notifications` | Sem push web; sem promessa de tempo real |
| Comparação | Screenshot de comparação | Explicação e captura existente, datada | Confirmada no código de comparação e captura do iOS | Sem gráfico web |
| Carteira | Separador demonstrativo | Explicação contextual | Registos de posições confirmados em `Features/Portfolio` | Retirado o separador web |
| Conta/personalização/widgets | Sem conta web | Não implementado | Mantido no iOS | Sem novas contas web |
| Privacidade/contacto | `/policy`, `info@invest.ao` | Preservados | — | Texto factual da consulta web actualizado |
| Distribuição iOS | «Em breve», sem URL | Link oficial App Store Angola e QR centralizados | App para iPhone | Sem links fictícios |

Distribuição confirmada pela API Apple lookup em Angola: Invest.AO, bundle `ao.invest.iosapp`, versão 1.0, publicação em 22 de Setembro de 2026, site do vendedor `https://invest.ao`. [Ficha App Store Angola](https://apps.apple.com/ao/app/invest-ao/id6812907673). A ficha confirma mercado, histórico, comparação, favoritos e carteira. Alertas foram confirmados no código iOS disponível; não foi instalada a versão pública para confirmar paridade com esse código.

## Pesquisa e decisões

O Mobbin MCP está indisponível nesta sessão: não existe ferramenta Mobbin entre as ferramentas disponibilizadas, e a procura de «Mobbin» no catálogo de plugins devolveu zero resultados. Não foram consultados ecrãs ou fluxos Mobbin. Não há referências Mobbin inventadas.

As decisões seguintes são **propostas baseadas no projeto**, não conclusões de pesquisa externa:

| Base consultada | Problema | Princípio e adaptação | Limite |
| --- | --- | --- | --- |
| `app/landing.css`, documentação e screenshots existentes | Landing extensa antes de qualquer consulta | Manter Geist, marca e paleta; proposta curta seguida de cinco instrumentos reais | Retirar decoração orbital, gradientes e repetição de mockups |
| `Core/Market/MarketSecurity.swift`, `DataQuality.swift`, `MarketReferencePriceRow.swift` no iOS | Preço antigo confundido com cotação actual | Precedência de cotação elegível/referência/fecho; referência datada, sem variação inventada | Não recriar análise nem valorizações |
| `Features/AssetDetails/BondFactsSection.swift` | Obrigações formatadas como acções | Cotação percentual para obrigações; moeda por unidade para acções | Não inferir cupão, nominal ou rendibilidade |
| `Features/News/Data/NewsRepository.swift` e políticas editoriais do backend | Leitura bloqueada ou conteúdo não publicado | Artigos completos, data, fontes e relações existentes; convite apenas depois da leitura | Não criar CMS nem mostrar rascunhos |
| `Features/Watchlist`, `Alerts`, `Portfolio` e captura `asset-comparison.png` | Convites genéricos sem intenção | «Acompanhar», «Configurar alertas», «Comparar» e «Organizar carteira», identificados «No app» | Não simular essas funções na web |
| Navegação e componentes web existentes | Mobile sobrecarregado por marketing | Quatro links simples, listas sem cartões por instrumento, sem banner persistente | Não bloquear nem cobrir a consulta |

## Implementação

- Rotas `/` e `/policy` preservadas; novas rotas de mercado e notícias. Os antigos anchors de marketing têm destinos coerentes nos conteúdos novos.
- `PublicShell`, `MarketExplorer`, `MarketReading`, `NewsList` e `AppInvitation` partilham padrões realmente repetidos. Marca, fonte e screenshot existentes reutilizados.
- Tokens da paleta centralizados em `globals.css`; negativo `#FF6677` confirmado no sistema iOS. Setas, sinais e texto distinguem movimento sem depender exclusivamente da cor.
- `dialog` nativo aberto apenas por escolha explícita, sem prompts automáticos. Escape/fecho devolvem foco ao botão. Fechar não provoca novo pedido de instalação. Sem banner fixo.
- Estados de loading, falha com nova tentativa, lista vazia, pesquisa sem resultado, cotação indisponível, referência datada, mercado encerrado e notícia/instrumento não disponível.
- Metadados por instrumento e artigo, URLs canónicas e sitemap das páginas de entrada. As páginas de detalhe são descobertas pelas ligações públicas. Não são inventadas datas de modificação.

## Dados e acesso

`lib/public-data.ts` usa REST do backend existente, exclusivamente com uma chave `sb_publishable_` anónima. Não aceita service-role, não transporta sessões e não consulta tabelas pessoais ou endpoints editoriais. RLS existente é a fronteira de acesso. Notícias incluem filtros `status=published` e `published_at<=agora`; detalhes procuram o slug público.

Fontes: `securities` com emitente, `get_current_market_quotes`, `latest_verified_market_closes`, `issuers` e `news_articles` com fontes/relações existentes. O catálogo e os fechos são paginados para evitar o limite de linhas da API. Relações de notícias são obtidas no servidor; a listagem não descarrega corpos de artigos. O contrato editorial não contém imagem de capa nesta selecção; não foi criada uma.

Não foi copiada a janela de ontem/hoje do feed iOS: o site lê conteúdo publicado acessível pelas políticas actuais, para preservar URLs de leitura. Cada visita confirma a publicação novamente.

Leituras `no-store` no servidor, memoizadas por render com React `cache`, timeout de 10 segundos e actualização por navegação ou botão. Sem pipeline, realtime, polling ou atraso artificial. Conteúdo de mercado não fica num cache persistente com stale-while-revalidate. A validade financeira é reavaliada no servidor e o cliente retira a variação quando o prazo expira ou a página volta a ficar visível. Referências históricas continuam datadas. Estado do mercado vem do backend; não há horários inventados.

Markdown usa `react-markdown` no servidor, reutilizando a biblioteca já usada pelo portal editorial. HTML bruto é ignorado; protocolos de links seguem a transformação segura da biblioteca. QR usa `qrcode-generator` no servidor, sem serviço externo ou pedido adicional. Estas dependências não introduzem SDK financeiro ou analytics no browser.

## Distribuição e medição

Configuração em `.env.example`:

- `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`: necessárias no ambiente de alojamento. A verificação local usou a configuração pública já existente no iOS, num `.env.local` ignorado pelo Git.
- `IOS_DISTRIBUTION_URL`: destino oficial predefinido `https://apps.apple.com/ao/app/invest-ao/id6812907673`, confirmado via `https://itunes.apple.com/lookup?id=6812907673&country=ao`. Pode ser substituído por outro destino confirmado App Store ou TestFlight; um valor vazio/desconhecido mostra o estado pendente. TestFlight apresenta «Experimentar no TestFlight».

O destino oficial confirmado é usado por defeito. Se a configuração o desactivar ou fornecer URL inválida, o convite explica a pendência e permite continuar, sem QR nem saída falsa. Com destino válido: iPhone usa o link oficial; desktop apresenta QR do mesmo destino e link utilizável; outros dispositivos recebem explicação de disponibilidade para iPhone. Não se detecta instalação nem se promete preservar contexto após instalar. O iOS suporta rotas de widgets/esquema interno, mas não foi confirmado Universal Link público com fallback; «Abrir no app» não foi publicado.

O site não tinha analytics ou consentimento de analytics. O evento DOM `investao:analytics` é apenas um ponto local de integração, sem envio, cookies ou identificadores: `public_content_viewed`, `app_cta_viewed` (intersecção visível), `app_feature_prompt_opened`, `app_feature_prompt_dismissed`, `app_cta_clicked`, `app_qr_presented`. Propriedades: tipo de página, posição, funcionalidade e destino. Não incluem pesquisa, instrumento, conta ou carteira. Integrar um consumidor apenas após definir recolha/consentimento. Não existe atribuição de instalações; clique e QR não a demonstram. `app_open_requested` não é emitido porque não há abertura de app suportada publicada.

## Validação e limites

- Leitura anónima real: catálogo, quotes/referências, fechos e notícias publicados obtidos do backend. Não foram feitas escritas ou alterações de permissões.
- Quatro testes dirigidos passaram: `npm run test:market`, cobrindo zero vs ausência/expiração de variação, referência histórica vs cotação corrente, fonte inválida/futuro e unidades de acções/obrigações.
- ESLint e build de produção, incluindo TypeScript: passaram.
- Inspecção visual e funcional local: home, mercado, pesquisa sem resultados, instrumento, leitura, modais e teclado; larguras mobile 390px e 320px e desktop. Pesquisa sem resultados e consulta de obrigações confirmadas; nenhum scroll horizontal a 320px na leitura e detalhe. Escape devolveu foco ao botão; console sem erros nas páginas inspeccionadas. O QR apresentado foi descodificado da captura local com Vision e coincidiu com o link oficial Angola.
- Não se publicou em produção. Não se alterou o iOS, backend ou portal editorial.
- Não foi validada uma instalação real, paridade da versão pública com o código iOS actual, deep link/fallback pós-instalação ou recolha/atribuição de analytics. A disponibilidade pública foi confirmada na ficha e API Apple.
