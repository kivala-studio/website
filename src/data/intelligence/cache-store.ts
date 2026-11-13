import { type CacheBackend, IntelligenceCache } from "@/domain/intelligence/cache";

/*
 * IndexedDB behind the intelligence cache and the Activity centre's local archive. One database per browser;
 * keys are `<user id>:<kind>`, so an account only ever reads its own rows. Every call fails soft: private
 * windows, blocked storage and quota errors leave the app working from memory.
 */

const DATABASE = "investao-intelligence";
const STORE = "readings";
const VERSION = 1;

let opening: Promise<IDBDatabase | null> | undefined;

function database(): Promise<IDBDatabase | null> {
  opening ??= new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DATABASE, VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  }).then((db) => {
    if (!db) opening = undefined;
    return db;
  });
  return opening;
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await database();
  if (!db) throw new Error("storage unavailable");
  return new Promise<T | undefined>((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    } catch (error) {
      reject(error);
    }
  });
}

export const indexedDBBackend: CacheBackend = {
  async get(key) {
    const value = await run<unknown>("readonly", (store) => store.get(key));
    return typeof value === "string" ? value : undefined;
  },
  async put(key, value) {
    await run("readwrite", (store) => store.put(value, key));
  },
  async delete(key) {
    await run("readwrite", (store) => store.delete(key));
  },
  async clear(prefix) {
    await run("readwrite", (store) => {
      if (!prefix) return store.clear();
      // Keys sort as strings; every key of one account lies in [prefix, prefix + U+FFFF).
      store.delete(IDBKeyRange.bound(prefix, `${prefix}￿`));
    });
  },
};

let signedInUser: string | null = null;

/** The account the tab is signed in as; results for any other account are dropped after each await. */
export function setIntelligenceUser(userID: string | null) {
  signedInUser = userID?.toLowerCase() ?? null;
}

/** Signed out: no read is valid until an account signs in again. */
const currentUser = () => signedInUser ?? "";

export const intelligenceCache = new IntelligenceCache(indexedDBBackend, currentUser);

/** Sign-out: every saved reading and archive in this browser goes, and pending writes are revoked. */
export async function clearIntelligenceCache(): Promise<void> {
  signedInUser = null;
  await intelligenceCache.clear();
}

/** The Activity centre's local archive (JSON, decimals tagged) for one account. */
export async function loadActivityArchive(userID: string): Promise<string | undefined> {
  const owner = userID.toLowerCase();
  try {
    const text = await indexedDBBackend.get(`${owner}:activity`);
    return signedInUser === owner ? text : undefined;
  } catch {
    return undefined;
  }
}

export async function saveActivityArchive(userID: string, text: string): Promise<boolean> {
  const owner = userID.toLowerCase();
  if (signedInUser !== owner) return false;
  try {
    await indexedDBBackend.put(`${owner}:activity`, text);
    return signedInUser === owner;
  } catch {
    return false;
  }
}
