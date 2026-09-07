/**
 * Build a static catalog site from README.md + site.config.mjs.
 *
 * Output lives in dist/. Asset paths honor config.base so the same build
 * works on GitHub Pages (`/awesome-iptv/`) and local preview (`/`).
 */

import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import site from '../site.config.mjs';
import { parseReadme } from './parse-readme.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const siteDir = join(root, 'site');

await build();

async function build() {
  validateConfig(site);

  const markdown = await readFile(join(root, site.sourceFile), 'utf8');
  const parsed = parseReadme(markdown);
  const catalog = assembleCatalog(site, parsed);

  await mkdir(join(dist, 'assets'), { recursive: true });
  await copyFile(join(siteDir, 'styles.css'), join(dist, 'assets', 'styles.css'));
  await copyFile(join(siteDir, 'app.js'), join(dist, 'assets', 'app.js'));
  await copyFile(join(siteDir, 'favicon.svg'), join(dist, 'assets', 'favicon.svg'));
  await copyFile(join(siteDir, 'favicon.ico'), join(dist, 'favicon.ico'));

  const html = renderHtml(site, catalog);
  await writeFile(join(dist, 'index.html'), html, 'utf8');
  await writeFile(
    join(dist, 'catalog.json'),
    `${JSON.stringify({ site: publicSite(site), catalog }, null, 2)}\n`,
    'utf8',
  );

  console.log(
    `Built ${catalog.entries.length} entries → ${dist} (base ${site.base})`,
  );
}

/**
 * @param {typeof site} config
 */
function validateConfig(config) {
  const required = [
    'name',
    'title',
    'description',
    'origin',
    'base',
    'githubUser',
    'repository',
    'githubUrl',
    'sourceFile',
    'nav',
    'sections',
  ];

  for (const key of required) {
    if (config[key] === undefined || config[key] === null || config[key] === '') {
      throw new Error(`site.config.mjs is missing required field "${key}"`);
    }
  }

  if (!config.base.startsWith('/') || !config.base.endsWith('/')) {
    throw new Error('site.config.mjs "base" must start and end with "/"');
  }

  if (!Array.isArray(config.sections) || config.sections.length === 0) {
    throw new Error('site.config.mjs "sections" must be a non-empty array');
  }
}

/**
 * @param {typeof site} config
 * @param {import('./parse-readme.mjs').ParsedReadme} parsed
 */
function assembleCatalog(config, parsed) {
  const knownIds = new Set(allSectionIds(config));
  const entries = parsed.entries.filter((entry) => {
    if (entry.platformId) {
      return knownIds.has(entry.platformId);
    }
    return knownIds.has(entry.sectionId);
  });

  /** @type {Record<string, number>} */
  const counts = {};
  for (const id of knownIds) {
    counts[id] = 0;
  }
  for (const entry of entries) {
    counts[entry.sectionId] = (counts[entry.sectionId] ?? 0) + 1;
    if (entry.platformId) {
      counts[entry.platformId] = (counts[entry.platformId] ?? 0) + 1;
    }
  }

  return {
    title: parsed.title || config.title,
    generatedAt: new Date().toISOString(),
    entries,
    counts,
    prose: Object.fromEntries(parsed.prose),
  };
}

/**
 * @param {typeof site} config
 * @returns {string[]}
 */
function allSectionIds(config) {
  /** @type {string[]} */
  const ids = [];
  for (const section of config.sections) {
    ids.push(section.id);
    if (section.kind === 'group' && Array.isArray(section.platforms)) {
      for (const platform of section.platforms) {
        ids.push(platform.id);
      }
    }
  }
  return ids;
}

/**
 * @param {typeof site} config
 */
function publicSite(config) {
  return {
    name: config.name,
    title: config.title,
    description: config.description,
    origin: config.origin,
    base: config.base,
    githubUrl: config.githubUrl,
    license: config.license,
    licenseUrl: config.licenseUrl,
    themeColor: config.themeColor,
    nav: config.nav,
    sections: config.sections,
    search: config.search,
  };
}

/**
 * @param {typeof site} config
 * @param {ReturnType<typeof assembleCatalog>} catalog
 */
function renderHtml(config, catalog) {
  const asset = (file) => `${config.base}assets/${file}`;
  const canonical = `${config.origin}${config.base}`;
  const payload = JSON.stringify({ site: publicSite(config), catalog }).replace(
    /</g,
    '\\u003c',
  );

  const nav = config.nav
    .map((item) => {
      const external = item.link.startsWith('http');
      const attrs = external
        ? ' target="_blank" rel="noopener noreferrer"'
        : '';
      return `<a href="${escapeHtml(item.link)}"${attrs}>${escapeHtml(item.text)}</a>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(config.title)}</title>
  <meta name="description" content="${escapeHtml(config.description)}">
  <meta name="theme-color" content="${escapeHtml(config.themeColor)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" href="${escapeHtml(config.base)}favicon.ico" sizes="any">
  <link rel="icon" href="${escapeHtml(asset('favicon.svg'))}" type="image/svg+xml">
  <link rel="stylesheet" href="${escapeHtml(asset('styles.css'))}">
</head>
<body>
  <a class="skip-link" href="#catalog">Skip to catalog</a>
  <header class="topbar">
    <div class="brand">
      <a href="${escapeHtml(config.base)}" class="logo">${escapeHtml(config.name)}</a>
      <p class="tagline">${escapeHtml(config.description)}</p>
    </div>
    <nav class="nav" aria-label="Primary">${nav}</nav>
  </header>
  <main>
    <section class="hero">
      <p class="kicker">Curated catalog</p>
      <h1>${escapeHtml(config.title)}</h1>
      <p class="lede">${escapeHtml(config.description)} Listings come from <a href="${escapeHtml(config.githubUrl)}">${escapeHtml(config.sourceFile)}</a>; this page is generated from <code>site.config.mjs</code>.</p>
      ${
        config.search.enabled
          ? `<label class="search">
              <span class="visually-hidden">Search the catalog</span>
              <input id="search" type="search" placeholder="${escapeHtml(config.search.placeholder)}" autocomplete="off">
            </label>`
          : ''
      }
      <p class="meta"><span id="result-count">${catalog.entries.length}</span> resources</p>
    </section>
    <div id="catalog" class="layout">
      <aside class="filters" aria-label="Section filters">
        <p class="filters-label">Browse</p>
        <div id="filter-chips" class="chips"></div>
      </aside>
      <div id="results" class="results"></div>
    </div>
  </main>
  <footer class="footer">
    <p>Source: <a href="${escapeHtml(config.githubUrl)}">${escapeHtml(config.githubUser)}/${escapeHtml(config.repository)}</a></p>
    <p>License: <a href="${escapeHtml(config.licenseUrl)}">${escapeHtml(config.license)}</a></p>
  </footer>
  <script>window.__AWESOME_IPTV__ = ${payload};</script>
  <script src="${escapeHtml(asset('app.js'))}" type="module"></script>
</body>
</html>
`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
