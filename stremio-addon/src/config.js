'use strict'

const { version } = require('../package.json')

function integer(value, fallback) {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : fallback
}

module.exports = {
    // Any M3U/M3U8 URL or a path to a local playlist file.
    playlistUrl: process.env.IPTV_PLAYLIST_URL || 'https://iptv-org.github.io/iptv/index.m3u',
    port: integer(process.env.PORT, 7000),
    ttlMs: integer(process.env.IPTV_PLAYLIST_TTL_MINUTES, 60) * 60 * 1000,
    fetchTimeoutMs: integer(process.env.IPTV_FETCH_TIMEOUT_SECONDS, 30) * 1000,
    // 0 keeps every channel in the playlist.
    maxChannels: integer(process.env.IPTV_MAX_CHANNELS, 0),
    pageSize: integer(process.env.IPTV_PAGE_SIZE, 100),
    // Set to the public https URL of your manifest to list the addon publicly.
    publishUrl: process.env.IPTV_PUBLISH_URL || '',
    userAgent: process.env.IPTV_USER_AGENT || `awesome-iptv-stremio-addon/${version}`
}
