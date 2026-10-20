export type CookieChoice = "all" | "essential";
export const consentKey = "investao.cookie-consent.v1";
export const consentEvent = "investao:cookie-consent";
const lifetime = 180 * 86400000;
let temporaryChoice: CookieChoice | null = null;

export function readCookieChoice(): CookieChoice | null {
  if (typeof window === "undefined") return null;
  if (temporaryChoice) return temporaryChoice;
  try {
    const saved = JSON.parse(localStorage.getItem(consentKey) || "null");
    return saved?.version === 1 &&
      (saved.choice === "all" || saved.choice === "essential") &&
      Number.isFinite(saved.expiresAt) && saved.expiresAt > Date.now()
      ? saved.choice : null;
  } catch {
    return temporaryChoice;
  }
}

export const optionalStorageAllowed = () => readCookieChoice() === "all";

export function saveCookieChoice(choice: CookieChoice) {
  try {
    localStorage.setItem(consentKey, JSON.stringify({ version: 1, choice, expiresAt: Date.now() + lifetime }));
    temporaryChoice = null;
    if (choice === "essential") {
      const optionalKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith("investao.personalisation.v1.") ||
        key.startsWith("investao.exposure.v1.") ||
        key === "investao.intelligence.installation",
      );
      for (const key of optionalKeys) localStorage.removeItem(key);
    }
  } catch {
    temporaryChoice = choice;
    // When storage is blocked, the choice lasts for this page visit only.
  }
  window.dispatchEvent(new Event(consentEvent));
}

export function subscribeCookieChoice(update: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === consentKey || event.key === null) update();
  };
  window.addEventListener("storage", storage);
  window.addEventListener(consentEvent, update);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(consentEvent, update);
  };
}
