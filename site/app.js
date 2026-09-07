/**
 * Client catalog: filters README-derived entries using site.config.mjs data
 * that the builder inlined as window.__AWESOME_IPTV__.
 */

const payload = window.__AWESOME_IPTV__;

if (!payload || !payload.site || !payload.catalog) {
  throw new Error('Catalog payload is missing. Rebuild the site.');
}

const { site, catalog } = payload;
const searchInput = document.querySelector('#search');
const chipsRoot = document.querySelector('#filter-chips');
const resultsRoot = document.querySelector('#results');
const countRoot = document.querySelector('#result-count');

/** @type {string} */
let activeFilter = 'all';
/** @type {string} */
let query = '';

renderChips();
render();
bind();

function bind() {
  if (searchInput instanceof HTMLInputElement) {
    searchInput.addEventListener('input', () => {
      query = searchInput.value.trim().toLowerCase();
      render();
    });
  }

  window.addEventListener('hashchange', () => {
    const id = window.location.hash.replace(/^#/, '');
    if (!id) {
      return;
    }
    if (isKnownFilter(id)) {
      activeFilter = id;
      render();
    }
  });

  const initial = window.location.hash.replace(/^#/, '');
  if (initial && isKnownFilter(initial)) {
    activeFilter = initial;
    render();
  }
}

function renderChips() {
  if (!(chipsRoot instanceof HTMLElement)) {
    return;
  }

  const chips = [{ id: 'all', title: 'All', emoji: '✦' }, ...flattenSections()];
  chipsRoot.replaceChildren(
    ...chips.map((chip) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.dataset.filter = chip.id;
      button.setAttribute('aria-pressed', chip.id === activeFilter ? 'true' : 'false');
      button.textContent = `${chip.emoji ?? ''} ${chip.title}`.trim();
      button.addEventListener('click', () => {
        activeFilter = chip.id;
        if (chip.id === 'all') {
          history.replaceState(null, '', window.location.pathname);
        } else {
          history.replaceState(null, '', `#${chip.id}`);
        }
        renderChips();
        render();
      });
      return button;
    }),
  );
}

function render() {
  renderChips();
  if (!(resultsRoot instanceof HTMLElement) || !(countRoot instanceof HTMLElement)) {
    return;
  }

  const visible = catalog.entries.filter(matches);
  countRoot.textContent = String(visible.length);

  if (visible.length === 0) {
    resultsRoot.replaceChildren(paragraph('empty', 'No matching resources.'));
    return;
  }

  const groups = groupEntries(visible);
  resultsRoot.replaceChildren(...groups.map(renderGroup));
}

/**
 * @param {typeof catalog.entries[number]} entry
 */
function matches(entry) {
  if (activeFilter !== 'all') {
    const inSection = entry.sectionId === activeFilter;
    const inPlatform = entry.platformId === activeFilter;
    if (!inSection && !inPlatform) {
      return false;
    }
  }

  if (!query) {
    return true;
  }

  const haystack = `${entry.name} ${entry.description} ${entry.url}`.toLowerCase();
  return haystack.includes(query);
}

/**
 * @param {typeof catalog.entries} entries
 */
function groupEntries(entries) {
  /** @type {{ id: string, title: string, emoji?: string, entries: typeof entries }[]} */
  const groups = [];
  const index = new Map();

  for (const section of site.sections) {
    if (section.kind === 'prose') {
      continue;
    }
    if (section.kind === 'group' && Array.isArray(section.platforms)) {
      for (const platform of section.platforms) {
        const group = {
          id: platform.id,
          title: `${section.title} · ${platform.title}`,
          emoji: platform.emoji,
          entries: [],
        };
        index.set(platform.id, group);
        groups.push(group);
      }
      continue;
    }

    const group = {
      id: section.id,
      title: section.title,
      emoji: section.emoji,
      entries: [],
    };
    index.set(section.id, group);
    groups.push(group);
  }

  for (const entry of entries) {
    const key = entry.platformId ?? entry.sectionId;
    const group = index.get(key);
    if (group) {
      group.entries.push(entry);
    }
  }

  return groups.filter((group) => group.entries.length > 0);
}

/**
 * @param {{ id: string, title: string, emoji?: string, entries: typeof catalog.entries }} group
 */
function renderGroup(group) {
  const section = document.createElement('section');
  section.id = group.id;
  section.className = 'result-group';

  const head = document.createElement('div');
  head.className = 'section-head';
  const heading = document.createElement('h2');
  heading.textContent = `${group.emoji ?? ''} ${group.title}`.trim();
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = String(group.entries.length);
  head.append(heading, count);

  const cards = document.createElement('div');
  cards.className = 'cards';
  cards.append(...group.entries.map(renderCard));
  section.append(head, cards);
  return section;
}

/**
 * @param {typeof catalog.entries[number]} entry
 */
function renderCard(entry) {
  const article = document.createElement('article');
  article.className = 'card';

  const link = document.createElement('a');
  link.href = entry.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = entry.name;

  const description = document.createElement('p');
  description.textContent = entry.description || entry.url;

  article.append(link, description);
  return article;
}

function flattenSections() {
  /** @type {{ id: string, title: string, emoji?: string }[]} */
  const items = [];
  for (const section of site.sections) {
    if (section.kind === 'prose') {
      continue;
    }
    items.push({ id: section.id, title: section.title, emoji: section.emoji });
    if (section.kind === 'group' && Array.isArray(section.platforms)) {
      for (const platform of section.platforms) {
        items.push({
          id: platform.id,
          title: platform.title,
          emoji: platform.emoji,
        });
      }
    }
  }
  return items;
}

/**
 * @param {string} id
 */
function isKnownFilter(id) {
  return id === 'all' || flattenSections().some((item) => item.id === id);
}

/**
 * @param {string} className
 * @param {string} text
 */
function paragraph(className, text) {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  return p;
}
