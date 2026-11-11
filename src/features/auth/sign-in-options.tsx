"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";

import { cn } from "@/ui/cn";
import { Spinner } from "@/ui/components/states";

import { AppleMark, GoogleMark } from "./provider-marks";

type Provider = "google" | "apple";

const BUTTON =
  "motion-press inline-flex w-full min-h-14 items-center justify-center gap-3 rounded-full px-5 py-4 text-body font-semibold aria-disabled:opacity-42";

/** Provider error codes that mean the person closed or declined the sign-in (iOS treats these as silent). */
const CANCELLED = /^(access_denied|user_cancelled_authorize|user_cancelled_login)$/;

/**
 * Google and Apple buttons. Each is a link to `/auth/sign-in`, which leaves for the provider; while it loads the
 * progress row shows and the other button is inert. Coming back with the browser's back button restores them.
 * A failure the provider reports in the URL fragment shows as the sign-in error; a cancellation is silent.
 */
export function SignInOptions({ next, available, failed: initiallyFailed }: { next: string; available: boolean; failed: boolean }) {
  const t = useTranslations();
  const [working, setWorking] = useState<Provider | null>(null);
  const [failed, setFailed] = useState(initiallyFailed);

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setWorking(null);
    };
    window.addEventListener("pageshow", restore);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const error = hash.get("error_code") ?? hash.get("error");
    if (error) {
      // The fragment is never sent to a server; drop it so a reload does not repeat the message.
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      // A one-off read of the URL on arrival: it is not render state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!CANCELLED.test(error)) setFailed(true);
    }
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  const href = (provider: Provider) => `/auth/sign-in?${new URLSearchParams({ provider, next })}`;
  const options: { provider: Provider; label: string; className: string; mark: ReactNode }[] = [
    {
      provider: "google",
      label: t("authentication.signIn.google"),
      className: "bg-action-surface text-primary-text border-[length:var(--control-outline-width)] border-control-outline",
      mark: <GoogleMark />,
    },
    { provider: "apple", label: t("authentication.signIn.apple"), className: "bg-primary-text text-app-background", mark: <AppleMark /> },
  ];

  return (
    <div className="flex flex-col gap-3">
      {failed ? (
        <p role="alert" className="text-secondary font-semibold text-negative">
          {t("errors.account.signInFailed")}
        </p>
      ) : null}
      {options.map(({ provider, label, className, mark }) =>
        available ? (
          <a
            key={provider}
            href={href(provider)}
            rel="nofollow"
            aria-disabled={working !== null || undefined}
            onClick={(event) => {
              if (working) return event.preventDefault();
              setFailed(false);
              setWorking(provider);
            }}
            className={cn(BUTTON, className)}
          >
            {mark}
            <span>{label}</span>
          </a>
        ) : (
          <button key={provider} type="button" disabled className={cn(BUTTON, className, "disabled:opacity-42")}>
            {mark}
            <span>{label}</span>
          </button>
        ),
      )}
      <p role="status" className={cn("flex min-h-6 items-center justify-center gap-2 text-secondary text-secondary-text", !working && "invisible")}>
        {working ? (
          <>
            <Spinner />
            {t("authentication.signIn.progress")}
          </>
        ) : null}
      </p>
    </div>
  );
}
