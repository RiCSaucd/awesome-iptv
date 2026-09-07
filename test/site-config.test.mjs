import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import site from '../site.config.mjs';
import { parseReadme, slugify } from '../scripts/parse-readme.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('site.config.mjs', () => {
  it('exports required site identity fields', () => {
    assert.equal(typeof site.name, 'string');
    assert.ok(site.name.length > 0);
    assert.equal(typeof site.title, 'string');
    assert.equal(typeof site.description, 'string');
    assert.equal(typeof site.githubUser, 'string');
    assert.equal(typeof site.repository, 'string');
    assert.match(site.githubUrl, /^https:\/\/github.com\//);
    assert.equal(site.sourceFile, 'README.md');
  });

  it('uses a root-absolute base path with a trailing slash', () => {
    assert.match(site.base, /^\/.*\/$/);
  });

  it('lists every README resource heading', async () => {
    const markdown = await readFile(join(root, site.sourceFile), 'utf8');
    const parsed = parseReadme(markdown);
    const configured = new Set(collectIds(site));

    const ignored = new Set(['contents', 'license', 'awesome-iptv']);
    const missing = parsed.headingSlugs.filter(
      (slug) => !configured.has(slug) && !ignored.has(slug),
    );

    assert.deepEqual(missing, [], `README headings missing from site.config.mjs: ${missing.join(', ')}`);
  });

  it('has unique section and platform ids', () => {
    const ids = collectIds(site);
    assert.equal(ids.length, new Set(ids).size);
  });

  it('nav links point at known section hashes or http urls', () => {
    const ids = new Set(collectIds(site));
    for (const item of site.nav) {
      assert.equal(typeof item.text, 'string');
      assert.equal(typeof item.link, 'string');
      if (item.link.startsWith('#')) {
        assert.ok(ids.has(item.link.slice(1)), `unknown nav hash ${item.link}`);
      } else {
        assert.match(item.link, /^https?:\/\//);
      }
    }
  });
});

describe('slugify', () => {
  it('matches GitHub-style README anchors used in this list', () => {
    assert.equal(slugify('Apple Vision Pro'), 'apple-vision-pro');
    assert.equal(slugify('EPG Sources'), 'epg-sources');
    assert.equal(slugify('Channel Datasets'), 'channel-datasets');
  });

  it('rejects empty headings', () => {
    assert.throws(() => slugify(''), /non-empty/);
  });
});

describe('parseReadme', () => {
  it('extracts list entries under h2 and h4 headings', () => {
    const parsed = parseReadme(`# Awesome IPTV

## Apps

#### Web

- [IPTVnator](https://example.com/nator) - Open-source player.
- [Moviepex](https://moviepex.com)- Super fast IPTV player.

## Providers

- [WatchIPTV](https://watchiptv.xyz) - Watch streams in the browser.
`);

    assert.equal(parsed.title, 'Awesome IPTV');
    assert.equal(parsed.entries.length, 3);
    assert.equal(parsed.entries[0].name, 'IPTVnator');
    assert.equal(parsed.entries[0].platformId, 'web');
    assert.equal(parsed.entries[0].sectionId, 'apps');
    assert.equal(parsed.entries[1].description, 'Super fast IPTV player.');
    assert.equal(parsed.entries[2].sectionId, 'providers');
    assert.equal(parsed.entries[2].platformId, undefined);
  });

  it('skips the contents table and non-link bullets', () => {
    const parsed = parseReadme(`# Awesome IPTV

## Contents

- [Apps](#apps)
  - [Web](#web)

## Contribution

Just please follow 4 simple rules:

- new links are added to the end of the section
`);

    assert.equal(parsed.entries.length, 0);
    assert.ok(parsed.prose.get('contribution')?.includes('4 simple rules'));
  });

  it('parses the real README into a non-empty catalog', async () => {
    const markdown = await readFile(join(root, site.sourceFile), 'utf8');
    const parsed = parseReadme(markdown);
    assert.ok(parsed.entries.length > 50);
    assert.ok(parsed.entries.every((entry) => entry.name && entry.url && entry.sectionId));
  });
});

/**
 * @param {typeof site} config
 * @returns {string[]}
 */
function collectIds(config) {
  /** @type {string[]} */
  const ids = [];
  for (const section of config.sections) {
    ids.push(section.id);
    if (section.kind === 'group') {
      for (const platform of section.platforms ?? []) {
        ids.push(platform.id);
      }
    }
  }
  return ids;
}
