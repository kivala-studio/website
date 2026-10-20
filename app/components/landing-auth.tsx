"use client";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "./account-provider";
import { needsOnboarding, returnPath } from "../../lib/navigation";
import AccountPanel from "../conta/panel";
import Icon from "./invest-icon";
import { useCookieConsent } from "./cookie-consent";

export default function LandingAuth() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAccount();
  const { ready, promptOpen } = useCookieConsent();
  const dialog = useRef<HTMLDialogElement>(null);
  const requested = params.get("entrar") === "1";
  const next = returnPath(params.get("next")) || "/dashboard";
  const query = params.toString();

  function close() {
    const remaining = new URLSearchParams(query);
    remaining.delete("entrar");
    remaining.delete("next");
    remaining.delete("auth_error");
    dialog.current?.close();
    window.history.replaceState(null, "", remaining.size ? `/?${remaining}` : "/");
  }

  useEffect(() => {
    if (!requested || !user) return;
    router.replace(needsOnboarding(user) ? `/conta?next=${encodeURIComponent(next)}` : next);
  }, [requested, user, next, router]);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal || !requested || user || !ready || promptOpen) return;
    const previousOverflow = document.body.style.overflow;
    modal.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      modal.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [requested, user, ready, promptOpen]);

  return (
    <dialog
      ref={dialog}
      className="landing-auth"
      aria-label="Entrar na invest.ao"
      onCancel={(event) => { event.preventDefault(); close(); }}
    >
      <header className="landing-auth-header">
        <button type="button" onClick={close} aria-label="Fechar início de sessão"><Icon name="close" /></button>
      </header>
      {user ? <p role="status">A abrir a tua conta…</p> : <AccountPanel securities={[]} />}
    </dialog>
  );
}
