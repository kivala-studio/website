# Site público invest.ao

A landing de demonstração foi substituída pela consulta pública de mercado e notícias. A estratégia, matriz site/app, fontes de domínio, configuração e limites estão em [WEB_TO_APP_FUNNEL.md](WEB_TO_APP_FUNNEL.md).

`app/page.tsx` apresenta proposta curta, amostra real de mercado, notícias e continuação contextual no iPhone. `app/globals.css` centraliza tokens e estilos partilhados. Screenshots existentes são identificados como capturas históricas. Os antigos ficheiros de layout/motion não são carregados pelas páginas públicas novas.

Verificação: `npm run lint`, `npm run test:market` e `npm run build`. Pré-visualização: `npm run dev` ou build seguido de `npm run start`.
