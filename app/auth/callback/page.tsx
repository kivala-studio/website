"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "../../components/account-provider";
import { returnPath, needsOnboarding } from "../../../lib/navigation";
import { PublicShell } from "../../public-shell";
export default function Callback() {
  const { client, user, loading } = useAccount();
  const router = useRouter();
  const params = useSearchParams();
  const next = returnPath(params.get("next"));
  useEffect(() => {
    if (user)
      router.replace(
        !needsOnboarding(user) && next
          ? next
          : `/conta${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      );
  }, [user, router, next]);
  const failed = !loading && !user;
  return (
    <PublicShell>
      <section className="account-gate">
        <h1>
          {failed || !client ? "Acesso por confirmar" : "A confirmar o acesso…"}
        </h1>
        <p>
          {failed
            ? "A ligação pode ter expirado ou ter sido aberta noutro navegador. Solicita um novo acesso."
            : "A recuperar a tua conta."}
        </p>
        <Link className="primary-button" href="/conta">
          Voltar à conta
        </Link>
      </section>
    </PublicShell>
  );
}
