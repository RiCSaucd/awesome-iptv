# Awesome IPTV — Stremio addon

A [Stremio](https://www.stremio.com/) addon that turns any M3U/M3U8 playlist into browsable,
searchable, playable live TV channels inside Stremio.

It serves three resources for the `tv` type:

- **catalog** — every channel in the playlist, filterable by group (`group-title`) and searchable by name
- **meta** — channel detail page, using the playlist's `tvg-logo` as poster, logo and background
- **stream** — the channel's stream URL, with any headers the playlist declares

## Requirements

Node.js 18 or newer (the addon uses the built-in `fetch`).

## Usage

```sh
cd stremio-addon
npm install
npm start
```

The addon starts on <http://127.0.0.1:7000/manifest.json>. To install it, open Stremio, go to
**Addons → Add addon**, and paste that manifest URL.

By default it loads the public [iptv-org](https://github.com/iptv-org/iptv) playlist. Point it at
your own playlist — a URL or a local file — with `IPTV_PLAYLIST_URL`:

```sh
IPTV_PLAYLIST_URL=https://example.com/playlist.m3u npm start
IPTV_PLAYLIST_URL=./my-channels.m3u npm start
```

## Configuration

All settings are environment variables; every one has a working default.

| Variable | Default | Description |
| --- | --- | --- |
| `IPTV_PLAYLIST_URL` | `https://iptv-org.github.io/iptv/index.m3u` | Playlist to serve — an `http(s)` URL or a local file path. |
| `PORT` | `7000` | Port the addon listens on. |
| `IPTV_PLAYLIST_TTL_MINUTES` | `60` | How long a loaded playlist is reused before it is re-fetched. |
| `IPTV_FETCH_TIMEOUT_SECONDS` | `30` | Timeout for fetching a remote playlist. |
| `IPTV_MAX_CHANNELS` | `0` | Cap on the number of channels; `0` keeps them all. |
| `IPTV_PAGE_SIZE` | `100` | Channels returned per catalog page. |
| `IPTV_USER_AGENT` | `awesome-iptv-stremio-addon/<version>` | User agent used when fetching the playlist. |
| `IPTV_PUBLISH_URL` | *(unset)* | Public https manifest URL to announce to the Stremio addon collection on startup. |

## How it works

The playlist is fetched once at startup, parsed, and cached in memory. Channel groups become the
catalog's genre options, so the manifest is built after the first load. Subsequent requests reuse
the cache until the TTL expires; a refresh that fails while a copy is cached logs the error and
keeps serving the cached channels rather than emptying the catalog.

Channel ids are derived from `tvg-id`, falling back to a hash of the channel name and URL, so they
stay stable across playlist refreshes and Stremio's own cache. Entries with a duplicate id or no
URL are skipped.

Streams over plain `http`, and streams that need custom headers, are marked `notWebReady` — the
web player cannot load them, so Stremio routes them to a native player. `#EXTVLCOPT:http-user-agent`
and `#EXTVLCOPT:http-referrer` are passed through as `proxyHeaders`.

## Publishing

Once the manifest is reachable on a public https URL, set `IPTV_PUBLISH_URL` to that URL to
announce the addon to the Stremio addon collection on startup:

```sh
IPTV_PUBLISH_URL=https://your-domain.example/manifest.json npm start
```

Only do this for an addon you actually intend to publish, and make sure the playlist you serve is
one you have the right to distribute.

## Tests

```sh
npm test
```

Covers the M3U parser (attributes, groups, VLC options, id stability, malformed entries) and the
manifest, meta and stream mapping.
