// assets/imageLoader.js — turns a user-selected File (png/jpg/webp/svg) into
// an asset in IndexedDB (see assetStore.js) and provides a synchronous-looking
// getCachedImage(source) accessor for the 2D canvas renderer, which cannot
// await a promise mid-draw: the first call for a given source kicks off an
// async load and returns null (the renderer falls back to a rectangle for
// that frame); once loaded, the image is cached and onReady() fires so the
// caller can trigger a redraw.

import { getAssetUrl, isAssetSource, assetIdFromSource, putAsset } from './assetStore.js';

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export function isAcceptedImageFile(file) {
  return ACCEPTED_MIME.includes(file.type) || /\.(png|jpe?g|webp|svg)$/i.test(file.name);
}

// Store `file` as a new asset, returning its "asset://<id>" source string.
export async function storeImageAsset(file) {
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await putAsset(id, file, { name: file.name });
  return `asset://${id}`;
}

const imageCache = new Map(); // source -> HTMLImageElement | null (null = failed)
const pending = new Set();

// Synchronous cache lookup + async kick-off. onReady() fires once the image
// finishes loading (or fails), so the caller can redraw.
export function getCachedImage(source, onReady) {
  if (!source) return null;
  if (imageCache.has(source)) return imageCache.get(source);
  if (pending.has(source)) return null;
  pending.add(source);
  loadImage(source)
    .then((img) => {
      imageCache.set(source, img);
    })
    .catch(() => {
      imageCache.set(source, null); // remembered failure -> renderer falls back to rectangle
    })
    .finally(() => {
      pending.delete(source);
      if (onReady) onReady();
    });
  return null;
}

async function loadImage(source) {
  let url = source;
  if (isAssetSource(source)) {
    url = await getAssetUrl(assetIdFromSource(source));
    if (!url) throw new Error(`asset not found: ${source}`);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${source}`));
    img.src = url;
  });
}

// Clears all cached successes/failures. Used by tests and by "retry load"
// affordances in the properties panel.
export function clearImageCache() {
  imageCache.clear();
  pending.clear();
}
