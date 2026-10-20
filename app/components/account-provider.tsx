"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { browserClient, type PublicConfig } from "../../lib/browser-client";

type Account = {
  config: PublicConfig;
  client: SupabaseClient | null;
  user: User | null;
  loading: boolean;
  appearance: string;
  setAppearance: (value: string) => void;
  privateMode: boolean;
  setPrivateMode: (value: boolean) => void;
};
const Context = createContext<Account>({
  config: null,
  client: null,
  user: null,
  loading: true,
  appearance: "system",
  setAppearance: () => {},
  privateMode: true,
  setPrivateMode: () => {},
});
export const useAccount = () => useContext(Context);
export function AccountProvider({
  config,
  children,
}: {
  config: PublicConfig;
  children: React.ReactNode;
}) {
  const client = useMemo(() => browserClient(config), [config]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!client);
  const [privateMode, setPrivacy] = useState(false);
  const [appearance, setTheme] = useState("system");
  function setPrivateMode(value: boolean) {
    setPrivacy(value);
    try {
      localStorage.setItem("investao.privacy", String(value));
    } catch {}
  }
  function setAppearance(value: string) {
    if (!["system", "dark", "light"].includes(value)) return;
    setTheme(value);
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("investao.appearance", value);
    } catch {
      /* Storage may be unavailable. */
    }
  }
  useEffect(() => {
    function syncAppearance(value: string | null) {
      const theme =
        value && ["system", "dark", "light"].includes(value) ? value : "system";
      setTheme(theme);
      document.documentElement.dataset.theme = theme;
    }
    const storage = (event: StorageEvent) => {
      if (event.key === "investao.appearance" || event.key === null) {
        syncAppearance(event.key === null ? null : event.newValue);
      }
    };
    window.addEventListener("storage", storage);
    void Promise.resolve().then(() => {
      try {
        setPrivacy(localStorage.getItem("investao.privacy") === "true");
        const saved = localStorage.getItem("investao.appearance");
        syncAppearance(saved);
      } catch {
        /* System appearance remains active. */
      }
    });
    return () => window.removeEventListener("storage", storage);
  }, []);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    let generation = 0;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      generation++;
      if (alive) {
        setUser(
          session?.user && !session.user.is_anonymous ? session.user : null,
        );
        setLoading(false);
      }
    });
    const initial = generation;
    void client.auth
      .getUser()
      .then(({ data }) => {
        if (alive && generation === initial) {
          setUser(data.user && !data.user.is_anonymous ? data.user : null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [client]);
  return (
    <Context.Provider
      value={{
        config,
        client,
        user,
        loading,
        appearance,
        setAppearance,
        privateMode,
        setPrivateMode,
      }}
    >
      {children}
    </Context.Provider>
  );
}
