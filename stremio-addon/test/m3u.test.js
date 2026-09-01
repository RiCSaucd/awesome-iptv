'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { parseM3U } = require('../src/m3u')

const PLAYLIST = `#EXTM3U
#EXTINF:-1 tvg-id="NewsOne.us" tvg-logo="http://logo/news.png" tvg-country="US" tvg-language="English" group-title="News",News One
https://example.com/news.m3u8
#EXTINF:-1 group-title="Sports",Sports Two
#EXTVLCOPT:http-user-agent=CustomAgent/1.0
#EXTVLCOPT:http-referrer=https://example.com/
http://example.com/sports.m3u8
#EXTGRP:Movies
#EXTINF:-1,Movie Three
https://example.com/movies.m3u8
`

test('parses attributes, name and url', () => {
    const [news] = parseM3U(PLAYLIST)
    assert.equal(news.id, 'iptv:NewsOne.us')
    assert.equal(news.name, 'News One')
    assert.equal(news.url, 'https://example.com/news.m3u8')
    assert.equal(news.logo, 'http://logo/news.png')
    assert.equal(news.group, 'News')
    assert.equal(news.country, 'US')
    assert.equal(news.language, 'English')
})

test('collects EXTVLCOPT headers', () => {
    const sports = parseM3U(PLAYLIST)[1]
    assert.deepEqual(sports.headers, {
        'User-Agent': 'CustomAgent/1.0',
        Referer: 'https://example.com/'
    })
})

test('falls back to EXTGRP when group-title is absent', () => {
    const movie = parseM3U(PLAYLIST)[2]
    assert.equal(movie.group, 'Movies')
})

test('derives a stable id when tvg-id is missing', () => {
    const entry = '#EXTM3U\n#EXTINF:-1,No Id\nhttps://example.com/a.m3u8\n'
    const [first] = parseM3U(entry)
    const [again] = parseM3U(entry)
    assert.match(first.id, /^iptv:x-[0-9a-f]{16}$/)
    assert.equal(first.id, again.id)
})

test('drops duplicate ids and entries without a url', () => {
    const channels = parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="Dup.us",First
https://example.com/one.m3u8
#EXTINF:-1 tvg-id="Dup.us",Second
https://example.com/two.m3u8
#EXTINF:-1,Dangling
`)
    assert.equal(channels.length, 1)
    assert.equal(channels[0].name, 'First')
})

test('handles a comma inside an attribute value', () => {
    const [channel] = parseM3U('#EXTM3U\n#EXTINF:-1 group-title="News, Talk",Real Name\nhttps://e/a\n')
    assert.equal(channel.name, 'Real Name')
    assert.equal(channel.group, 'News, Talk')
})

test('ignores unknown directives and blank lines', () => {
    const channels = parseM3U(`#EXTM3U

#KODIPROP:inputstream=inputstream.adaptive
#EXTINF:-1,Only One

https://example.com/only.m3u8
`)
    assert.equal(channels.length, 1)
    assert.equal(channels[0].url, 'https://example.com/only.m3u8')
})

test('returns nothing for an empty playlist', () => {
    assert.deepEqual(parseM3U(''), [])
})
