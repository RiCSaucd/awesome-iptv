'use strict';

const { readFile } = require('node:fs/promises');
const { createRequire } = require('node:module');

const requireFromHere = createRequire(__filename);
const { parseM3U } = requireFromHere('../stremio-addon/src/m3u.js');

/**
 * @typedef {Object} HousePlaylistConfig
 * @property {string} playlistUrl
 * @property {number} ttlMs
 * @property {number} fetchTimeoutMs
 * @property {number} maxChannels
 * @property {string} userAgent
 */

/**
 * @param {HousePlaylistConfig} config
 */
function createPlaylistStore(config) {
  if (!config || typeof config.playlistUrl !== 'string' || config.playlistUrl.trim() === '') {
    throw new Error('playlistUrl is required');
  }

  /** @type {{ channels: object[], loadedAt: number, source: string }} */
  let cache = { channels: [], loadedAt: 0, source: config.playlistUrl };
  /** @type {Promise<typeof cache> | null} */
  let inFlight = null;

  async function readSource(source) {
    if (/^https?:\/\//i.test(source)) {
      const response = await fetch(source, {
        headers: { 'User-Agent': config.userAgent },
        signal: AbortSignal.timeout(config.fetchTimeoutMs),
      });
      if (!response.ok) {
        throw new Error(`playlist request failed: ${response.status}`);
      }
      return response.text();
    }
    return readFile(source, 'utf8');
  }

  async function load() {
    const text = await readSource(config.playlistUrl);
    let channels = parseM3U(text).map((channel) => ({
      id: channel.id,
      name: channel.name,
      url: channel.url,
      logo: channel.logo,
      group: channel.group,
    }));
    if (config.maxChannels > 0) {
      channels = channels.slice(0, config.maxChannels);
    }
    if (channels.length === 0) {
      throw new Error(`no channels found in ${config.playlistUrl}`);
    }
    cache = { channels, loadedAt: Date.now(), source: config.playlistUrl };
    return cache;
  }

  async function getPlaylist() {
    const fresh = cache.loadedAt && Date.now() - cache.loadedAt <= config.ttlMs;
    if (fresh) {
      return cache;
    }
    if (!inFlight) {
      inFlight = load()
        .catch((error) => {
          if (!cache.loadedAt) {
            throw error;
          }
          console.error(`[house] playlist refresh failed, serving cache: ${error.message}`);
          return cache;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  }

  return { getPlaylist };
}

module.exports = { createPlaylistStore };
