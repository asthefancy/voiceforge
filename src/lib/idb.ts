/**
 * 依存ゼロの薄い IndexedDB ラッパー。
 * localStorage（約5MB上限）では音声クリップの大量保存に耐えないため、
 * サウンドボードのクリップはこちらに保存する（完全端末内・容量はストレージに準拠）。
 */
const DB_NAME = "voiceforge";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("clips")) {
        db.createObjectStore("clips", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export const idb = {
  getAll<T>(store: string): Promise<T[]> {
    return tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
  },
  put<T>(store: string, value: T): Promise<IDBValidKey> {
    return tx<IDBValidKey>(store, "readwrite", (s) => s.put(value));
  },
  delete(store: string, key: IDBValidKey): Promise<undefined> {
    return tx<undefined>(store, "readwrite", (s) => s.delete(key) as IDBRequest<undefined>);
  },
};
