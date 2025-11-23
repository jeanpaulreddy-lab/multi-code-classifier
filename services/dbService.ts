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

const getFuseInstance = async (module: ModuleType) => {
    if (!fuseCache[module]) {
        const entries = await getEntriesByModule(module);
        if (entries.length === 0) return null;

        const options = {
            keys: ['term'],
            threshold: 0.4, // Default threshold for RAG suggestions
            includeScore: true,
            ignoreLocation: true, // Search anywhere in the string
            useExtendedSearch: true,
            minMatchCharLength: 2 // Avoid matching single characters
        };
        fuseCache[module] = new Fuse(entries, options);
    }
    return fuseCache[module];
};

// Returns exact-ish match (very low score) or null
export const findReferenceMatch = async (term: string, module: ModuleType): Promise<ReferenceEntry | null> => {
  try {
    const fuse = await getFuseInstance(module);
    if (!fuse) return null;

    if (!term || term.trim() === '') return null;

    const results = fuse.search(term);

    if (results.length > 0) {
        // Strict threshold for "Auto-Code" without AI (0.0 is exact, 0.1 allows very minor typo)
        if (results[0].score && results[0].score < 0.1) {
            return results[0].item;
        }
    }
    return null;
  } catch (e) {
      // Log specific context to help debug without crashing the batch process
      console.error(`[DB Service Error] findReferenceMatch failed for module: ${module}, term: "${term?.substring(0, 50)}..."`, e);
      return null;
  }
};

// Returns top 3 similar entries for RAG (Retrieval Augmented Generation)
export const findSimilarReferences = async (term: string, module: ModuleType): Promise<ReferenceEntry[]> => {
    try {
        const fuse = await getFuseInstance(module);
        if (!fuse) return [];
    
        if (!term || term.trim() === '') return [];

        const results = fuse.search(term);
        // Return top 3 matches to help the AI context
        return results.slice(0, 3).map(r => r.item);
      } catch (e) {
          console.error(`[DB Service Error] findSimilarReferences failed for module: ${module}, term: "${term?.substring(0, 50)}..."`, e);
          return [];
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