'use strict'

const { readFile } = require('fs/promises')
const { parseM3U } = require('./m3u')
const config = require('./config')

let cache = { channels: [], byId: new Map(), genres: [], loadedAt: 0 }
let inFlight = null

async function readSource(source) {
    if (/^https?:\/\//i.test(source)) {
        const response = await fetch(source, {
            headers: { 'User-Agent': config.userAgent },
            signal: AbortSignal.timeout(config.fetchTimeoutMs)
        })
        if (!response.ok) {
            throw new Error(`playlist request failed: ${response.status} ${response.statusText}`)
        }
        return response.text()
    }
    return readFile(source, 'utf8')
}

function index(channels) {
    const byId = new Map()
    for (const channel of channels) byId.set(channel.id, channel)
    const genres = [...new Set(channels.map((channel) => channel.group))].sort((a, b) =>
        a.localeCompare(b)
    )
    return { byId, genres }
}

async function load() {
    const text = await readSource(config.playlistUrl)
    let channels = parseM3U(text)
    if (config.maxChannels > 0) channels = channels.slice(0, config.maxChannels)
    if (!channels.length) throw new Error(`no channels found in ${config.playlistUrl}`)
    cache = { channels, ...index(channels), loadedAt: Date.now() }
    console.log(`[playlist] loaded ${channels.length} channels from ${config.playlistUrl}`)
    return cache
}

function isStale() {
    return Date.now() - cache.loadedAt > config.ttlMs
}

/**
 * Returns the cached playlist, refreshing it when the TTL has expired.
 *
 * A refresh that fails while a previous snapshot is cached logs and keeps
 * serving the stale data — a temporary upstream outage should not empty the
 * catalog.
 */
async function getPlaylist() {
    if (cache.loadedAt && !isStale()) return cache

    if (!inFlight) {
        inFlight = load()
            .catch((err) => {
                if (!cache.loadedAt) throw err
                console.error(`[playlist] refresh failed, serving cached copy: ${err.message}`)
                return cache
            })
            .finally(() => {
                inFlight = null
            })
    }

    return inFlight
}

module.exports = { getPlaylist }
