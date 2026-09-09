'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { buildManifest, toMeta, toStream, CATALOG_ID } = require('../src/addon')

const channel = {
    id: 'iptv:NewsOne.us',
    name: 'News One',
    url: 'https://example.com/news.m3u8',
    logo: 'http://logo/news.png',
    group: 'News',
    language: 'English',
    country: 'US',
    headers: {}
}

test('manifest advertises the playlist groups as genres', () => {
    const manifest = buildManifest(['News', 'Sports'])
    assert.deepEqual(manifest.types, ['tv'])
    assert.deepEqual(manifest.resources, ['catalog', 'meta', 'stream'])
    assert.deepEqual(manifest.idPrefixes, ['iptv:'])
    assert.equal(manifest.catalogs[0].id, CATALOG_ID)
    const genre = manifest.catalogs[0].extra.find((entry) => entry.name === 'genre')
    assert.deepEqual(genre.options, ['News', 'Sports'])
})

test('meta carries the channel logo and genre', () => {
    const meta = toMeta(channel)
    assert.equal(meta.type, 'tv')
    assert.equal(meta.poster, 'http://logo/news.png')
    assert.deepEqual(meta.genres, ['News'])
    assert.equal(meta.description, 'News · US · English')
})

test('https streams without headers stay web ready', () => {
    const stream = toStream(channel)
    assert.equal(stream.url, channel.url)
    assert.equal(stream.behaviorHints.notWebReady, false)
    assert.equal(stream.behaviorHints.proxyHeaders, undefined)
})

test('plain http streams are marked not web ready', () => {
    const stream = toStream({ ...channel, url: 'http://example.com/news.m3u8' })
    assert.equal(stream.behaviorHints.notWebReady, true)
})

test('custom headers are passed through as proxy headers', () => {
    const stream = toStream({ ...channel, headers: { 'User-Agent': 'CustomAgent/1.0' } })
    assert.equal(stream.behaviorHints.notWebReady, true)
    assert.deepEqual(stream.behaviorHints.proxyHeaders, {
        request: { 'User-Agent': 'CustomAgent/1.0' }
    })
})
