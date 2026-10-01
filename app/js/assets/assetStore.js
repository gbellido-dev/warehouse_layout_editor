// assets/assetStore.js — local, offline binary asset storage for uploaded
// visuals (images, SVGs, and later GLB/GLTF models).
//
// Binary data lives ONLY in IndexedDB, never inlined into the layout JSON — a
// layout only ever references an asset by id via an "asset://<id>" visual
// source string (see objects/objectFactory.js and schema.js). This keeps
// exported layouts small and portable; if an asset is missing (e.g. a layout
// was imported into a different browser/profile) the renderer falls back to
// a plain rectangle (see objects/objectRenderer2d.js / preview3d.js) rather
// than failing.
//
// Why IndexedDB and not localStorage: localStorage is a ~5MB string-only
// store shared with the layout draft itself (see store.js's LS_KEY); a
// handful of machine photos would blow that budget immediately. IndexedDB
// has no such practical ceiling and stores Blobs natively (no base64 bloat).

const DB_NAME = 'workshop_layout_editor_assets_v1';
const STORE = 'assets';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function withStore(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

// Store a Blob/File under `id` with a little metadata. Overwrites any
// existing asset with the same id.
export function putAsset(id, blob, meta = {}) {
  return withStore('readwrite', (store) => store.put({ id, blob, name: meta.name || id, mime: blob.type }));
}

export function getAssetRecord(id) {
  return withStore('readonly', (store) => store.get(id));
}

export function deleteAsset(id) {
  return withStore('readwrite', (store) => store.delete(id));
}

export function listAssets() {
  return withStore('readonly', (store) => store.getAll());
}

// Object-URL cache so repeated renders of the same asset id don't leak new
// URLs every frame. Call revokeAssetUrl(id) after deleteAsset(id).
const urlCache = new Map();

export async function getAssetUrl(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await getAssetRecord(id);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(id, url);
  return url;
}

export function revokeAssetUrl(id) {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

export const ASSET_SCHEME = 'asset://';

export function isAssetSource(source) {
  return typeof source === 'string' && source.startsWith(ASSET_SCHEME);
}

export function assetIdFromSource(source) {
  return isAssetSource(source) ? source.slice(ASSET_SCHEME.length) : null;
}
