// Picks how the e2e specs start the app server: the Flask app in the Windows
// venv when it exists (the original setup), otherwise the Node static server.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function appServerCommand(root) {
  const python = path.join(root, '.venv', 'Scripts', 'python.exe');
  if (process.platform === 'win32' && fs.existsSync(python)) return { command: python, args: ['app.py'] };
  return {
    command: process.execPath,
    args: [path.join(path.dirname(fileURLToPath(import.meta.url)), 'static-server.mjs')]
  };
}
