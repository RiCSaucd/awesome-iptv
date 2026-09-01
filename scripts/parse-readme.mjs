/**
 * Parse the Awesome IPTV README into catalog entries keyed by heading slug.
 *
 * The README is the listing source; `site.config.mjs` is the section map.
 * Keep this parser conservative: only `- [name](url)` list items are catalog
 * entries. Headings become GitHub-style slugs so they match the config ids.
 */

/**
 * @typedef {Object} CatalogEntry
 * @property {string} name
 * @property {string} url
 * @property {string} description
 * @property {string} sectionId
 * @property {string} [platformId]
 */

/**
 * @typedef {Object} ParsedReadme
 * @property {string} title
 * @property {Map<string, string>} prose Markdown body keyed by heading slug
 * @property {CatalogEntry[]} entries
 * @property {string[]} headingSlugs
 */

const SKIP_HEADING_SLUGS = new Set(['contents', 'license']);

/**
 * @param {string} markdown
 * @returns {ParsedReadme}
 */
export function parseReadme(markdown) {
  if (typeof markdown !== 'string') {
    throw new Error('README markdown must be a string');
  }

  const lines = markdown.split(/\r?\n/);
  /** @type {CatalogEntry[]} */
  const entries = [];
  /** @type {string[]} */
  const headingSlugs = [];
  /** @type {Map<string, string[]>} */
  const proseLines = new Map();

  let title = '';
  let sectionId = '';
  let platformId = '';

  for (const line of lines) {
    const h1 = line.match(/^# (.+)$/);
    if (h1) {
      title = h1[1].trim();
      continue;
    }

    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      sectionId = slugify(h2[1]);
      platformId = '';
      headingSlugs.push(sectionId);
      if (!proseLines.has(sectionId)) {
        proseLines.set(sectionId, []);
      }
      continue;
    }

    const h4 = line.match(/^#### (.+)$/);
    if (h4) {
      platformId = slugify(h4[1]);
      headingSlugs.push(platformId);
      continue;
    }

    if (!sectionId || SKIP_HEADING_SLUGS.has(sectionId)) {
      continue;
    }

    const item = parseListItem(line);
    if (item) {
      entries.push({
        name: item.name,
        url: item.url,
        description: item.description,
        sectionId,
        ...(platformId ? { platformId } : {}),
      });
      continue;
    }

    const bucket = proseLines.get(sectionId);
    if (bucket && line.trim() !== '' && !line.startsWith('#')) {
      bucket.push(line);
    }
  }

  /** @type {Map<string, string>} */
  const prose = new Map();
  for (const [id, body] of proseLines) {
    const text = body.join('\n').trim();
    if (text) {
      prose.set(id, text);
    }
  }

  return { title, prose, entries, headingSlugs };
}

/**
 * GitHub-compatible heading slug.
 *
 * @param {string} heading
 * @returns {string}
 */
export function slugify(heading) {
  if (typeof heading !== 'string' || heading.trim() === '') {
    throw new Error('Heading must be a non-empty string');
  }

  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

/**
 * @param {string} line
 * @returns {{ name: string, url: string, description: string } | null}
 */
export function parseListItem(line) {
  if (typeof line !== 'string') {
    return null;
  }

  const match = line.match(
    /^- \[([^\]]+)\]\(([^)]+)\)\s*[-–—]?\s*(.*)$/u,
  );
  if (!match) {
    return null;
  }

  const name = match[1].trim();
  const url = match[2].trim();
  const description = (match[3] ?? '').trim();

  if (!name || !url) {
    return null;
  }

  return { name, url, description };
}
