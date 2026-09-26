#!/usr/bin/env node
/**
 * Serve the catalog. Bind HOST=0.0.0.0 (via `npm run home`) so phones and TVs
 * on the same Wi-Fi can open it. Forces SITE_BASE=/ for local asset paths.
 */

import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { listenHost, formatServiceUrls, requestHost } = require('./lan.cjs');
const { createPlaylistStore } = require('./playlist-store.cjs');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const siteDir = join(root, 'site');
const port = Number.parseInt(process.env.PORT ?? '4173', 10);
const host = listenHost(process.env.HOST, '127.0.0.1');
const addonPort = Number.parseInt(process.env.ADDON_PORT ?? '7000', 10);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error('PORT must be a positive integer');
}
if (!Number.isInteger(addonPort) || addonPort <= 0) {
  throw new Error('ADDON_PORT must be a positive integer');
}

const playlistStore = createPlaylistStore({
  playlistUrl: process.env.IPTV_PLAYLIST_URL || join(root, 'playlists', 'sample.m3u'),
  ttlMs: Number.parseInt(process.env.IPTV_PLAYLIST_TTL_MINUTES ?? '60', 10) * 60 * 1000,
  fetchTimeoutMs: Number.parseInt(process.env.IPTV_FETCH_TIMEOUT_SECONDS ?? '30', 10) * 1000,
  maxChannels: Number.parseInt(process.env.IPTV_MAX_CHANNELS ?? '0', 10),
  userAgent: process.env.IPTV_USER_AGENT || 'awesome-iptv-house/1.0',
});

const extraPages = new Map([
  ['/home', 'home.html'],
  ['/home.html', 'home.html'],
  ['/watch', 'watch.html'],
  ['/watch.html', 'watch.html'],
]);

const extraAssets = new Map([
  ['/assets/home.css', 'home.css'],
  ['/assets/home.js', 'home.js'],
  ['/assets/watch.css', 'watch.css'],
  ['/assets/watch.js', 'watch.js'],
]);

await rebuild();
const server = createServer((req, res) => {
  void handleRequest(req, res);
});
server.listen(port, host, () => {
  console.log(`Catalog listening on ${host}:${port}`);
  for (const url of formatServiceUrls({ port, path: '/' })) {
    console.log(`  ${url}`);
  }
  console.log('Watch:');
  for (const url of formatServiceUrls({ port, path: '/watch' })) {
    console.log(`  ${url}`);
  }
  console.log('This house:');
  for (const url of formatServiceUrls({ port, path: '/home' })) {
    console.log(`  ${url}`);
  }
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
async function handleRequest(req, res) {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/playlist') {
    await sendPlaylist(res);
    return;
  }

  if (pathname.endsWith('/')) {
    pathname = `${pathname}index.html`;
  }

  const extraPage = extraPages.get(pathname);
  if (extraPage) {
    await sendSiteFile(res, extraPage, injectHomePort);
    return;
  }

  const extraAsset = extraAssets.get(pathname);
  if (extraAsset) {
    sendFile(res, join(siteDir, extraAsset));
    return;
  }

  const filePath = resolve(dist, `.${pathname}`);
  const rel = relative(dist, filePath);
  if (rel.startsWith('..') || normalize(rel) !== rel) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (pathname === '/index.html' || pathname === '/index.htm') {
    await sendCatalogIndex(res, filePath, req);
    return;
  }

  sendFile(res, filePath);
}

/**
 * @param {import('node:http').ServerResponse} res
 */
async function sendPlaylist(res) {
  try {
    const playlist = await playlistStore.getPlaylist();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ source: playlist.source, channels: playlist.channels }));
  } catch (error) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'playlist unavailable',
      }),
    );
  }
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {string} filePath
 * @param {import('node:http').IncomingMessage} req
 */
async function sendCatalogIndex(res, filePath, req) {
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const { hostname } = requestHost(req.headers.host, port);
  let html = await readFile(filePath, 'utf8');
  html = html.replace(
    '</nav>',
    `<a href="/watch">Watch</a><a href="/home">This house</a></nav>`,
  );
  html = html.replace(
    '</body>',
    `<script>window.__HOME_ADDON_PORT__ = ${JSON.stringify(String(addonPort))};window.__HOME_HOST__ = ${JSON.stringify(hostname)};</script></body>`,
  );
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(html);
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {string} filename
 * @param {(html: string) => string} transform
 */
async function sendSiteFile(res, filename, transform) {
  const filePath = join(siteDir, filename);
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  let html = await readFile(filePath, 'utf8');
  html = transform(html);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(html);
}

/**
 * @param {string} html
 * @returns {string}
 */
function injectHomePort(html) {
  return html.replace(
    '</body>',
    `<script>window.__HOME_ADDON_PORT__ = ${JSON.stringify(String(addonPort))};</script></body>`,
  );
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {string} filePath
 */
function sendFile(res, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': contentType(extname(filePath)),
    'Cache-Control': extensionCacheControl(extname(filePath)),
  });
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
    case '.ico':
      return 'image/x-icon';
    case '.m3u':
    case '.m3u8':
      return 'application/vnd.apple.mpegurl';
    default: {
      const _exhaustive = extension;
      void _exhaustive;
      return 'application/octet-stream';
    }
  }
}

/**
 * @param {string} extension
 * @returns {string}
 */
function extensionCacheControl(extension) {
  switch (extension) {
    case '.html':
    case '.js':
    case '.css':
      return 'no-store';
    default:
      return 'public, max-age=300';
  }
}
