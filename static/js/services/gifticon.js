// services/gifticon.js — zero-dep gifticon image intake. A gifticon arrives as a
// screenshot (KakaoTalk, mail, SMS), so the job is: downscale it to something that
// can live in IndexedDB and a JSON backup, and pull the barcode value out of it so
// the detail view can render a crisp barcode instead of a blurry screenshot.
//
// Derived from the removed services/photo.js (commit 899a6dd), which attached a
// photo of a *physical* coupon. A gifticon is a different thing — a single-use
// item with its own expiry — so this keeps the useful primitives and drops the
// rest.

// A gifticon has to stay legible enough to scan off the screen, but every byte
// here also lands in the JSON backup, so the long edge is capped and WebP is
// preferred (roughly half of JPEG at the same perceived quality).
const MAX_DIM = 1280;
const QUALITY = 0.72;

// Hard ceiling for one stored image. Above this we re-encode smaller rather than
// let a handful of gifticons blow past the origin's storage quota.
export const MAX_BYTES = 400 * 1024;

/**
 * readGifticon(file, { maxDim, quality }) -> Promise<dataURL>
 * Loads the image, scales so the LONGer side <= maxDim (aspect kept, never
 * upscaled) and returns a WebP data URL, stepping quality down if the result
 * would exceed MAX_BYTES. Rejects on an unreadable image.
 */
export async function readGifticon(file, { maxDim = MAX_DIM, quality = QUALITY } = {}) {
  const { source, cleanup } = await loadImage(file);
  try {
    const w = source.width || source.naturalWidth;
    const h = source.height || source.naturalHeight;
    if (!w || !h) throw new Error('이미지를 읽을 수 없어요');

    let dim = maxDim;
    let q = quality;
    let url = encode(source, w, h, dim, q);
    // Shrink before dropping quality: a smaller, sharper barcode scans better
    // than a large, artefact-ridden one.
    for (let i = 0; i < 3 && byteLength(url) > MAX_BYTES; i++) {
      dim = Math.round(dim * 0.8);
      q = Math.max(0.5, q - 0.06);
      url = encode(source, w, h, dim, q);
    }
    return url;
  } finally {
    cleanup();
  }
}

function encode(source, w, h, maxDim, quality) {
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const cx = canvas.getContext('2d');
  // Screenshots are pasted onto white: a transparent source would otherwise go
  // black on some viewers, and the barcode has to sit on a light ground to scan.
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, canvas.width, canvas.height);
  cx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', quality);
}

/** byteLength(dataURL) — decoded size of a data URL's payload, in bytes. */
export function byteLength(dataURL) {
  const i = String(dataURL || '').indexOf(',');
  if (i < 0) return 0;
  const b64 = dataURL.slice(i + 1);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(b64.length * 3 / 4) - pad);
}

// Prefer createImageBitmap (honours EXIF orientation); fall back to an <img> + object URL.
async function loadImage(file) {
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
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
 * Reads the first barcode/QR value out of the gifticon, or null when the platform
 * has no BarcodeDetector or nothing is found. Filling `code` from this lets the
 * detail view show a generated, sharp barcode instead of the screenshot.
 */
export async function detectCode(file) {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
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

/** supportsBarcodeScan() — whether the platform can auto-read codes from an image. */
export function supportsBarcodeScan() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}
