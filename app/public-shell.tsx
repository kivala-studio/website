import Image from "next/image";
import Link from "next/link";
import WorkspaceShell from "./components/workspace-shell";
export function Brand() {
  return (
    <span className="brand">
      <Image src="/investao-logo.svg" width={32} height={32} alt="" />
      <span>
        invest<span className="brand-dot">.</span>ao
      </span>
    </span>
  );
}
export function PublicShell({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
export function FeatureInvitation({
  feature = "discover",
  compact = false,
}: {
  feature?: "discover" | "watchlist" | "alerts" | "compare" | "portfolio";
  position: string;
  compact?: boolean;
}) {
  const content = {
    discover: [
      "O teu mercado começa aqui.",
      "Entra na tua conta para acompanhar os teus investimentos.",
      "A minha conta",
      "/conta",
    ],
    watchlist: [
      "Fica a acompanhar.",
      "Guarda os instrumentos que queres seguir e recebe os seus movimentos.",
      "A minha lista",
      "/lista",
    ],
    alerts: [
      "Escolhe o que merece a tua atenção.",
      "Define um preço ou uma variação para os instrumentos que acompanhas.",
      "Gerir alertas",
      "/alertas",
    ],
    compare: [
      "Põe o percurso em perspectiva.",
      "Compara dois instrumentos no mesmo período.",
      "Comparar instrumentos",
      "/comparar",
    ],
    portfolio: [
      "Os teus investimentos, com contexto.",
      "Regista as tuas operações e acompanha as posições.",
      "A minha carteira",
      "/carteira",
    ],
  }[feature];
  return (
    <aside className={`web-invitation ${compact ? "compact" : ""}`}>
      <div>
        <h2>{content[0]}</h2>
        <p>{content[1]}</p>
      </div>
      <Link className="secondary-button" href={content[3]}>
        {content[2]}
      </Link>
    </aside>
  );
}
