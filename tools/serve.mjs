/* Zero-dependency static server for local preview.  node tools/serve.mjs [port] */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 4321;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';

    // keep the request inside ROOT
    const abs = normalize(join(ROOT, p));
    if (!abs.startsWith(ROOT + sep) && abs !== ROOT) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(abs).catch(() => null);
    if (!info || info.isDirectory()) {
      const body = await readFile(join(ROOT, '404.html')).catch(() => 'Not found');
      res.writeHead(404, { 'content-type': TYPES['.html'] }).end(body);
      return;
    }

    const body = await readFile(abs);
    res.writeHead(200, {
      'content-type': TYPES[extname(abs)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    }).end(body);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
}).listen(PORT, () => {
  console.log(`HOODESKS  →  http://localhost:${PORT}`);
});
