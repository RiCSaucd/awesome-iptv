/**
 * Living-room channel list + HLS playback against /api/playlist.
 */

const searchInput = document.querySelector('#channel-search');
const groupSelect = document.querySelector('#channel-group');
const listRoot = document.querySelector('#channel-list');
const countRoot = document.querySelector('#channel-count');
const player = document.querySelector('#player');
const nowPlaying = document.querySelector('#now-playing');
const playerError = document.querySelector('#player-error');

/** @type {{ id: string, name: string, url: string, group: string }[]} */
let channels = [];
/** @type {string} */
let query = '';
/** @type {string} */
let group = '';
/** @type {string | null} */
let activeId = null;
/** @type {{ destroy?: () => void } | null} */
let hls = null;

await loadPlaylist();
bind();
render();

function bind() {
  if (searchInput instanceof HTMLInputElement) {
    searchInput.addEventListener('input', () => {
      query = searchInput.value.trim().toLowerCase();
      render();
    });
  }
  if (groupSelect instanceof HTMLSelectElement) {
    groupSelect.addEventListener('change', () => {
      group = groupSelect.value;
      render();
    });
  }
}

async function loadPlaylist() {
  const response = await fetch('/api/playlist');
  if (!response.ok) {
    showError(`Could not load the house playlist (${response.status}).`);
    return;
  }
  const payload = await response.json();
  channels = Array.isArray(payload.channels) ? payload.channels : [];
  fillGroups();
}

function fillGroups() {
  if (!(groupSelect instanceof HTMLSelectElement)) {
    return;
  }
  const groups = [...new Set(channels.map((channel) => channel.group).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
  const options = [new Option('All groups', '')];
  for (const name of groups) {
    options.push(new Option(name, name));
  }
  groupSelect.replaceChildren(...options);
}

function render() {
  if (!(listRoot instanceof HTMLElement) || !(countRoot instanceof HTMLElement)) {
    return;
  }
  const visible = channels.filter((channel) => {
    if (group && channel.group !== group) {
      return false;
    }
    if (!query) {
      return true;
    }
    return `${channel.name} ${channel.group}`.toLowerCase().includes(query);
  });
  countRoot.textContent = String(visible.length);
  listRoot.replaceChildren(
    ...visible.slice(0, 400).map((channel) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-current', channel.id === activeId ? 'true' : 'false');
      button.innerHTML = '';
      const name = document.createElement('span');
      name.textContent = channel.name;
      const meta = document.createElement('small');
      meta.textContent = channel.group;
      button.append(name, meta);
      button.addEventListener('click', () => {
        play(channel);
      });
      item.append(button);
      return item;
    }),
  );
}

/**
 * @param {{ id: string, name: string, url: string, group: string }} channel
 */
function play(channel) {
  activeId = channel.id;
  render();
  hideError();
  if (nowPlaying instanceof HTMLElement) {
    nowPlaying.textContent = channel.name;
  }
  if (!(player instanceof HTMLVideoElement)) {
    return;
  }

  teardownHls();

  const HlsCtor = window.Hls;
  if (HlsCtor && HlsCtor.isSupported()) {
    hls = new HlsCtor();
    hls.on(HlsCtor.Events.ERROR, (_event, data) => {
      if (data?.fatal) {
        showError('This stream failed to play. Try another channel, or open it in VLC.');
      }
    });
    hls.loadSource(channel.url);
    hls.attachMedia(player);
    void player.play().catch((error) => {
      showError(error instanceof Error ? error.message : 'Playback failed');
    });
    return;
  }

  if (player.canPlayType('application/vnd.apple.mpegurl')) {
    player.src = channel.url;
    void player.play().catch((error) => {
      showError(error instanceof Error ? error.message : 'Playback failed');
    });
    return;
  }

  showError(
    'This browser cannot play HLS in-page (hls.js did not load). Try Safari, a TV browser, or VLC.',
  );
}

function teardownHls() {
  if (hls && typeof hls.destroy === 'function') {
    hls.destroy();
  }
  hls = null;
  if (player instanceof HTMLVideoElement) {
    player.removeAttribute('src');
    player.load();
  }
}

/**
 * @param {string} message
 */
function showError(message) {
  if (playerError instanceof HTMLElement) {
    playerError.hidden = false;
    playerError.textContent = message;
  }
}

function hideError() {
  if (playerError instanceof HTMLElement) {
    playerError.hidden = true;
    playerError.textContent = '';
  }
}
