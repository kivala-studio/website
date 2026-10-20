// Implementation gaps only. Empty data, privacy/consent and transient failures
// remain separate states in their owning features. Remove entries as they ship.
export const webFeatureStatus = {
  webPush: {
    title: "Notificações no navegador",
    description: "As notificações fora do site ainda estão em desenvolvimento. Podes gerir os alertas e consultar os acontecimentos na Actividade.",
    href: "/actividade",
    action: "Consultar actividade",
  },
  weekAhead: {
    title: "A tua semana à frente",
    description: "A seleção personalizada dos próximos acontecimentos está em desenvolvimento. As sessões de mercado e as datas publicadas continuam disponíveis na Agenda.",
    href: "/agenda",
    action: "Consultar agenda",
  },
  saturdayDiscovery: {
    title: "Descobertas de sábado",
    description: "A seleção de conteúdos de sábado adaptada aos teus interesses ainda está em desenvolvimento.",
    href: "/noticias",
    action: "Ler notícias",
  },
  richerSummaries: {
    title: "Mais histórias nos resumos",
    description: "Novos tipos de histórias, a sua seleção personalizada e a receção de edições corrigidas estão em desenvolvimento. Os resumos já disponíveis podem continuar a ser consultados.",
    href: "/resumos",
    action: "Consultar resumos disponíveis",
  },
  multiComparison: {
    title: "Comparar mais de dois instrumentos",
    description: "A comparação de mais de dois instrumentos no mesmo gráfico está em desenvolvimento. Podes comparar dois instrumentos com as opções atuais.",
    href: "/comparar",
    action: "Comparar dois instrumentos",
  },
  appleDeletion: {
    title: "Eliminar uma conta Apple na web",
    description: "Esta opção ainda não está disponível na web. Podes eliminar a conta na app iOS ou contactar info@invest.ao para obter ajuda.",
    href: "mailto:info@invest.ao",
    action: "Contactar apoio",
  },
} as const;

export type WebFeature = keyof typeof webFeatureStatus;
