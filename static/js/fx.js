/* ===== Delight microinteractions ===== */

const HAPTIC_PATTERNS = {
  light: 10,
  medium: 20,
  heavy: [30, 40, 30]
};

export function haptic(intensity = 'light') {
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(HAPTIC_PATTERNS[intensity] || HAPTIC_PATTERNS.light);
  } catch (e) {
    // no-op if unsupported
  }
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
