// services/photo.js — zero-dep photo capture helpers. Downscales a picked image to
// a small JPEG data URL (kept in IndexedDB, included in JSON backup) and, where the
// platform supports it, reads a barcode/QR out of the photo via the BarcodeDetector API.

/**
 * readAndDownscale(file, { maxDim, quality }) -> Promise<dataURL>
 * Loads the image, scales so the LONGer side <= maxDim (aspect kept, never upscaled),
 * draws onto a canvas and returns a JPEG data URL. Rejects on an invalid image.
 */
export async function readAndDownscale(file, { maxDim = 1024, quality = 0.7 } = {}) {
  const { source, cleanup } = await loadImage(file);
  try {
    const w = source.width || source.naturalWidth;
    const h = source.height || source.naturalHeight;
    if (!w || !h) throw new Error('이미지를 읽을 수 없어요');
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const cx = canvas.getContext('2d');
    cx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    cleanup();
  }
}

// Prefer createImageBitmap (honours EXIF orientation); fall back to an <img> + object URL.
async function loadImage(file) {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, cleanup: () => bitmap.close?.() };
    } catch { /* fall through to <img> path */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('이미지를 읽을 수 없어요'));
      el.src = url;
    });
    return { source: img, cleanup: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/**
 * detectCode(file) -> Promise<string|null>
 * Reads the first barcode/QR value from the photo, or null when unsupported or none found.
 */
export async function detectCode(file) {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const bd = new window.BarcodeDetector({
      formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'codabar', 'upc_a', 'upc_e', 'itf']
    });
    const bitmap = await createImageBitmap(file);
    const codes = await bd.detect(bitmap);
    bitmap.close?.();
    return codes && codes.length ? codes[0].rawValue : null;
  } catch {
    return null;
  }
}

/** supportsBarcodeScan() — whether the platform can auto-read codes from a photo. */
export function supportsBarcodeScan() {
  return 'BarcodeDetector' in window;
}
