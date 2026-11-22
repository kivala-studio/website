"use client";

import { useTranslations } from "next-intl";
import { type MouseEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import {
  NO_PLUS_PROMPT_DISMISSAL,
  type PlusPrompt as Prompt,
  decodePlusPromptDismissal,
  dismissPlusPrompt,
  encodePlusPromptDismissal,
  plusPrompt,
  plusPromptCandidate,
} from "@/domain/billing/plus-prompt";
import type { WebPlan } from "@/domain/billing/web-pass";
import { useAccount } from "@/features/account/account-provider";
import { ACCOUNT_STORAGE_PREFIX } from "@/features/auth/account-state";
import { passEndDate } from "@/features/billing/plan-status";
import { readPlansPage } from "@/features/billing/repository";
import { ButtonLink, IconButton } from "@/ui/components/buttons";
import { Card } from "@/ui/components/layout";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";
import { usePresence } from "@/ui/motion/use-presence";

/** Per account, in this browser; cleared at sign-out with the account's other keys. Holds no date or amount. */
const storageKey = (userID: string) => `${ACCOUNT_STORAGE_PREFIX}${userID}.plusPrompt`;

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Another tab's dismissal applies here too. */
function subscribeStorage(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

/** Unknown on the server and until hydration: nothing shows before the browser's dismissal is read. */
const UNREAD = () => undefined;

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Home's Plus prompt: the offer (limits apply, no Plus) or a reminder that prepaid Plus ends within 7 days, linking
 * to `/planos`, only while passes are on sale. The plans are read once per page view, and only when the access
 * document already allows a prompt; a failed read shows nothing.
 */
export function PlusPrompt() {
  const t = useTranslations();
  const format = useFormat();
  const account = useAccount();
  const userID = account?.userID ?? "";
  const access = account?.access ?? null;
  const key = storageKey(userID);
  const stored = useSyncExternalStore(subscribeStorage, () => (userID ? readStored(key) : undefined), UNREAD);
  const dismissal = stored === undefined ? null : decodePlusPromptDismissal(stored);
  const [now] = useState(() => Date.now());
  const [loaded, setLoaded] = useState<{ userID: string; plans: readonly WebPlan[] } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // A result is applied only while the page still belongs to the account that asked (standing rule 9).
  const current = useRef(userID);
  useEffect(() => {
    current.current = userID;
  }, [userID]);

  const possible = !dismissed && plusPromptCandidate(access, now, dismissal) !== null;
  const requested = useRef<string | null>(null);
  useEffect(() => {
    if (!possible || !userID || requested.current === userID) return;
    requested.current = userID;
    const asked = userID;
    readPlansPage(asked).then(
      (page) => {
        if (current.current === asked) setLoaded({ userID: asked, plans: page.plans });
      },
      () => {},
    );
  }, [possible, userID]);

  const plans = loaded?.userID === userID ? loaded.plans : null;
  const prompt = dismissed ? null : plusPrompt(access, plans, now, dismissal);
  const until = prompt === "renew" ? access?.plusUntil ?? null : null;

  // What the card says stays through its exit.
  const [shown, setShown] = useState<{ prompt: Prompt; until: string | null } | null>(null);
  if (prompt && (shown?.prompt !== prompt || shown.until !== until)) setShown({ prompt, until });
  const presence = usePresence(prompt !== null);
  const lineID = useId();

  if (!presence.mounted || !shown) return null;

  const dismiss = (event: MouseEvent<HTMLButtonElement>) => {
    if (!prompt || !access) return;
    // Keyboard focus carries on to what follows the card instead of falling back to the top of the page.
    const card = event.currentTarget.closest<HTMLElement>("[data-testid=plus-prompt]");
    if (card?.contains(document.activeElement)) {
      [...document.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .find((element) => !card.contains(element) && card.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
        ?.focus();
    }
    setDismissed(true);
    try {
      window.localStorage.setItem(key, encodePlusPromptDismissal(dismissPlusPrompt(dismissal ?? NO_PLUS_PROMPT_DISMISSAL, prompt, access, Date.now())));
    } catch {
      // Gone for this page view only.
    }
  };

  const renew = shown.prompt === "renew";
  return (
    <Card
      flush
      role="region"
      aria-labelledby={lineID}
      {...presence.presenceProps}
      className="motion-pop flex items-start gap-3 px-5 py-4 sm:items-center sm:gap-4 desk:px-6"
      data-testid="plus-prompt"
      data-variant={shown.prompt}
    >
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon name={renew ? "calendar" : "wallet"} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3 max-sm:pt-2 sm:flex-row sm:items-center sm:gap-4">
        <p id={lineID} className="min-w-0 flex-1 text-body text-primary-text">
          {renew && shown.until ? t("site.plans.renewPrompt", { date: passEndDate(shown.until, format) }) : t("site.plans.offerPrompt")}
        </p>
        <ButtonLink href="/planos" kind="secondary" size="compact" className="shrink-0">
          {t(renew ? "site.plans.addTime" : "site.plans.seePlans")}
        </ButtonLink>
      </div>
      <IconButton icon="close" variant="plain" label={t("components.toast.dismiss")} onClick={dismiss} className="-my-1 -mr-2 shrink-0 sm:-my-2" />
    </Card>
  );
}
