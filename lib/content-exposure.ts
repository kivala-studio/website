import {
  emptyExposure,
  pruneExposure,
  type Exposure,
} from "./insight-personalisation.ts";
const removed = new Set<string>();
const keyFor = (userID: string) => `investao.exposure.v1.${userID}`;
export function readExposure(userID: string, now = Date.now()): Exposure {
  if (removed.has(userID)) return emptyExposure();
  const raw = JSON.parse(localStorage.getItem(keyFor(userID)) || "null");
  if (raw?.deleted) return emptyExposure();
  if (raw && (raw.version !== 1 || raw.userID !== userID || !raw.exposure))
    throw new Error("Unsupported local preferences");
  return pruneExposure(raw?.exposure || emptyExposure(), now);
}
export async function updateExposure(
  userID: string,
  authorize: () => Promise<boolean>,
  update: (value: Exposure) => Exposure,
) {
  if (!navigator.locks || removed.has(userID))
    throw new Error("Local preferences unavailable");
  return navigator.locks.request(keyFor(userID), async () => {
    if (removed.has(userID) || !(await authorize()))
      throw new Error("Account changed");
    const raw = JSON.parse(localStorage.getItem(keyFor(userID)) || "null");
    if (raw?.deleted) throw new Error("Account was deleted");
    const exposure = pruneExposure(update(readExposure(userID)), Date.now());
    localStorage.setItem(
      keyFor(userID),
      JSON.stringify({ version: 1, userID, exposure }),
    );
    return exposure;
  });
}
export async function deleteExposure(userID: string) {
  removed.add(userID);
  const remove = () =>
    localStorage.setItem(keyFor(userID), JSON.stringify({ deleted: true }));
  if (navigator.locks) await navigator.locks.request(keyFor(userID), remove);
  else remove();
}
