// ui/art.js — inline SVG illustrations in the brand language (blue→cyan
// gradient, soft rounded shapes). Zero-dependency vector art keeps the bundle
// tiny and always matches the design tokens. Each export returns a fresh DOM
// node (safe to append anywhere).

const GRAD = `
  <defs>
    <linearGradient id="ag" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563EB"/><stop offset="1" stop-color="#06B6D4"/>
    </linearGradient>
    <linearGradient id="ag2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#DBEAFE"/><stop offset="1" stop-color="#CFFAFE"/>
    </linearGradient>
  </defs>`;

const ART = {
  // Welcome: a wallet holding coupon cards.
  wallet: `
  <svg viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${GRAD}
    <circle cx="110" cy="78" r="62" fill="url(#ag2)" opacity=".55"/>
    <rect x="52" y="34" width="96" height="62" rx="10" fill="#fff" stroke="#E2E8F0" transform="rotate(-8 100 65)"/>
    <circle cx="70" cy="52" r="6" fill="url(#ag)" opacity=".35" transform="rotate(-8 100 65)"/>
    <rect x="86" y="46" width="52" height="7" rx="3.5" fill="#E2E8F0" transform="rotate(-8 100 65)"/>
    <rect x="86" y="60" width="36" height="7" rx="3.5" fill="#EFF6FF" transform="rotate(-8 100 65)"/>
    <rect x="60" y="56" width="104" height="66" rx="12" fill="url(#ag)"/>
    <path d="M60 74h104" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-dasharray="5 6"/>
    <circle cx="60" cy="74" r="6" fill="#F7F9FB"/><circle cx="164" cy="74" r="6" fill="#F7F9FB"/>
    <path d="M96 96l8 9 16-18" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="176" cy="46" r="4" fill="#06B6D4"/><circle cx="42" cy="106" r="3" fill="#2563EB" opacity=".5"/>
    <circle cx="186" cy="112" r="5" fill="#FBBF24" opacity=".8"/>
  </svg>`,

  // Get started: a stamp card gaining a new stamp.
  stamps: `
  <svg viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${GRAD}
    <circle cx="110" cy="76" r="62" fill="url(#ag2)" opacity=".55"/>
    <rect x="42" y="42" width="136" height="70" rx="14" fill="#fff" stroke="#E2E8F0"/>
    <g fill="url(#ag)">
      <circle cx="66" cy="66" r="9"/><circle cx="94" cy="66" r="9"/><circle cx="122" cy="66" r="9"/>
    </g>
    <g fill="none" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="3 4">
      <circle cx="150" cy="66" r="8"/><circle cx="66" cy="92" r="8"/><circle cx="94" cy="92" r="8"/>
    </g>
    <g stroke="#fff" stroke-width="3" stroke-linecap="round">
      <path d="M62 66l3 3 6-7M90 66l3 3 6-7M118 66l3 3 6-7"/>
    </g>
    <circle cx="160" cy="104" r="22" fill="url(#ag)"/>
    <path d="M160 95v18M151 104h18" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <circle cx="44" cy="34" r="4" fill="#06B6D4"/><circle cx="184" cy="38" r="3" fill="#2563EB" opacity=".5"/>
  </svg>`,

  // Reminders: a bell with a D-3 tag.
  bell: `
  <svg viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${GRAD}
    <circle cx="110" cy="78" r="62" fill="url(#ag2)" opacity=".55"/>
    <path d="M110 34c-20 0-32 14-32 32v14l-9 14a4 4 0 003 6h76a4 4 0 003-6l-9-14V66c0-18-12-32-32-32z" fill="url(#ag)"/>
    <path d="M100 104a10 10 0 0020 0" fill="#1D4ED8"/>
    <circle cx="110" cy="30" r="5" fill="url(#ag)"/>
    <g transform="rotate(14 158 52)">
      <rect x="140" y="40" width="44" height="24" rx="8" fill="#fff" stroke="#E2E8F0"/>
      <text x="162" y="57" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#2563EB">D-3</text>
    </g>
    <path d="M64 46c-4 4-7 10-8 16M156 118c6-2 11-6 14-11" stroke="#93C5FD" stroke-width="3" stroke-linecap="round" fill="none"/>
  </svg>`,

  // Empty state: a floating ticket waiting to be added.
  ticket: `
  <svg viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${GRAD}
    <circle cx="110" cy="80" r="56" fill="url(#ag2)" opacity=".5"/>
    <g transform="rotate(-6 110 74)">
      <rect x="56" y="46" width="108" height="56" rx="12" fill="url(#ag)"/>
      <path d="M56 74h108" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-dasharray="5 6"/>
      <circle cx="56" cy="74" r="6" fill="#F7F9FB"/><circle cx="164" cy="74" r="6" fill="#F7F9FB"/>
      <path d="M92 66l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill="#FBBF24"/>
    </g>
    <circle cx="170" cy="42" r="4" fill="#06B6D4"/><circle cx="50" cy="116" r="3" fill="#2563EB" opacity=".5"/>
    <path d="M150 116q8 8 18 6" stroke="#93C5FD" stroke-width="3" stroke-linecap="round" fill="none"/>
  </svg>`
};

/** svgArt(name) -> div.art-illust containing the illustration (or null). */
export function svgArt(name) {
  const markup = ART[name];
  if (!markup) return null;
  const wrap = document.createElement('div');
  wrap.className = 'art-illust';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = markup;
  return wrap;
}

// Richer raster renditions (brand-styled, ~10KB WebP each). The inline SVG
// above doubles as the fallback when the file fails to load (offline before
// first precache, decode error, …).
const RASTER = {
  wallet: 'art/onb-wallet.webp',
  stamps: 'art/onb-stamps.webp',
  bell: 'art/onb-bell.webp',
  ticket: 'art/empty-ticket.webp'
};

// Ambient video renditions (Veo-generated, ping-pong seamless loops, ~260KB).
// Motion is decoration only: reduced-motion users and any load failure fall
// back to the raster (which itself falls back to the inline SVG).
const VIDEO = {
  wallet: 'art/welcome-loop.mp4',
  ticket: 'art/welcome-loop.mp4'
};

function rasterInto(wrap, name) {
  const img = document.createElement('img');
  img.src = RASTER[name];
  img.alt = '';
  img.width = 840;
  img.height = 627;
  img.decoding = 'async';
  img.addEventListener('error', () => {
    const fallback = svgArt(name);
    if (fallback) wrap.replaceChildren(...fallback.childNodes);
  });
  wrap.replaceChildren(img);
}

/** illust(name) -> div.art-illust: ambient video > WebP > inline SVG. */
export function illust(name) {
  if (!RASTER[name]) return svgArt(name);
  const wrap = document.createElement('div');
  wrap.className = 'art-illust';
  wrap.setAttribute('aria-hidden', 'true');

  const reduceMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const videoSrc = VIDEO[name];
  if (videoSrc && !reduceMotion) {
    const video = document.createElement('video');
    video.src = videoSrc;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.poster = RASTER[name];
    video.width = 640;
    video.height = 480;
    video.addEventListener('error', () => rasterInto(wrap, name));
    // Some browsers block autoplay despite muted; fall back to the still.
    video.play?.().catch(() => rasterInto(wrap, name));
    wrap.appendChild(video);
    return wrap;
  }

  rasterInto(wrap, name);
  return wrap;
}
