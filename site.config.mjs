/**
 * Site configuration for the Awesome IPTV catalog.
 *
 * This is the one file to edit when the published site's name, address,
 * navigation, or section map should change. The static builder
 * (`scripts/build-site.mjs`) and tests import it as the source of truth;
 * the README remains the source of the actual listings.
 *
 * GitHub Pages serves the site at `https://{githubUser}.github.io/{repository}/`.
 * Local preview (`npm run preview`) forces `base` to `/` via SITE_BASE.
 */

const githubUser = 'RiCSaucd';
const repository = 'awesome-iptv';
const defaultBase = `/${repository}/`;

/** Root-absolute path the site is served under, always with a trailing slash. */
const base = normalizeBase(process.env.SITE_BASE ?? defaultBase);

/**
 * @typedef {Object} NavLink
 * @property {string} text
 * @property {string} link Hash or absolute URL
 */

/**
 * @typedef {Object} Platform
 * @property {string} id GitHub-style heading slug (e.g. "apple-tv")
 * @property {string} title
 * @property {string} [emoji]
 */

/**
 * @typedef {Object} CatalogSection
 * @property {string} id GitHub-style heading slug matching the README
 * @property {string} title
 * @property {string} emoji
 * @property {string} description
 * @property {'list' | 'group' | 'prose'} kind
 * @property {Platform[]} [platforms] Present when kind is "group"
 */

/**
 * @typedef {Object} SiteConfig
 * @property {string} name
 * @property {string} title
 * @property {string} description
 * @property {string} origin
 * @property {string} base
 * @property {string} githubUser
 * @property {string} repository
 * @property {string} githubUrl
 * @property {string} sourceFile
 * @property {string} license
 * @property {string} licenseUrl
 * @property {string} themeColor
 * @property {NavLink[]} nav
 * @property {CatalogSection[]} sections
 * @property {{ enabled: boolean, placeholder: string }} search
 */

/** @type {Platform[]} */
const appPlatforms = [
  { id: 'web', title: 'Web', emoji: '🌐' },
  { id: 'windows', title: 'Windows', emoji: '🪟' },
  { id: 'macos', title: 'macOS', emoji: '' },
  { id: 'linux', title: 'Linux', emoji: '🐧' },
  { id: 'android', title: 'Android', emoji: '🤖' },
  { id: 'iphone', title: 'iPhone', emoji: '📱' },
  { id: 'ipad', title: 'iPad', emoji: '📲' },
  { id: 'apple-watch', title: 'Apple Watch', emoji: '⌚' },
  { id: 'apple-tv', title: 'Apple TV', emoji: '📺' },
  { id: 'apple-vision-pro', title: 'Apple Vision Pro', emoji: '🥽' },
  { id: 'android-tv', title: 'Android TV', emoji: '📡' },
  { id: 'webos', title: 'WebOS', emoji: '🖥️' },
  { id: 'roku', title: 'Roku', emoji: '▶️' },
  { id: 'xbox', title: 'Xbox', emoji: '🎮' },
  { id: 'google-chrome', title: 'Google Chrome', emoji: '🌍' },
  { id: 'docker', title: 'Docker', emoji: '🐳' },
];

/** @type {CatalogSection[]} */
const sections = [
  {
    id: 'apps',
    title: 'Apps',
    emoji: '💻',
    description: 'Applications with support of IPTV streams.',
    kind: 'group',
    platforms: appPlatforms,
  },
  {
    id: 'providers',
    title: 'Providers',
    emoji: '📡',
    description: 'Public IPTV providers, playlists, and live-TV catalogs.',
    kind: 'list',
  },
  {
    id: 'channel-datasets',
    title: 'Channel Datasets',
    emoji: '🗄️',
    description: 'Sources containing information about TV channels.',
    kind: 'list',
  },
  {
    id: 'epg-sources',
    title: 'EPG Sources',
    emoji: '🗓',
    description: 'Electronic Program Guide sources for IPTV channels.',
    kind: 'list',
  },
  {
    id: 'programming',
    title: 'Programming',
    emoji: '👨🏻‍💻',
    description: 'Libraries and frameworks for working with IPTV data.',
    kind: 'list',
  },
  {
    id: 'contribution',
    title: 'Contribution',
    emoji: '📝',
    description: 'How to add or update entries in this list.',
    kind: 'prose',
  },
];

/** @type {SiteConfig} */
const site = {
  name: 'Awesome IPTV',
  title: 'Awesome IPTV',
  description: 'A curated list of resources related to IPTV.',
  origin: `https://${githubUser.toLowerCase()}.github.io`,
  base,
  githubUser,
  repository,
  githubUrl: `https://github.com/${githubUser}/${repository}`,
  sourceFile: 'README.md',
  license: 'CC0-1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  themeColor: '#c45c26',
  nav: [
    { text: 'Apps', link: '#apps' },
    { text: 'Providers', link: '#providers' },
    { text: 'Datasets', link: '#channel-datasets' },
    { text: 'EPG', link: '#epg-sources' },
    { text: 'Programming', link: '#programming' },
    { text: 'GitHub', link: `https://github.com/${githubUser}/${repository}` },
  ],
  sections,
  search: {
    enabled: true,
    placeholder: 'Search apps, providers, EPG, libraries…',
  },
};

export default site;

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeBase(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('SITE_BASE must be a non-empty string');
  }

  let next = value.trim();
  if (!next.startsWith('/')) {
    next = `/${next}`;
  }
  if (!next.endsWith('/')) {
    next = `${next}/`;
  }
  return next;
}
