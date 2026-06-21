// core/h.js — tiny hyperscript. Builds DOM with safe text by construction
// (string/number children become textContent, never innerHTML), eliminating
// manual escaping / XSS risk. innerHTML is used ONLY via props.html for trusted
// static SVG markup (the icon registry below).

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * h(tag, props?, ...children) -> HTMLElement
 * props: { class, id, style(obj|string), dataset:{}, attrs:{}, on:{event:fn},
 *          html (trusted static markup only), ref(fn) }
 * children: string|number (=> textContent, safe), Node, array, falsy(skipped)
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) applyProps(el, props);
  appendChildren(el, children);
  return el;
}

function applyProps(el, props) {
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === 'class') el.className = value;
    else if (key === 'id') el.id = value;
    else if (key === 'style') applyStyle(el, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'attrs') applyAttrs(el, value);
    else if (key === 'on') applyHandlers(el, value);
    else if (key === 'html') el.innerHTML = value; // trusted static markup only
    else if (key === 'ref') { if (typeof value === 'function') value(el); }
    else el.setAttribute(key, value);
  }
}

function applyStyle(el, style) {
  if (typeof style === 'string') { el.style.cssText = style; return; }
  for (const [prop, val] of Object.entries(style)) {
    if (val != null) el.style.setProperty(prop, val);
  }
}

function applyAttrs(el, attrs) {
  for (const [name, val] of Object.entries(attrs)) {
    if (val == null || val === false) continue;
    el.setAttribute(name, val === true ? '' : val);
  }
}

function applyHandlers(el, handlers) {
  for (const [event, fn] of Object.entries(handlers)) {
    if (typeof fn === 'function') el.addEventListener(event, fn);
  }
}

function appendChildren(el, children) {
  for (const child of children) {
    if (child == null || typeof child === 'boolean') continue; // falsy skipped
    if (Array.isArray(child)) { appendChildren(el, child); continue; }
    if (child instanceof Node) { el.appendChild(child); continue; }
    el.appendChild(document.createTextNode(String(child))); // safe text
  }
}

/** frag(...children) -> DocumentFragment */
export function frag(...children) {
  const f = document.createDocumentFragment();
  appendChildren(f, children);
  return f;
}

/** clear(node) — remove all children */
export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** mount(parent, node) — clear(parent) then append node */
export function mount(parent, node) {
  clear(parent);
  if (node != null) parent.appendChild(node instanceof Node ? node : document.createTextNode(String(node)));
  return parent;
}

// ── Central icon registry (§6) ───────────────────────────────────────────────
// Inner SVG markup only; each icon() call wraps it in an <svg aria-hidden> with
// stroke=currentColor so a single CSS color drives every icon.
const ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  history: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  back: '<polyline points="15 18 9 12 15 6"/>',
  'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  location: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9z"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  megaphone: '<path d="M3 11l15-5v12L3 14z"/><path d="M18 8a3 3 0 0 1 0 6"/><path d="M6 14v3a2 2 0 0 0 4 0v-2"/>',
  store: '<path d="M3 9l1.2-5h15.6L21 9"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M9 20v-6h6v6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  sparkle: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/>'
};

/** icon(name, opts?) -> inline <svg aria-hidden> from the central registry */
export function icon(name, opts = {}) {
  const size = opts.size || 24;
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', String(opts.strokeWidth || 2));
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  el.setAttribute('aria-hidden', 'true');
  if (opts.class) el.setAttribute('class', opts.class);
  el.innerHTML = ICONS[name] || ICONS.gift; // trusted static markup
  return el;
}

export { ICONS };
