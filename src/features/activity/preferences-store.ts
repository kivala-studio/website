import {
  type CategoryPreference,
  type CategoryPreferences,
  type NotificationPreferences,
  type UnusualPreferences,
  type UnusualRule,
  withRule,
} from "@/domain/activity/preferences";
import { type ErrorCoordinator, isCancellation } from "@/domain/errors";

export interface PreferencesRepository {
  read(signal?: AbortSignal): Promise<NotificationPreferences>;
  saveCategories(value: CategoryPreferences): Promise<void>;
  setRecaps(value: boolean): Promise<void>;
  saveUnusual(value: UnusualPreferences): Promise<void>;
}

export interface PreferencesSnapshot {
  readonly status: "idle" | "loading" | "loaded" | "failed";
  readonly preferences: NotificationPreferences | null;
}

type Section = "categories" | "recaps" | "unusual";

/**
 * Notification preferences shared with the apps: each switch applies at once and is saved in order. Every save
 * sends the section's latest state, so a burst of switches ends with what is shown; a failure restores the
 * section's last saved state with one toast.
 */
export class PreferencesStore {
  private state: PreferencesSnapshot = { status: "idle", preferences: null };
  private saved: NotificationPreferences | null = null;
  private readonly listeners = new Set<() => void>();
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: PreferencesRepository,
    private readonly errors: ErrorCoordinator,
  ) {}

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.state;

  private set(change: Partial<PreferencesSnapshot>) {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }

  async load(signal?: AbortSignal): Promise<void> {
    if (this.state.status === "loading" || this.state.status === "loaded") return;
    this.set({ status: "loading" });
    try {
      const preferences = await this.repository.read(signal);
      this.saved = preferences;
      this.set({ status: "loaded", preferences });
    } catch (error) {
      if (signal?.aborted || isCancellation(error)) return this.set({ status: "idle" });
      this.errors.handle(error, "preferences.load");
      this.set({ status: "failed" });
    }
  }

  setCategory(key: CategoryPreference, value: boolean) {
    this.change("categories", (current) => ({ ...current, categories: { ...current.categories, [key]: value } }));
  }

  setRecaps(value: boolean) {
    this.change("recaps", (current) => ({ ...current, recaps: value }));
  }

  setUnusualEnabled(enabled: boolean) {
    this.change("unusual", (current) => ({ ...current, unusual: { ...current.unusual, enabled } }));
  }

  setUnusualRule(rule: UnusualRule, enabled: boolean) {
    this.change("unusual", (current) => ({ ...current, unusual: withRule(current.unusual, rule, enabled) }));
  }

  private change(section: Section, apply: (current: NotificationPreferences) => NotificationPreferences) {
    const current = this.state.preferences;
    if (!current) return;
    this.set({ preferences: apply(current) });
    this.tail = this.tail.then(() => this.save(section));
  }

  private async save(section: Section) {
    const shown = this.state.preferences;
    const saved = this.saved;
    if (!shown || !saved) return;
    try {
      if (section === "categories") await this.repository.saveCategories(shown.categories);
      else if (section === "recaps") await this.repository.setRecaps(shown.recaps);
      else await this.repository.saveUnusual(shown.unusual);
      this.saved = { ...saved, [section]: shown[section] };
    } catch (error) {
      if (isCancellation(error)) return;
      const restored = this.saved ?? saved;
      this.set({ preferences: { ...this.state.preferences!, [section]: restored[section] } });
      this.errors.present(error, `preferences.${section}`);
    }
  }
}
