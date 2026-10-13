import Link from "next/link";
import { PublicShell } from "./public-shell";
export default function NotFound() {
  return (
    <PublicShell>
      <div className="page-heading">
        <h1>Não disponível.</h1>
        <p>
          Este instrumento ou notícia já não está disponível para consulta
          pública.
        </p>
        <Link className="text-link" href="/mercado">
          Consultar mercado →
        </Link>
        <Link className="text-link" href="/noticias">
          Ler notícias →
        </Link>
      </div>
    </PublicShell>
  );
}
