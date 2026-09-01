import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('site build', () => {
  it('writes dist/index.html with inlined catalog payload', async () => {
    await runBuild();
    const html = await readFile(join(root, 'dist', 'index.html'), 'utf8');
    assert.match(html, /<title>Awesome IPTV<\/title>/);
    assert.match(html, /window\.__AWESOME_IPTV__/);
    assert.match(html, /assets\/styles\.css/);
    assert.match(html, /IPTVnator/);

    const catalog = JSON.parse(
      await readFile(join(root, 'dist', 'catalog.json'), 'utf8'),
    );
    assert.equal(catalog.site.base, '/');
    assert.ok(catalog.catalog.entries.length > 50);
    assert.ok(catalog.catalog.counts.web > 0);
  });
});

function runBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/build-site.mjs'], {
      cwd: root,
      env: { ...process.env, SITE_BASE: '/' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`build failed (${code}): ${stderr}`));
      }
    });
  });
}
