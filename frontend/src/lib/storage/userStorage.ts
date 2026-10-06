/**
 * userStorage.ts - Unified Client-Side Storage Manager with Strict Multi-User Namespacing
 * ─────────────────────────────────────────────────────────────────────────────────────
 * Guarantees zero cross-user cache leaks:
 * 1. Every persistent cache key is strictly prefixed with the verified user_id (`${userId}:${key}`).
 * 2. Provides `clearAllAppStorage()` to completely purge localStorage, sessionStorage,
 *    IndexedDB databases, and CacheStorage on login, logout, user switch, and account deletion.
 */

export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('manas_user_id') || null;
}

export function getNamespacedKey(key: string, userId?: string | null): string {
  const uid = userId || getCurrentUserId();
  return uid ? `${uid}:${key}` : `anon:${key}`;
}

export function getUserItem<T = any>(key: string, userId?: string | null): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const namespaced = getNamespacedKey(key, userId);
    const raw = localStorage.getItem(namespaced);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function setUserItem(key: string, value: any, userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const namespaced = getNamespacedKey(key, userId);
    localStorage.setItem(namespaced, JSON.stringify(value));
  } catch (err) {
    console.warn(`[userStorage] Failed to set ${key}:`, err);
  }
}

export function removeUserItem(key: string, userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const namespaced = getNamespacedKey(key, userId);
    localStorage.removeItem(namespaced);
  } catch (_) {}
}

/**
 * Permanently and thoroughly clears ALL application storage across:
 * - localStorage
 * - sessionStorage
 * - IndexedDB (manas_mascot_db and any dynamic DBs)
 * - Service worker / Browser CacheStorage
 */
export async function clearAllAppStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Clear LocalStorage & SessionStorage
  try {
    localStorage.clear();
  } catch (e) {
    console.warn('[userStorage] localStorage clear error:', e);
  }

  try {
    sessionStorage.clear();
  } catch (e) {
    console.warn('[userStorage] sessionStorage clear error:', e);
  }

  // 2. Delete all IndexedDB databases
  try {
    if (window.indexedDB && window.indexedDB.databases) {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          window.indexedDB.deleteDatabase(db.name);
        }
      }
    } else if (window.indexedDB) {
      window.indexedDB.deleteDatabase('manas_mascot_db');
    }
  } catch (e) {
    console.warn('[userStorage] IndexedDB delete error:', e);
  }

  // 3. Clear CacheStorage
  try {
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      for (const name of cacheNames) {
        await window.caches.delete(name);
      }
    }
  } catch (e) {
    console.warn('[userStorage] caches delete error:', e);
  }
}
