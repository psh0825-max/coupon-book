#!/usr/bin/env node
// scripts/serve.mjs — dependency-free static server for static/ (dev, tests,
// screenshot capture). Mirrors the GitHub Pages deployment: files are served
// as-is and unknown paths fall back to index.html.
//   node scripts/serve.mjs [port]   (default 7789)

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'static');
const PORT = Number(process.argv[2] || process.env.COUPON_BOOK_PORT || 7789);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const target = path.resolve(ROOT, '.' + clean);
  if (!target.startsWith(ROOT)) return null;
  try {
    const st = await fs.stat(target);
    if (st.isFile()) return target;
    if (st.isDirectory()) {
      const idx = path.join(target, 'index.html');
      await fs.stat(idx);
      return idx;
    }
  } catch { /* fall through */ }
  return null;
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, app: 'coupon-book' }));
    return;
  }
  const file = (await resolveFile(req.url || '/')) || path.join(ROOT, 'index.html');
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[CouponBook] http://127.0.0.1:${PORT}`);
});
