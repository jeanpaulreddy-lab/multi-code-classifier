import { ModuleType, ReferenceEntry } from "../types";
import Fuse from 'fuse.js';

const DB_NAME = 'StatCodeDB';
const DB_VERSION = 1;
const STORE_NAME = 'reference_data';

// In-memory cache for Fuse instances to avoid rebuilding index on every row during batch processing
let fuseCache: Record<string, Fuse<ReferenceEntry>> = {};

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

const invalidateCache = (module?: ModuleType) => {
  if (module) {
    delete fuseCache[module];
  } else {
    fuseCache = {};
  }
};

export const addReferenceEntries = async (entries: ReferenceEntry[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    entries.forEach(entry => {
      store.put(entry);
    });

    transaction.oncomplete = () => {
      // Invalidate cache for affected modules
      const modules = new Set(entries.map(e => e.module));
      modules.forEach(m => invalidateCache(m));
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

// Helper to fetch all entries for a specific module to build the fuzzy index
const getEntriesByModule = async (module: ModuleType): Promise<ReferenceEntry[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('module');
        const request = index.getAll(module);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const findReferenceMatch = async (term: string, module: ModuleType): Promise<ReferenceEntry | null> => {
  const normalizedTerm = term.toLowerCase().trim();
  const db = await initDB();

  // 1. Try Exact Match First (Fastest)
  const exactMatchPromise = new Promise<ReferenceEntry | null>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    // We can't use the 'term' index directly for exact match with module constraint easily without a compound index.
    // However, given the cache logic below, we can rely on Fuse for exact matches too if we want, 
    // but a direct cursor check is often cheaper for a quick hit if the DB isn't huge.
    // Let's stick to the fuzzy logic primarily, but do a quick check if needed.
    // Actually, let's proceed to Fuzzy logic which handles exact matches well if configured correctly.
    resolve(null); 
  });

  // 2. Fuzzy Match Logic
  try {
    // Check if we have a cached Fuse instance for this module
    if (!fuseCache[module]) {
        const entries = await getEntriesByModule(module);
        if (entries.length === 0) return null;

        const options = {
            keys: ['term'],
            threshold: 0.3, // 0.0 = perfect match, 1.0 = match anything. 0.3 allows for typos.
            includeScore: true,
            ignoreLocation: true, // Search anywhere in the string
            useExtendedSearch: true
        };
        fuseCache[module] = new Fuse(entries, options);
    }

    const fuse = fuseCache[module];
    const results = fuse.search(term);

    if (results.length > 0) {
        // Return the best match
        // You could also enforce a stricter score check here if needed
        // fuse.js score: 0 is perfect, 1 is mismatch.
        // If score is very low (e.g. < 0.05), it's basically exact.
        return results[0].item;
    }

    return null;

  } catch (e) {
      console.error("Fuzzy search error", e);
      return null;
  }
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
        transaction.oncomplete = () => {
            invalidateCache(module);
            resolve();
        };
      } else {
        const request = store.clear();
        request.onsuccess = () => {
            invalidateCache();
            resolve();
        };
        request.onerror = () => reject(request.error);
      }
    });
};