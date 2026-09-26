FROM node:20-alpine

WORKDIR /app

COPY package.json site.config.mjs ./
COPY scripts ./scripts
COPY site ./site
COPY README.md ./
COPY stremio-addon/src/m3u.js ./stremio-addon/src/m3u.js

COPY playlists /playlists

ENV HOST=0.0.0.0
ENV PORT=4173
ENV SITE_BASE=/
ENV IPTV_PLAYLIST_URL=/playlists/sample.m3u

EXPOSE 4173

CMD ["node", "scripts/preview.mjs"]
