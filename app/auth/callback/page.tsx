"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "../../components/account-provider";
import { returnPath, needsOnboarding, signInPath } from "../../../lib/navigation";
import { PublicShell } from "../../public-shell";
import { authCallbackIssue, consumeAuthDestination, failedSignInPath } from "../../../lib/web-auth";
export default function Callback() {
  const { client, user, loading } = useAccount();
  const router = useRouter();
  const params = useSearchParams();
  const next = returnPath(params.get("next"));
  const destination = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    let active = true;
    void (async () => {
      // The SDK owns PKCE URL detection/exchange. Reuse its initialization
      // result; a second exchange would consume the one-time code again.
      const result = client ? await client.auth.initialize() : null;
      if (!active) return;
      const target = destination.current ??= consumeAuthDestination(next);
      if (user) {
        router.replace(needsOnboarding(user) ? `/conta?next=${encodeURIComponent(target)}` : target);
      } else {
        router.replace(failedSignInPath(target, authCallbackIssue(window.location.href, result?.error)));
      }
    })();
    return () => { active = false; };
  }, [client, user, loading, router, next]);
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
        <Link className="primary-button" href={signInPath(next || "/dashboard")}>
          Voltar à conta
        </Link>
      </section>
    </PublicShell>
  );
}
