"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { AccountSetupFlow, SetupPersistence, type SetupState, emptyDraft } from "@/domain/account-setup/flow";
import { type PickerInstrument, pickerCategories, pickerResults } from "@/domain/account-setup/picker";
import { AppError, CancellationError } from "@/domain/errors";
import { MARKET_CATEGORY_LABEL_KEYS } from "@/domain/market";
import { reauthenticate } from "@/features/auth/reauthenticate";
import { SignOutForm } from "@/features/auth/sign-out-form";
import { cn } from "@/ui/cn";
import { Button, IconButton } from "@/ui/components/buttons";
import { SearchField } from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { SecurityLogo } from "@/ui/components/rows";
import { EmptyState, ErrorState } from "@/ui/components/states";
import { Icon } from "@/ui/icons/icon";

import { type SetupResult, completeSetup, saveSetupName, saveSetupWatchlist } from "./actions";

const localStore = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const SEARCH_DELAY_MS = 250;

type Props = {
  userID: string;
  initialName: string | null;
  /** The public catalogue; null when it could not be read. */
  instruments: PickerInstrument[] | null;
  watchedIDs: string[];
};

/**
 * Post-login account setup (iOS `PostLoginOnboardingView`): an optional name, then the first watchlist. The
 * draft lives in this browser per account, so a reload or a later sign-in resumes the same step.
 */
export function AccountSetup({ userID, initialName, instruments, watchedIDs }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [flow] = useState(() => new AccountSetupFlow(userID, initialName, new SetupPersistence(localStore())));
  // Server HTML has no stored draft; React renders this first, then the stored draft, without a mismatch.
  const [serverState] = useState<SetupState>(() => ({
    draft: emptyDraft(initialName ?? ""),
    isWorking: false,
    isCompleted: false,
    errorKey: null,
    hasWatchlistFailure: false,
  }));
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, () => serverState);
  const { draft, isWorking, errorKey, hasWatchlistFailure, isCompleted } = state;
  const current = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const firstName = useRef(initialName);

  useEffect(() => {
    if (firstName.current === initialName) return;
    firstName.current = initialName;
    flow.refreshInitialName(initialName);
  }, [flow, initialName]);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const step = useRef(draft.step);
  useEffect(() => {
    if (step.current === draft.step) return;
    step.current = draft.step;
    heading.current?.focus();
  }, [draft.step]);

  // The server reads the completion from the refreshed session and renders the app in place of setup.
  useEffect(() => {
    if (isCompleted) router.refresh();
  }, [isCompleted, router]);

  async function unwrap<T>(pending: Promise<SetupResult<T>>): Promise<T> {
    const result = await pending;
    if (result.status === "ok") return result.value;
    if (result.status === "stale") {
      // Another account is signed in now: nothing of this one may advance.
      current.current = false;
      router.refresh();
      throw new CancellationError();
    }
    const error = new AppError(result.error.category, { operation: "onboarding.save", httpStatus: result.error.httpStatus, rule: result.error.rule });
    if (error.requiresAuthentication) reauthenticate();
    throw error;
  }

  const isCurrent = () => current.current;
  const advanceName = (skip: boolean) => flow.advanceName(skip, isCurrent, async (name) => void (await unwrap(saveSetupName(userID, name))));
  const finish = (skip: boolean) =>
    flow.finish(
      skip,
      isCurrent,
      async (ids) => {
        try {
          return await unwrap(saveSetupWatchlist(userID, [...ids]));
        } catch {
          return [];
        }
      },
      async () => void (await unwrap(completeSetup(userID, flow.draft.skippedName))),
    );

  const watched = useMemo(() => new Set(watchedIDs), [watchedIDs]);
  const categories = useMemo(() => (instruments ? pickerCategories(instruments) : []), [instruments]);
  const results = useMemo(
    () => (instruments ? pickerResults(instruments, appliedSearch, categories.includes(draft.category) ? draft.category : "all") : []),
    [instruments, appliedSearch, categories, draft.category],
  );

  const onName = draft.step === "name";
  const selected = draft.selectedIDs.length;
  const primaryTitle = onName
    ? t("common.continue")
    : hasWatchlistFailure
      ? t("common.tryAgain")
      : selected === 0
        ? t("common.continue")
        : t("onboarding.button.addAndContinue");
  const secondaryTitle = onName
    ? t("onboarding.button.notNow")
    : hasWatchlistFailure
      ? t("onboarding.button.continueWithoutRest")
      : t("onboarding.button.doLater");

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 sm:px-6">
      <header className="flex items-center gap-3 py-2">
        {onName ? (
          <IconButton icon="close" label={t("common.signOut")} disabled={isWorking} onClick={() => setConfirmingSignOut(true)} className="bg-transparent" />
        ) : (
          <IconButton icon="arrow-left" label={t("onboarding.accessibility.backToName")} disabled={isWorking} onClick={() => flow.back()} className="bg-transparent" />
        )}
        <span className="flex-1" />
        <span aria-hidden className="flex gap-2">
          {[0, 1].map((index) => (
            <span key={index} className={cn("h-1 w-6 rounded-full", index === (onName ? 0 : 1) ? "bg-accent" : "bg-separator")} />
          ))}
        </span>
        <span className="text-caption text-secondary-text">
          <span aria-hidden>{t(onName ? "onboarding.step.progressFirst" : "onboarding.step.progressSecond")}</span>
          <span className="sr-only">{t(onName ? "onboarding.accessibility.stepName" : "onboarding.accessibility.stepWatchlist")}</span>
        </span>
      </header>

      <form
        className="flex flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void (onName ? advanceName(false) : finish(false));
        }}
      >
        <div className="flex flex-1 flex-col gap-6 pt-8 pb-6">
          <h1 ref={heading} tabIndex={-1} className="text-display text-primary-text outline-none">
            {t(onName ? "onboarding.step.nameTitle" : "onboarding.step.watchlistTitle")}
          </h1>
          {onName ? (
            <label className="flex flex-col gap-2 text-secondary font-semibold text-primary-text">
              {t("common.name")}
              <input
                value={draft.name}
                onChange={(event) => flow.editName(event.target.value)}
                placeholder={t("onboarding.form.nameField")}
                autoComplete="name"
                autoCapitalize="words"
                spellCheck={false}
                disabled={isWorking}
                data-testid="setup-name"
                className="min-h-14 rounded-medium border border-control-outline bg-elevated-background px-4 text-body font-normal focus:border-accent"
              />
            </label>
          ) : instruments === null ? (
            <ErrorState
              message={t("onboarding.error.loadInstruments")}
              action={
                <Button kind="secondary" onClick={() => router.refresh()} className="sm:w-auto">
                  {t("common.tryAgain")}
                </Button>
              }
            />
          ) : instruments.length === 0 ? (
            <EmptyState title={t("onboarding.emptyState.noInstrumentsTitle")} message={t("onboarding.emptyState.noInstrumentsMessage")} icon="watchlist" />
          ) : (
            <div className="flex flex-col gap-4">
              <SearchField value={search} onChange={setSearch} placeholder={t("common.searchInstruments")} />
              <div role="group" aria-label={t("news.information.categoryLabel")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {categories.map((category) => {
                  const chosen = category === draft.category;
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={chosen}
                      disabled={isWorking}
                      onClick={() => flow.update({ category })}
                      className={cn(
                        "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-secondary font-medium",
                        chosen ? "bg-accent text-on-accent" : "bg-elevated-background text-primary-text",
                      )}
                    >
                      {chosen ? <Icon name="check" scale="s" /> : null}
                      {t(MARKET_CATEGORY_LABEL_KEYS[category] as never)}
                    </button>
                  );
                })}
              </div>
              <p role="status" className="text-secondary text-secondary-text">
                {selected === 1 ? t("onboarding.selection.one") : t("onboarding.selection.many", { arg1: selected })}
              </p>
              {results.length === 0 ? (
                <EmptyState title={t("common.noResults")} message={t("onboarding.emptyState.noResultsMessage")} icon="search" />
              ) : (
                <ul className="flex flex-col divide-y divide-separator">
                  {results.map((item) => {
                    const isWatched = watched.has(item.id);
                    const isSelected = draft.selectedIDs.includes(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-pressed={isSelected || isWatched}
                          disabled={isWorking || isWatched}
                          onClick={() => flow.toggle(item.id)}
                          className={cn(
                            "flex min-h-16 w-full items-center gap-3 rounded-small px-3 py-3 text-left disabled:opacity-70",
                            isSelected && "bg-accent-soft",
                          )}
                        >
                          <SecurityLogo symbol={item.symbol} size="s" />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-secondary font-semibold text-primary-text">{item.symbol}</span>
                            <span className="truncate text-secondary text-primary-text">{item.name}</span>
                            {isWatched ? <span className="text-caption text-secondary-text">{t("common.alreadyOnWatchlist")}</span> : null}
                          </span>
                          <Icon
                            name={isSelected || isWatched ? "check-circle" : "add"}
                            scale="l"
                            className={isSelected || isWatched ? "text-accent" : "text-secondary-text"}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col gap-2 bg-app-background pt-3 pb-4">
          {errorKey ? (
            <p role="alert" className="flex items-start gap-2 text-secondary text-negative">
              <Icon name="warning" className="mt-0.5" />
              <span>{t(errorKey as never)}</span>
            </p>
          ) : null}
          <Button type="submit" loading={isWorking}>
            {isWorking ? t("onboarding.button.saving") : primaryTitle}
          </Button>
          <button
            type="button"
            disabled={isWorking}
            onClick={() => void (onName ? advanceName(true) : finish(true))}
            className="min-h-11 text-secondary font-medium text-secondary-text disabled:opacity-42"
          >
            {secondaryTitle}
          </button>
        </div>
      </form>

      <Dialog
        open={confirmingSignOut}
        onClose={() => setConfirmingSignOut(false)}
        title={t("onboarding.signOut.title")}
        variant="dialog"
        footer={
          <SignOutForm className="flex flex-col gap-2">
            <Button type="submit" kind="destructive">
              {t("common.signOut")}
            </Button>
            <Button kind="secondary" onClick={() => setConfirmingSignOut(false)}>
              {t("common.cancel")}
            </Button>
          </SignOutForm>
        }
      >
        <p className="text-body text-secondary-text">{t("onboarding.signOut.message")}</p>
      </Dialog>
    </main>
  );
}
