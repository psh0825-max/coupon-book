/* ===== Delight microinteractions ===== */

import { haptic as platformHaptic } from '../platform.js';

/**
 * haptic(kind) — light | medium | heavy | success | warning | error | selection.
 * Taptic Engine on iOS, vibration pattern elsewhere; silent when unsupported.
 */
export function haptic(kind = 'light') {
  platformHaptic(kind);
}

const CONFETTI_COLORS = ['#34d399', '#22d3ee', '#818cf8', '#fbbf24', '#fb7185', '#a855f7'];

export function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const layer = document.createElement('div');
  layer.className = 'confetti-layer';

  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--c', CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
    piece.style.left = (Math.random() * 100) + 'vw';
    piece.style.setProperty('--x', (Math.random() * 2 - 1).toFixed(2));
    piece.style.setProperty('--delay', (Math.random() * 0.2).toFixed(2) + 's');
    piece.style.setProperty('--dur', (1.6 + Math.random() * 1.2).toFixed(2) + 's');
    piece.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3200);
}
