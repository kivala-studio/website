"use client";
import { useCallback } from "react";
import { ledger, watchlist } from "../../lib/account-data";
import { positions } from "../../lib/finance";
import { ResourceState, useResource } from "./async-state";
import Link from "next/link";
import { useAccount } from "./account-provider";
import Icon from "./invest-icon";
export default function HomeAccount() {
  const { user } = useAccount();
  return (
    <section className="home-account">
      <Icon name="portfolio" size={30} />
      <p className="eyebrow">A TUA INVEST.AO</p>
      <h2>
        {user
          ? `O teu mercado, ${String(user.user_metadata.investao_display_name || user.user_metadata.full_name || "aqui").split(" ")[0]}.`
          : "Os teus investimentos.\nO teu espaço."}
      </h2>
      <p>
        {user
          ? "A tua lista, carteira e alertas estão aqui, ligados à mesma conta que usas na app."
          : "Entra na tua conta e continua de onde ficaste. Na app, no computador, onde estiveres."}
      </p>
      <Link href={user ? "/carteira" : "/conta"} className="primary-button">
        {user ? "Ver a minha carteira" : "Entrar na minha conta"}
      </Link>
      {user && <AccountOverview key={user.id} />}
      <div className="home-account-links">
        <Link href="/lista">
          <Icon name="watchlist" />A minha lista
          <Icon name="chevron-right" size={14} />
        </Link>
        <Link href="/alertas">
          <Icon name="alert" />
          Os meus alertas
          <Icon name="chevron-right" size={14} />
        </Link>
      </div>
    </section>
  );
}

function AccountOverview() {
  const { client, user, privateMode } = useAccount();
  const load = useCallback(async () => {
    const [transactions, watches] = await Promise.all([
      ledger(client!),
      watchlist(client!, user!.id),
    ]);
    return {
      holdings: positions(transactions).filter((p) => p.quantity.gt(0)).length,
      watches: watches.length,
    };
  }, [client, user]);
  const state = useResource(load);
  return (
    <>
      <ResourceState {...state} retry={state.reload} />
      {state.data && (
        <div className="account-summary">
          <Link href="/carteira">
            <strong>{privateMode ? "••" : state.data.holdings}</strong>
            <span>Posições</span>
          </Link>
          <Link href="/lista">
            <strong>{state.data.watches}</strong>
            <span>Na tua lista</span>
          </Link>
        </div>
      )}
    </>
  );
}
