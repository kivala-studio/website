/**
 * The browser's privacy-mode preference (iOS `PrivacyModeStore`). Setting the current value again does
 * nothing; a change is saved before anyone is told, so a reload right after it already renders hidden.
 */
export class PrivacyModeStore {
  private enabled: boolean;
  private readonly listeners = new Set<() => void>();

  constructor(
    initial: boolean,
    private readonly persist: (enabled: boolean) => void,
  ) {
    this.enabled = initial;
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.enabled;

  set(enabled: boolean, { persist = true }: { persist?: boolean } = {}): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (persist) this.persist(enabled);
    for (const listener of this.listeners) listener();
  }
}
