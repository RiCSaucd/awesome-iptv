#!/usr/bin/env node
/**
 * Start the house stack: catalog + Watch on :4173, Stremio addon on :7000.
 * Binds 0.0.0.0 so other devices on the Wi-Fi can reach the catalog.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { formatServiceUrls, listenHost } = require('./lan.cjs');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPort = Number.parseInt(process.env.PORT ?? '4173', 10);
const addonPort = Number.parseInt(process.env.ADDON_PORT ?? '7000', 10);
const host = listenHost(process.env.HOST, '0.0.0.0');

if (!Number.isInteger(catalogPort) || catalogPort <= 0) {
  throw new Error('PORT must be a positive integer');
}
if (!Number.isInteger(addonPort) || addonPort <= 0) {
  throw new Error('ADDON_PORT must be a positive integer');
}

const children = [];

function start(label, args, options) {
  const child = spawn(process.execPath, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      return;
    }
    console.error(`[${label}] exited with code ${code}`);
    shutdown(code === 0 ? 0 : 1);
  });
  children.push(child);
}

function shutdown(code) {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const playlistUrl =
  process.env.IPTV_PLAYLIST_URL || join(root, 'playlists', 'sample.m3u');

console.log('House stack');
console.log(`  Playlist: ${playlistUrl}`);
console.log('  Catalog / Watch:');
for (const url of formatServiceUrls({ port: catalogPort, path: '/' })) {
  console.log(`    ${url}`);
}
console.log('  Stremio on this computer:');
console.log(`    http://127.0.0.1:${addonPort}/manifest.json`);
console.log('  Stremio on other devices needs HTTPS; use Watch in a browser instead.');

start('catalog', ['scripts/preview.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    HOST: host,
    PORT: String(catalogPort),
    ADDON_PORT: String(addonPort),
    SITE_BASE: '/',
    IPTV_PLAYLIST_URL: playlistUrl,
  },
});

const addonEntry = join(root, 'stremio-addon', 'src', 'index.js');
const addonModules = join(root, 'stremio-addon', 'node_modules');
if (!existsSync(addonEntry)) {
  console.warn('[addon] stremio-addon is missing; catalog-only mode');
} else if (!existsSync(addonModules)) {
  console.warn(
    '[addon] run `npm install` in stremio-addon/ to serve the Stremio addon on this computer',
  );
} else {
  start('addon', [addonEntry], {
    cwd: join(root, 'stremio-addon'),
    env: {
      ...process.env,
      HOST: host,
      PORT: String(addonPort),
      IPTV_PLAYLIST_URL: playlistUrl,
    },
  });
}
