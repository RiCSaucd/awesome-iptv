#!/usr/bin/env node
/**
 * Serve dist/ on 127.0.0.1 for local preview.
 * Forces SITE_BASE=/ so asset paths match a local origin root.
 */

import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const port = Number.parseInt(process.env.PORT ?? '4173', 10);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error('PORT must be a positive integer');
}

await rebuild();
const server = createServer(handleRequest);
server.listen(port, '127.0.0.1', () => {
  console.log(`Preview: http://127.0.0.1:${port}/`);
});

async function rebuild() {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['scripts/build-site.mjs'], {
      cwd: root,
      env: { ...process.env, SITE_BASE: '/' },
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`build-site.mjs exited with code ${code}`));
      }
    });
  });
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function handleRequest(req, res) {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) {
    pathname = `${pathname}index.html`;
  }

  const filePath = resolve(dist, `.${pathname}`);
  const rel = relative(dist, filePath);
  if (rel.startsWith('..') || normalize(rel) !== rel) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const type = contentType(extname(filePath));
  res.writeHead(200, { 'Content-Type': type });
  createReadStream(filePath).pipe(res);
}

/**
 * @param {string} extension
 * @returns {string}
 */
function contentType(extension) {
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    default: {
      const _exhaustive = extension;
      void _exhaustive;
      return 'application/octet-stream';
    }
  }
}
