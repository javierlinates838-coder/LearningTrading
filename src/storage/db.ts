export type StorageKey = 'settings' | 'progress' | 'sim' | 'journal';
export const STORAGE_KEYS: StorageKey[] = ['settings', 'progress', 'sim', 'journal'];

export interface StoredRecord {
  key: string;
  schemaVersion: number;
  /** Incremented on every write; used to detect writes from another tab. */
  rev: number;
  updatedAt: string;
  writer: string;
  data: unknown;
}

export type StorageErrorCode = 'unavailable' | 'blocked' | 'quota' | 'conflict' | 'unknown';

export class StorageError extends Error {
  code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface StorageBackend {
  kind: 'indexeddb' | 'memory';
  get(key: string): Promise<StoredRecord | undefined>;
  /** Atomic compare-and-set. Rejects with a conflict error if the stored rev is not `expectedRev`. */
  put(key: string, data: unknown, schemaVersion: number, expectedRev: number, writer: string): Promise<StoredRecord>;
  putRaw(key: string, value: unknown): Promise<void>;
  keys(): Promise<string[]>;
  remove(key: string): Promise<void>;
}

const DB_NAME = 'marketquest';
const DB_VERSION = 1;
const STORE = 'records';

function asStorageError(err: unknown): StorageError {
  if (err instanceof StorageError) return err;
  const name = (err as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError') return new StorageError('quota', 'Browser storage is full.');
  return new StorageError('unknown', (err as Error)?.message ?? 'Unknown storage error');
}

export function openIndexedDb(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!factory) {
      reject(new StorageError('unavailable', 'IndexedDB is not available in this browser.'));
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(new StorageError('unavailable', (e as Error).message));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onblocked = () => reject(new StorageError('blocked', 'Another tab is holding an older version of the database open.'));
    req.onerror = () => reject(asStorageError(req.error));
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export function indexedDbBackend(db: IDBDatabase): StorageBackend {
  const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode);
  return {
    kind: 'indexeddb',
    get(key) {
      return new Promise((resolve, reject) => {
        const r = tx('readonly').objectStore(STORE).get(key);
        r.onsuccess = () => resolve(r.result as StoredRecord | undefined);
        r.onerror = () => reject(asStorageError(r.error));
      });
    },
    put(key, data, schemaVersion, expectedRev, writer) {
      return new Promise((resolve, reject) => {
        let t: IDBTransaction;
        try {
          t = tx('readwrite');
        } catch (e) {
          reject(asStorageError(e));
          return;
        }
        const store = t.objectStore(STORE);
        let written: StoredRecord | undefined;
        let failure: StorageError | undefined;
        const g = store.get(key);
        g.onsuccess = () => {
          const current = g.result as StoredRecord | undefined;
          const rev = current?.rev ?? 0;
          if (rev !== expectedRev) {
            failure = new StorageError('conflict', 'This data was changed in another tab.');
            t.abort();
            return;
          }
          written = { key, schemaVersion, rev: rev + 1, updatedAt: new Date().toISOString(), writer, data };
          store.put(written);
        };
        t.oncomplete = () => resolve(written!);
        t.onabort = () => reject(failure ?? asStorageError(t.error));
        t.onerror = () => {
          /* surfaced through onabort */
        };
      });
    },
    putRaw(key, value) {
      return new Promise((resolve, reject) => {
        const t = tx('readwrite');
        t.objectStore(STORE).put({ key, schemaVersion: 0, rev: 0, updatedAt: new Date().toISOString(), writer: 'quarantine', data: value });
        t.oncomplete = () => resolve();
        t.onabort = () => reject(asStorageError(t.error));
      });
    },
    keys() {
      return new Promise((resolve, reject) => {
        const r = tx('readonly').objectStore(STORE).getAllKeys();
        r.onsuccess = () => resolve(r.result.map(String));
        r.onerror = () => reject(asStorageError(r.error));
      });
    },
    remove(key) {
      return new Promise((resolve, reject) => {
        const t = tx('readwrite');
        t.objectStore(STORE).delete(key);
        t.oncomplete = () => resolve();
        t.onabort = () => reject(asStorageError(t.error));
      });
    },
  };
}

export function memoryBackend(): StorageBackend {
  const map = new Map<string, StoredRecord>();
  return {
    kind: 'memory',
    async get(key) {
      const v = map.get(key);
      return v ? structuredClone(v) : undefined;
    },
    async put(key, data, schemaVersion, expectedRev, writer) {
      const rev = map.get(key)?.rev ?? 0;
      if (rev !== expectedRev) throw new StorageError('conflict', 'This data was changed elsewhere.');
      const rec = { key, schemaVersion, rev: rev + 1, updatedAt: new Date().toISOString(), writer, data: structuredClone(data) };
      map.set(key, rec);
      return structuredClone(rec);
    },
    async putRaw(key, value) {
      map.set(key, { key, schemaVersion: 0, rev: 0, updatedAt: new Date().toISOString(), writer: 'quarantine', data: value });
    },
    async keys() {
      return [...map.keys()];
    },
    async remove(key) {
      map.delete(key);
    },
  };
}
