import {
  assertArchive,
  archiveExpired,
  type WrapArchive,
} from "./wrap-archive.ts";

let connection: Promise<IDBDatabase> | undefined;
const deletedAccounts = new Set<string>();
function database() {
  if (!connection)
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("investao-wrap-history", 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("archives", {
          keyPath: ["userID", "key"],
        });
        store.createIndex("account", "userID");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          connection = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        connection = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        connection = undefined;
        reject(new Error("History is open in an older tab"));
      };
    });
  return connection;
}
export async function listArchives(userID: string): Promise<WrapArchive[]> {
  if (deletedAccounts.has(userID)) return [];
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("archives", "readwrite"),
      store = tx.objectStore("archives");
    const request = store.index("account").getAll(userID);
    let rows: WrapArchive[] = [];
    request.onsuccess = () => {
      try {
        for (const value of request.result) {
          assertArchive(value, userID);
          if (archiveExpired(value, Date.now()))
            store.delete([userID, value.key]);
          else rows.push(value);
        }
        rows = rows.sort((a, b) =>
          b.editions[0].period.starts_on.localeCompare(
            a.editions[0].period.starts_on,
          ),
        );
      } catch (error) {
        reject(error);
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(rows);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("History could not be read"));
  });
}
export async function mutateArchive(
  userID: string,
  key: string,
  update: (record: WrapArchive | null) => WrapArchive,
) {
  if (deletedAccounts.has(userID)) throw new Error("Account was deleted");
  const db = await database();
  return new Promise<WrapArchive>((resolve, reject) => {
    const tx = db.transaction("archives", "readwrite"),
      store = tx.objectStore("archives");
    const request = store.get([userID, key]);
    let result: WrapArchive;
    request.onsuccess = () => {
      try {
        if (deletedAccounts.has(userID)) throw new Error("Account was deleted");
        if (request.result) assertArchive(request.result, userID, key);
        result = update(request.result || null);
        assertArchive(result, userID, key);
        store.put(result);
      } catch (error) {
        reject(error);
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("History could not be saved"));
  });
}
export async function deleteAccountArchives(userID: string) {
  deletedAccounts.add(userID);
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("archives", "readwrite"),
      store = tx.objectStore("archives");
    const request = store
      .index("account")
      .openKeyCursor(IDBKeyRange.only(userID));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
