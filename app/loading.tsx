"use client";
import { usePathname } from "next/navigation";
import { PublicShell } from "./public-shell";
import { PageLoading, type LoadingVariant } from "./components/loading-placeholders";
import { isPublicBrowsePath } from "../lib/public-routes";

export default function Loading() {
  const path = usePathname();
  const variant: LoadingVariant = path.startsWith("/mercado/") ? "asset"
    : path === "/mercado" ? "market"
    : path.startsWith("/noticias/") ? "article"
    : path === "/noticias" ? "news"
    : path === "/planos" ? "plans"
    : path === "/pesquisa" ? "search" : "home";
  const skeleton = <PageLoading variant={variant} />;
  return isPublicBrowsePath(path)
    ? <PublicShell>{skeleton}</PublicShell>
    : <div className="container">{skeleton}</div>;
}
