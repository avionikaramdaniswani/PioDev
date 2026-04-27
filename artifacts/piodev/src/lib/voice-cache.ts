const DB_NAME = "piocode-voice-studio";
const DB_VERSION = 1;
const STORE = "tts-last";
const KEY = "last";

export type CachedTTS = {
  blob: Blob;
  text: string;
  voiceKey: string;
  language: string;
  model: string;
  instruction?: string;
  createdAt: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLastTTS(item: CachedTTS): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(item, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // best-effort cache; silently ignore quota / private-mode errors
  }
}

export async function loadLastTTS(): Promise<CachedTTS | null> {
  try {
    const db = await openDB();
    const item = await new Promise<CachedTTS | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as CachedTTS | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return item;
  } catch {
    return null;
  }
}

export async function clearLastTTS(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
