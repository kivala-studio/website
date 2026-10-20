"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { readCookieChoice, saveCookieChoice, subscribeCookieChoice, type CookieChoice } from "../../lib/cookie-consent";

const Context = createContext({ ready: false, promptOpen: false, optional: false, openPreferences: () => {} });
export const useCookieConsent = () => useContext(Context);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const choice = useSyncExternalStore(subscribeCookieChoice, readCookieChoice, () => null);
  const [ready, setReady] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setReady(true);
      if (!readCookieChoice()) setPromptOpen(true);
    });
  }, []);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal || !promptOpen) return;
    modal.showModal();
    return () => modal.close();
  }, [promptOpen]);

  function choose(value: CookieChoice) {
    saveCookieChoice(value);
    setPromptOpen(false);
  }

  return (
    <Context.Provider value={{ ready, promptOpen, optional: choice === "all", openPreferences: () => setPromptOpen(true) }}>
      {children}
      <dialog ref={dialog} className="cookie-consent" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description" onCancel={() => setPromptOpen(false)}>
        <div>
          <h2 id="cookie-consent-title">A tua escolha de privacidade</h2>
          <p id="cookie-consent-description">Usamos cookies e armazenamento essenciais para o acesso e a segurança. Com a tua autorização, guardamos também a tua atividade para personalizar o conteúdo. Podes rejeitar os opcionais e continuar a usar o site.</p>
          <Link href="/cookies" onClick={() => setPromptOpen(false)}>Ler a política de cookies</Link>
        </div>
        <div className="cookie-consent-actions">
          <button type="button" onClick={() => choose("essential")}>Rejeitar opcionais</button>
          <button type="button" onClick={() => choose("all")}>Aceitar todos</button>
        </div>
      </dialog>
    </Context.Provider>
  );
}

export function CookiePreferencesButton() {
  const { openPreferences } = useCookieConsent();
  return <button type="button" className="cookie-preferences-button" onClick={openPreferences}>Gerir preferências de cookies</button>;
}
