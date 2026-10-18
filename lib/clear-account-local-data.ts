import { deleteExposure } from "./content-exposure";
import { deleteAccountArchives } from "./wrap-storage";
export async function clearAccountLocalData(userID: string) {
  await deleteAccountArchives(userID);
  await deleteExposure(userID);
  const key = `investao.personalisation.v1.${userID}`;
  if (navigator.locks)
    await navigator.locks.request(key, () => localStorage.removeItem(key));
  else localStorage.removeItem(key);
}
