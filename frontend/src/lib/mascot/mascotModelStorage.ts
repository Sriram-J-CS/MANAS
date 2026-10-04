/**
 * IndexedDB storage for 3D Mascot models (GLB, GLTF, FBX, OBJ, Fallback Images).
 * Storing 3D models in IndexedDB prevents localStorage quota exceeded errors (localStorage ~5MB limit).
 */

const DB_NAME = 'manas_mascot_db';
const DB_VERSION = 1;
const STORE_NAME = 'mascot_models';

export interface StoredMascot {
  id: string; // 'current_custom_mascot'
  name: string;
  fileType: 'glb' | 'gltf' | 'fbx' | 'obj' | 'image';
  blob: Blob;
  sizeBytes: number;
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this browser'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMascotModel(file: File): Promise<{
  id: string;
  name: string;
  fileType: 'glb' | 'gltf' | 'fbx' | 'obj' | 'image';
  objectUrl: string;
}> {
  // 1. Validation & Security Checks
  const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB limit
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('File size exceeds the 50MB safety limit. Please upload an optimized model.');
  }

  const rawExt = file.name.split('.').pop()?.toLowerCase() || '';
  let fileType: 'glb' | 'gltf' | 'fbx' | 'obj' | 'image' | null = null;

  if (rawExt === 'glb') fileType = 'glb';
  else if (rawExt === 'gltf') fileType = 'gltf';
  else if (rawExt === 'fbx') fileType = 'fbx';
  else if (rawExt === 'obj') fileType = 'obj';
  else if (['png', 'jpg', 'jpeg', 'webp'].includes(rawExt)) fileType = 'image';

  if (!fileType) {
    throw new Error('Unsupported format. Please upload a GLB, GLTF, FBX, OBJ or PNG/JPG file.');
  }

  // Sanitize filename to prevent directory traversal or script injection
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 60);

  const db = await openDB();
  const stored: StoredMascot = {
    id: 'current_custom_mascot',
    name: sanitizedName,
    fileType,
    blob: file,
    sizeBytes: file.size,
    updatedAt: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(stored);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const objectUrl = URL.createObjectURL(file);
  return {
    id: stored.id,
    name: stored.name,
    fileType,
    objectUrl,
  };
}

export async function getStoredMascotModel(): Promise<{
  id: string;
  name: string;
  fileType: 'glb' | 'gltf' | 'fbx' | 'obj' | 'image';
  objectUrl: string;
  blob: Blob;
} | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('current_custom_mascot');
      req.onsuccess = () => {
        const item = req.result as StoredMascot | undefined;
        if (item && item.blob) {
          resolve({
            id: item.id,
            name: item.name,
            fileType: item.fileType,
            objectUrl: URL.createObjectURL(item.blob),
            blob: item.blob,
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not load custom mascot from IndexedDB:', err);
    return null;
  }
}

export async function clearStoredMascotModel(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete('current_custom_mascot');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error clearing stored mascot:', err);
  }
}
