/**
 * Local development shim for the WebWaka OS Platform Admin.
 *
 * Production target: Cloudflare Workers (TDR-0002).
 * This file is a LOCAL DEV ONLY static file server using Node.js built-ins.
 * No third-party server framework — Platform Invariant T1 compliance.
 *
 * NOT deployed to production. Replaced by Cloudflare Pages in staging/production.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = 5000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const requestPath = req.url === '/' ? '/index.html' : (req.url ?? '/index.html');

  if (requestPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', app: 'WebWaka OS Platform Admin', milestone: 2 }));
    return;
  }

  const filePath = path.join(PUBLIC_DIR, requestPath);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`WebWaka OS Platform Admin (local dev shim) running on http://0.0.0.0:${PORT}`);
  console.log(`Serving static files from: ${PUBLIC_DIR}`);
});
