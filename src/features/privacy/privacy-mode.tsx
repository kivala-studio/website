"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

import { parsePrivacyMode, privacyCookie, PRIVACY_COOKIE } from "@/domain/privacy/privacy";
import { Button, IconButton } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";

import { PrivacyModeStore } from "./privacy-store";

const Context = createContext<PrivacyModeStore | null>(null);
/** Tabs of this browser tell each other, so every open page hides or shows at once. */
const CHANNEL = "investao-privacy";
/** The explanation shows once per browser, the first time values are hidden. */
const EXPLAINED_KEY = "investao.privacy.explained";
const NO_SUBSCRIPTION = () => () => {};

function readCookie(): boolean {
  const entry = document.cookie.split("; ").find((part) => part.startsWith(`${PRIVACY_COOKIE}=`));
  return parsePrivacyMode(entry?.slice(PRIVACY_COOKIE.length + 1));
}

/** One store per signed-in tab, seeded from the cookie the server read. */
export function PrivacyModeProvider({ initial, children }: { initial: boolean; children: ReactNode }) {
  const [store] = useState(() => {
    let channel: BroadcastChannel | null = null;
    const persist = (enabled: boolean) => {
      document.cookie = privacyCookie(enabled, window.location.protocol === "https:");
      channel?.postMessage(enabled);
    };
    const created = new PrivacyModeStore(initial, persist);
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (event) => created.set(event.data === true, { persist: false });
    }
    return created;
  });
  // A tab restored from the back-forward cache may hold an older value.
  useEffect(() => {
    const sync = () => store.set(readCookie(), { persist: false });
    window.addEventListener("pageshow", sync);
    return () => window.removeEventListener("pageshow", sync);
  }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

/** Whether personal values are hidden in this browser. Outside the signed-in app it is always off. */
export function usePrivacyMode(): boolean {
  const store = useContext(Context);
  return useSyncExternalStore(store?.subscribe ?? NO_SUBSCRIPTION, () => store?.getSnapshot() ?? false, () => store?.getSnapshot() ?? false);
}

function explainedBefore(): boolean {
  try {
    return window.localStorage.getItem(EXPLAINED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberExplained(): void {
  try {
    window.localStorage.setItem(EXPLAINED_KEY, "1");
  } catch {
    // Without storage the explanation shows again next time; nothing else depends on it.
  }
}

/**
 * The eye button (iOS `PrivacyModeButton`): hides or shows personal values everywhere in this browser. The first
 * time it hides them it explains what changes; screen readers hear the new state.
 */
export function PrivacyModeButton({ className }: { className?: string }) {
  const t = useTranslations("components.privacy");
  const common = useTranslations("common");
  const store = useContext(Context);
  const enabled = usePrivacyMode();
  const [explaining, setExplaining] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  if (!store) return null;

  const toggle = () => {
    const next = !enabled;
    store.set(next);
    setAnnouncement(t(next ? "enabledAnnouncement" : "disabledAnnouncement"));
    if (next && !explainedBefore()) {
      rememberExplained();
      setExplaining(true);
    }
  };

  return (
    <>
      <IconButton
        icon={enabled ? "eye-off" : "eye"}
        label={t(enabled ? "showValues" : "hideValues")}
        onClick={toggle}
        className={className}
        data-testid="privacy-mode"
      />
      <span role="status" className="sr-only">
        {announcement}
      </span>
      {explaining ? (
        <Dialog
          variant="dialog"
          open
          onClose={() => setExplaining(false)}
          title={common("hiddenValues")}
          footer={
            <Button className="w-full" onClick={() => setExplaining(false)} data-autofocus>
              {t("gotIt")}
            </Button>
          }
        >
          <p className="text-body text-primary-text">{`${t("explanationIntro")}${t("explanationDetail")}`}</p>
        </Dialog>
      ) : null}
    </>
  );
}
