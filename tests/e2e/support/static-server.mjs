// Node twin of app.py for e2e runs where the Flask venv is not installed
// (macOS/Linux). Same contract: static/ files, index.html fallback, /healthz,
// port from COUPON_BOOK_PORT.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STATIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../static');
const PORT = Number(process.env.COUPON_BOOK_PORT || 7789);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, app: 'coupon-book' }));
    return;
  }
  let file = path.resolve(STATIC_DIR, '.' + decodeURIComponent(pathname));
  const inside = file.startsWith(STATIC_DIR + path.sep);
  if (!inside || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(STATIC_DIR, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1');
