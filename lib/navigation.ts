export function returnPath(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return null;
  const url = new URL(value, "https://invest.ao");
  if (
    url.origin !== "https://invest.ao" ||
    !/^\/(?:dashboard|mercado|carteira|lista|alertas|actividade|resumos|simular|comparar|pesquisa|agenda|noticias|planos)(?:\/|$)/.test(
      url.pathname,
    )
  )
    return null;
  return `${url.pathname}${url.search}`;
}

export function signInPath(next: string) {
  return `/?entrar=1&next=${encodeURIComponent(returnPath(next) || "/dashboard")}`;
}

export function needsOnboarding(user: {
  created_at: string;
  user_metadata: Record<string, unknown>;
}) {
  if (user.user_metadata.investao_onboarding_completed === true) return false;
  return (
    user.user_metadata.investao_onboarding_completed === false ||
    Date.parse(user.created_at) >= Date.parse("2026-10-18T00:00:00Z")
  );
}
