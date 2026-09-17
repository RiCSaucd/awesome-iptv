FROM node:20-alpine

WORKDIR /app

COPY scripts/lan.cjs ./scripts/lan.cjs
COPY playlists /playlists
COPY stremio-addon/package.json ./stremio-addon/package.json
WORKDIR /app/stremio-addon
RUN npm install --omit=dev
COPY stremio-addon/src ./src

ENV HOST=0.0.0.0
ENV PORT=7000
ENV IPTV_PLAYLIST_URL=/playlists/sample.m3u

EXPOSE 7000

CMD ["node", "src/index.js"]
