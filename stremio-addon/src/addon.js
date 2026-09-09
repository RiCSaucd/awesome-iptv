'use strict'

const { addonBuilder } = require('stremio-addon-sdk')
const { version, description } = require('../package.json')
const { getPlaylist } = require('./playlist')
const config = require('./config')

const CATALOG_ID = 'awesome-iptv-channels'
const TYPE = 'tv'

// Serve responses from Stremio's cache for a fraction of the playlist TTL so a
// refreshed playlist reaches clients reasonably soon.
const cacheMaxAge = Math.max(60, Math.round(config.ttlMs / 1000 / 4))

function toMeta(channel) {
    return {
        id: channel.id,
        type: TYPE,
        name: channel.name,
        poster: channel.logo || undefined,
        posterShape: 'square',
        logo: channel.logo || undefined,
        background: channel.logo || undefined,
        genres: [channel.group],
        description: [channel.group, channel.country, channel.language]
            .filter(Boolean)
            .join(' · ')
    }
}

function toStream(channel) {
    const hasHeaders = Object.keys(channel.headers).length > 0
    // The web player blocks plain http streams on an https page, and
    // proxyHeaders is only honoured together with notWebReady.
    const notWebReady = hasHeaders || !/^https:/i.test(channel.url)

    const stream = {
        url: channel.url,
        name: 'IPTV',
        description: channel.group ? `${channel.name} (${channel.group})` : channel.name,
        behaviorHints: { notWebReady }
    }
    if (hasHeaders) {
        stream.behaviorHints.proxyHeaders = { request: channel.headers }
    }
    return stream
}

function matches(channel, search) {
    if (!search) return true
    const needle = search.toLowerCase()
    return (
        channel.name.toLowerCase().includes(needle) ||
        channel.group.toLowerCase().includes(needle)
    )
}

function buildManifest(genres) {
    return {
        id: 'community.awesome-iptv.stream',
        version,
        name: 'Awesome IPTV',
        description,
        logo: 'https://iptv-org.github.io/iptv/logo.png',
        // Live channels, so no catalog of movies or series.
        types: [TYPE],
        resources: ['catalog', 'meta', 'stream'],
        idPrefixes: ['iptv:'],
        catalogs: [
            {
                type: TYPE,
                id: CATALOG_ID,
                name: 'Awesome IPTV',
                extra: [
                    { name: 'search', isRequired: false },
                    { name: 'genre', options: genres, isRequired: false },
                    { name: 'skip', isRequired: false }
                ]
            }
        ],
        behaviorHints: { configurable: false }
    }
}

/**
 * Loads the playlist and returns a ready-to-serve addon interface.
 *
 * The manifest advertises the playlist's groups as catalog genres, so the
 * playlist has to be loaded before the builder is constructed.
 */
async function createAddon() {
    const { genres } = await getPlaylist()
    const builder = new addonBuilder(buildManifest(genres))

    builder.defineCatalogHandler(async ({ type, id, extra = {} }) => {
        if (type !== TYPE || id !== CATALOG_ID) return { metas: [] }

        const { channels } = await getPlaylist()
        const skip = Number.parseInt(extra.skip, 10) || 0

        const filtered = channels.filter(
            (channel) =>
                (!extra.genre || channel.group === extra.genre) && matches(channel, extra.search)
        )

        return {
            metas: filtered.slice(skip, skip + config.pageSize).map(toMeta),
            cacheMaxAge
        }
    })

    builder.defineMetaHandler(async ({ type, id }) => {
        if (type !== TYPE) return { meta: null }

        const { byId } = await getPlaylist()
        const channel = byId.get(id)
        if (!channel) return { meta: null }

        return { meta: toMeta(channel), cacheMaxAge }
    })

    builder.defineStreamHandler(async ({ type, id }) => {
        if (type !== TYPE) return { streams: [] }

        const { byId } = await getPlaylist()
        const channel = byId.get(id)
        // An unknown id means the playlist no longer carries that channel.
        if (!channel) return { streams: [] }

        return { streams: [toStream(channel)], cacheMaxAge }
    })

    return builder.getInterface()
}

module.exports = { createAddon, buildManifest, toMeta, toStream, CATALOG_ID }
