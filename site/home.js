const addonPort = Number.parseInt(window.__HOME_ADDON_PORT__ ?? '7000', 10);
const host = window.location.hostname || '127.0.0.1';

const catalogUrls = document.querySelector('#catalog-urls');
const watchLink = document.querySelector('#watch-link');
const addonLocal = document.querySelector('#addon-localhost');
const addonLan = document.querySelector('#addon-lan');

if (catalogUrls instanceof HTMLElement) {
  const urls = [`http://${host}:${window.location.port || '4173'}/`];
  catalogUrls.replaceChildren(
    ...urls.map((url) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = url;
      link.textContent = url;
      item.append(link);
      return item;
    }),
  );
}

if (watchLink instanceof HTMLAnchorElement) {
  watchLink.href = '/watch';
}

if (addonLocal instanceof HTMLElement) {
  addonLocal.textContent = `http://127.0.0.1:${addonPort}/manifest.json`;
}

if (addonLan instanceof HTMLElement) {
  addonLan.textContent = `http://${host}:${addonPort}/manifest.json`;
}
