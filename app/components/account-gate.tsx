"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Icon from "./invest-icon";
import { signInPath } from "../../lib/navigation";
import { useAccount } from "./account-provider";
export default function AccountGate({
  children,
  feature,
}: {
  children: React.ReactNode;
  feature: string;
}) {
  const path = usePathname();
  const { user, loading, client } = useAccount();
  if (loading)
    return (
      <p className="empty-state" role="status">
        A recuperar a tua sessão…
      </p>
    );
  if (!user)
    return (
      <section className="account-gate">
        <span className="gate-symbol">
          <Icon name="portfolio" size={42} />
        </span>
        <p className="eyebrow">A TUA CONTA INVEST.AO</p>
        <h2>{feature}, em qualquer ecrã.</h2>
        <p>
          Entra com a mesma conta que usas no iPhone. A tua lista, carteira e
          alertas acompanham-te.
        </p>
        <Link className="primary-button" href={signInPath(path)}>
          Entrar ou criar conta
        </Link>
        {!client && (
          <p role="status">
            O acesso à conta está temporariamente indisponível.
          </p>
        )}
      </section>
    );
  // Account changes unmount every private view, preventing the previous user's data from remaining visible.
  return <div key={user.id}>{children}</div>;
}
