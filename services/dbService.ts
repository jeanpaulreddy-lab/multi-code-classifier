
import { ModuleType, ReferenceEntry } from "../types";

const DB_NAME = 'StatCodeDB';
const DB_VERSION = 1;
const STORE_NAME = 'reference_data';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject("IndexedDB error");

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        // Create index for searching by module and term
        objectStore.createIndex('module', 'module', { unique: false });
        objectStore.createIndex('term', 'term', { unique: false });
      }
    };
  });
};

export const addReferenceEntries = async (entries: ReferenceEntry[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    entries.forEach(entry => {
      store.put(entry);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const findReferenceMatch = async (term: string, module: ModuleType): Promise<ReferenceEntry | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();

    const normalizedTerm = term.toLowerCase().trim();

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const entry = cursor.value as ReferenceEntry;
        // Simple exact match check (could be enhanced to fuzzy later)
        if (entry.module === module && entry.term.toLowerCase().trim() === normalizedTerm) {
          resolve(entry);
          return;
        }
        cursor.continue();
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const getReferenceStats = async (): Promise<Record<ModuleType, number>> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const data = request.result as ReferenceEntry[];
      const stats: Record<string, number> = {
        [ModuleType.ISCO08]: 0,
        [ModuleType.ISIC4]: 0,
        [ModuleType.COICOP]: 0,
        [ModuleType.DUAL]: 0
      };
      
      data.forEach(d => {
        if (stats[d.module] !== undefined) stats[d.module]++;
      });
      
      resolve(stats as Record<ModuleType, number>);
    };
    request.onerror = () => reject(request.error);
  });
};

export const clearReferenceData = async (module?: ModuleType): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      if (module) {
        // Delete only specific module data via cursor
        const request = store.openCursor();
        request.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest).result;
            if (cursor) {
                const entry = cursor.value as ReferenceEntry;
                if (entry.module === module) {
                    cursor.delete();
                }
                cursor.continue();
            }
        }
        transaction.oncomplete = () => resolve();
      } else {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }
    });
};
