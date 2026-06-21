// services/codes.js — zero-dep wrappers over the vendored QR/barcode globals
// (window.qrcode, window.JsBarcode). Each renderer returns a DOM node and degrades
// gracefully: any failure or missing global yields null so callers can fall back.

const SVG_NS = 'http://www.w3.org/2000/svg';

/** renderQR(text, {size}) -> inline <svg> | null */
export function renderQR(text, { size = 180 } = {}) {
  if (typeof window === 'undefined' || typeof window.qrcode !== 'function') return null;
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(String(text));
    qr.make();
    const n = qr.getModuleCount();
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `QR 코드: ${text}`);

    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(n));
    bg.setAttribute('height', String(n));
    bg.setAttribute('fill', '#ffffff');
    svg.appendChild(bg);

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        const cell = document.createElementNS(SVG_NS, 'rect');
        cell.setAttribute('x', String(c));
        cell.setAttribute('y', String(r));
        cell.setAttribute('width', '1');
        cell.setAttribute('height', '1');
        cell.setAttribute('fill', '#000000');
        svg.appendChild(cell);
      }
    }
    return svg;
  } catch (e) {
    return null;
  }
}

/** renderBarcode(text) -> inline <svg> (CODE128) | null */
export function renderBarcode(text) {
  if (typeof window === 'undefined' || typeof window.JsBarcode !== 'function') return null;
  try {
    const svg = document.createElementNS(SVG_NS, 'svg');
    window.JsBarcode(svg, String(text), {
      format: 'CODE128', displayValue: false, margin: 0, height: 64, width: 2
    });
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `바코드: ${text}`);
    return svg;
  } catch (e) {
    return null;
  }
}

/** copyCode(text) -> Promise<boolean> */
export async function copyCode(text) {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(String(text));
    return true;
  } catch (e) {
    return false;
  }
}
