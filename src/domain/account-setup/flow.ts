import { mapError, presentError } from "../errors";
import { MARKET_CATEGORIES, type MarketCategory } from "../market/discovery";

/** A synchronous key-value store (`localStorage` in the browser, a map in tests). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SetupStep = "name" | "watchlist";

export interface SetupDraft {
  readonly step: SetupStep;
  readonly name: string;
  readonly hasEditedName: boolean;
  readonly skippedName: boolean;
  /** Instrument ids, sorted (a set). */
  readonly selectedIDs: readonly string[];
  readonly category: MarketCategory;
}

export const emptyDraft = (name = ""): SetupDraft => ({
  step: "name",
  name,
  hasEditedName: false,
  skippedName: false,
  selectedIDs: [],
  category: "all",
});

const KEY_PREFIX = "investao.accountSetup.";
const draftKey = (userID: string) => `${KEY_PREFIX}${userID.toLowerCase()}.draft`;
const completedKey = (userID: string) => `${KEY_PREFIX}${userID.toLowerCase()}.completed`;

function decodeDraft(text: string | null): SetupDraft | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<Record<keyof SetupDraft, unknown>>;
    if (value.step !== "name" && value.step !== "watchlist") return null;
    const ids = Array.isArray(value.selectedIDs) ? value.selectedIDs.filter((id): id is string => typeof id === "string") : [];
    return {
      step: value.step,
      name: typeof value.name === "string" ? value.name : "",
      hasEditedName: value.hasEditedName === true,
      skippedName: value.skippedName === true,
      selectedIDs: [...new Set(ids)].sort(),
      category: MARKET_CATEGORIES.includes(value.category as MarketCategory) ? (value.category as MarketCategory) : "all",
    };
  } catch {
    return null;
  }
}

/**
 * The account-scoped setup draft (iOS `PostLoginOnboardingPersistence`): one per account, resumed after a
 * reload or a new sign-in, removed on completion. Storage failures (private mode, blocked site data) only
 * lose the ability to resume.
 */
export class SetupPersistence {
  constructor(private readonly store: KeyValueStore | null) {}

  draft(userID: string): SetupDraft | null {
    return decodeDraft(this.read(draftKey(userID)));
  }

  isCompleted(userID: string): boolean {
    return this.read(completedKey(userID)) === "true";
  }

  save(draft: SetupDraft, userID: string): void {
    this.write(() => this.store?.setItem(draftKey(userID), JSON.stringify(draft)));
  }

  complete(userID: string): void {
    this.write(() => {
      this.store?.setItem(completedKey(userID), "true");
      this.store?.removeItem(draftKey(userID));
    });
  }

  remove(userID: string): void {
    this.write(() => {
      this.store?.removeItem(completedKey(userID));
      this.store?.removeItem(draftKey(userID));
    });
  }

  private read(key: string): string | null {
    try {
      return this.store?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(action: () => void): void {
    try {
      action();
    } catch {
      // Unavailable storage: the setup still works, it just cannot resume.
    }
  }
}

export interface SetupState {
  readonly draft: SetupDraft;
  readonly isWorking: boolean;
  readonly isCompleted: boolean;
  /** Message catalogue key of the last failure. */
  readonly errorKey: string | null;
  readonly hasWatchlistFailure: boolean;
}

/** Message key for a failed save (iOS: mapped error in the action context, else the generic save failure). */
export function setupErrorKey(error: unknown): string {
  const mapped = mapError(error, "onboarding.save");
  return mapped ? presentError(mapped, "action").messageKey : "onboarding.error.saveGeneric";
}

const SAVE_INSTRUMENTS = "onboarding.error.saveInstruments";
const PARTIAL_SAVE = "onboarding.error.partialSave";

/**
 * Post-login account setup (iOS `PostLoginOnboardingStore`): an optional name, then the first watchlist.
 * Every write re-checks `isCurrent()` after it resolves, so a response for an account that is no longer
 * signed in never advances or completes; a second tap while a save runs does nothing.
 */
export class AccountSetupFlow {
  private state: SetupState;
  private readonly listeners = new Set<() => void>();

  constructor(
    readonly userID: string,
    initialName: string | null,
    private readonly persistence: SetupPersistence,
  ) {
    const draft = persistence.draft(userID) ?? emptyDraft(initialName ?? "");
    this.state = { draft, isWorking: false, isCompleted: false, errorKey: null, hasWatchlistFailure: false };
    persistence.save(draft, userID);
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  readonly getSnapshot = (): SetupState => this.state;

  get draft(): SetupDraft {
    return this.state.draft;
  }

  /** Replaces draft fields; saved while setup is unfinished. */
  update(change: Partial<SetupDraft>): void {
    const draft = { ...this.state.draft, ...change };
    if (change.selectedIDs) draft.selectedIDs = [...new Set(change.selectedIDs)].sort();
    this.patch({ draft });
  }

  editName(name: string): void {
    this.update({ name, hasEditedName: true });
  }

  toggle(id: string): void {
    if (this.state.isWorking) return;
    const selected = new Set(this.state.draft.selectedIDs);
    if (!selected.delete(id)) selected.add(id);
    this.update({ selectedIDs: [...selected] });
  }

  /** A provider name that arrives late replaces the prefilled one unless the person typed their own. */
  refreshInitialName(name: string | null): void {
    if (this.state.draft.step !== "name" || this.state.draft.hasEditedName) return;
    this.update({ name: name ?? "" });
  }

  back(): void {
    if (this.state.isWorking) return;
    this.patch({ draft: { ...this.state.draft, step: "name" }, errorKey: null, hasWatchlistFailure: false });
  }

  async advanceName(skip: boolean, isCurrent: () => boolean, save: (name: string | null) => Promise<void>): Promise<void> {
    if (this.state.isWorking || this.state.isCompleted || !isCurrent()) return;
    this.patch({ isWorking: true, errorKey: null });
    const trimmed = this.state.draft.name.trim();
    try {
      await save(skip || trimmed === "" ? null : trimmed);
      if (!isCurrent()) return;
      this.update({
        ...(skip ? {} : { name: trimmed }),
        skippedName: skip || trimmed === "",
        step: "watchlist",
      });
    } catch (error) {
      if (!isCurrent()) return;
      this.patch({ errorKey: setupErrorKey(error) });
    } finally {
      this.patch({ isWorking: false });
    }
  }

  async finish(
    skipWatchlist: boolean,
    isCurrent: () => boolean,
    saveWatchlist: (ids: readonly string[]) => Promise<readonly string[]>,
    saveCompletion: () => Promise<void>,
  ): Promise<void> {
    if (this.state.isWorking || this.state.isCompleted || !isCurrent()) return;
    this.patch({ isWorking: true, errorKey: null, hasWatchlistFailure: false });
    try {
      const requested = this.state.draft.selectedIDs;
      if (!skipWatchlist && requested.length > 0) {
        const confirmed = new Set(await saveWatchlist(requested));
        if (!isCurrent()) return;
        const remaining = requested.filter((id) => !confirmed.has(id));
        this.update({ selectedIDs: remaining });
        if (remaining.length > 0) {
          this.patch({ hasWatchlistFailure: true, errorKey: confirmed.size === 0 ? SAVE_INSTRUMENTS : PARTIAL_SAVE });
          return;
        }
      }
      try {
        await saveCompletion();
        if (!isCurrent()) return;
        this.persistence.complete(this.userID);
        this.patch({ isCompleted: true });
      } catch (error) {
        if (!isCurrent()) return;
        this.patch({ errorKey: setupErrorKey(error) });
      }
    } finally {
      this.patch({ isWorking: false });
    }
  }

  private patch(change: Partial<SetupState>): void {
    this.state = { ...this.state, ...change };
    if (change.draft && !this.state.isCompleted) this.persistence.save(this.state.draft, this.userID);
    for (const listener of this.listeners) listener();
  }
}
