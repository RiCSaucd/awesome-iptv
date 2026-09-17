import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { createPlaylistStore } = require('../scripts/playlist-store.cjs');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sample = join(root, 'playlists', 'sample.m3u');
const PORT = 4179;

describe('house playlist store', () => {
  it('parses the bundled sample playlist', async () => {
    const store = createPlaylistStore({
      playlistUrl: sample,
      ttlMs: 60_000,
      fetchTimeoutMs: 5_000,
      maxChannels: 0,
      userAgent: 'test',
    });
    const playlist = await store.getPlaylist();
    assert.equal(playlist.channels.length, 2);
    assert.equal(playlist.channels[0].name, 'Big Buck Bunny');
    assert.ok(playlist.channels[0].url.startsWith('https://'));
  });

  it('rejects a missing playlistUrl', () => {
    assert.throws(() => createPlaylistStore({ playlistUrl: '' }), /required/);
  });
});

describe('house server', () => {
  /** @type {import('node:child_process').ChildProcess | null} */
  let child = null;

  it('serves /home, /watch, and /api/playlist on localhost', async () => {
    child = await startPreview();
    const home = await fetch(`http://127.0.0.1:${PORT}/home`);
    assert.equal(home.status, 200);
    const homeHtml = await home.text();
    assert.match(homeHtml, /Use this in the house/);
    assert.match(homeHtml, /__HOME_ADDON_PORT__/);

    const watch = await fetch(`http://127.0.0.1:${PORT}/watch`);
    assert.equal(watch.status, 200);
    assert.match(await watch.text(), /Pick a channel/);

    const catalog = await fetch(`http://127.0.0.1:${PORT}/`);
    assert.equal(catalog.status, 200);
    const catalogHtml = await catalog.text();
    assert.match(catalogHtml, /href="\/watch"/);
    assert.match(catalogHtml, /href="\/home"/);

    const playlist = await fetch(`http://127.0.0.1:${PORT}/api/playlist`);
    assert.equal(playlist.status, 200);
    const body = await playlist.json();
    assert.ok(body.channels.length >= 2);
  });

  after(() => {
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  });
});

function startPreview() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['scripts/preview.mjs'], {
      cwd: root,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(PORT),
        SITE_BASE: '/',
        IPTV_PLAYLIST_URL: sample,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let started = false;
    let stdout = '';
    const onData = (chunk) => {
      stdout += chunk;
      if (!started && stdout.includes('Catalog listening')) {
        started = true;
        resolve(proc);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('exit', (code) => {
      if (!started) {
        reject(new Error(`preview exited ${code}: ${stdout}`));
      }
    });
    setTimeout(() => {
      if (!started) {
        proc.kill('SIGTERM');
        reject(new Error(`preview did not start: ${stdout}`));
      }
    }, 15_000);
  });
}
