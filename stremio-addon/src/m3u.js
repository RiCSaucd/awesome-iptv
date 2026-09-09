'use strict'

const { createHash } = require('crypto')

// Matches key="value" pairs on an #EXTINF line, e.g. tvg-logo="http://…"
const ATTRIBUTE_RE = /([\w-]+)="([^"]*)"/g

// #EXTINF:<duration>[ attributes],<display name>
const EXTINF_RE = /^#EXTINF:\s*(-?\d+(?:\.\d+)?)\s*(.*)$/

function parseAttributes(raw) {
    const attributes = {}
    let match
    while ((match = ATTRIBUTE_RE.exec(raw)) !== null) {
        attributes[match[1].toLowerCase()] = match[2]
    }
    ATTRIBUTE_RE.lastIndex = 0
    return attributes
}

// The display name is whatever follows the last comma that is not inside an
// attribute value, so strip the attributes before looking for it.
function parseDisplayName(raw) {
    const withoutAttributes = raw.replace(ATTRIBUTE_RE, '')
    const comma = withoutAttributes.indexOf(',')
    return comma === -1 ? '' : withoutAttributes.slice(comma + 1).trim()
}

// Channel ids have to survive a playlist refresh, so derive them from stable
// channel data rather than from the position in the file.
function channelId(attributes, name, url) {
    const tvgId = (attributes['tvg-id'] || '').trim()
    if (tvgId) return `iptv:${tvgId}`
    const digest = createHash('sha1').update(`${name}\n${url}`).digest('hex')
    return `iptv:x-${digest.slice(0, 16)}`
}

// #EXTVLCOPT:http-user-agent=… and friends carry the headers a stream needs.
function parseVlcOption(line, headers) {
    const value = line.slice('#EXTVLCOPT:'.length)
    const eq = value.indexOf('=')
    if (eq === -1) return
    const key = value.slice(0, eq).trim().toLowerCase()
    const val = value.slice(eq + 1).trim()
    if (!val) return
    if (key === 'http-user-agent') headers['User-Agent'] = val
    else if (key === 'http-referrer' || key === 'http-referer') headers['Referer'] = val
}

/**
 * Parses an M3U/M3U8 playlist into channels.
 *
 * Entries without a URL, and duplicate ids (the public playlists do contain
 * them), are dropped so the catalog stays addressable.
 *
 * @param {string} text raw playlist contents
 * @returns {Array<object>} parsed channels
 */
function parseM3U(text) {
    const channels = []
    const seen = new Set()

    let pending = null
    let group = ''

    for (const rawLine of String(text).split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line) continue

        if (line.startsWith('#EXTINF:')) {
            const match = EXTINF_RE.exec(line)
            if (!match) continue
            const attributes = parseAttributes(match[2])
            pending = {
                name: parseDisplayName(match[2]) || attributes['tvg-name'] || 'Unnamed channel',
                attributes,
                headers: {}
            }
            continue
        }

        // #EXTGRP applies to the entries that follow it until the next one.
        if (line.startsWith('#EXTGRP:')) {
            group = line.slice('#EXTGRP:'.length).trim()
            continue
        }

        if (line.startsWith('#EXTVLCOPT:')) {
            if (pending) parseVlcOption(line, pending.headers)
            continue
        }

        if (line.startsWith('#')) continue

        // A bare line is the URL for the #EXTINF that preceded it.
        if (!pending) continue

        const url = line
        const { name, attributes, headers } = pending
        pending = null

        const id = channelId(attributes, name, url)
        if (seen.has(id)) continue
        seen.add(id)

        channels.push({
            id,
            name,
            url,
            logo: attributes['tvg-logo'] || '',
            group: attributes['group-title'] || group || 'Uncategorized',
            language: attributes['tvg-language'] || '',
            country: attributes['tvg-country'] || '',
            headers
        })
    }

    return channels
}

module.exports = { parseM3U }
