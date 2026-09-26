'use strict';

const os = require('node:os');

const HOST_RE = /^(?:0\.0\.0\.0|127\.0\.0\.1|localhost|::|::1|(?:\d{1,3}\.){3}\d{1,3})$/i;
const HOST_HEADER_RE = /^(?:[A-Za-z0-9.-]+)(?::\d{1,5})?$/;

/**
 * @param {string | undefined} value
 * @param {string} fallback
 * @returns {string}
 */
function listenHost(value, fallback = '127.0.0.1') {
  const host = ((value ?? fallback).trim() || fallback);
  if (!HOST_RE.test(host)) {
    throw new Error(
      `HOST must be a bind address (0.0.0.0, 127.0.0.1, localhost), got "${host}"`,
    );
  }
  return host;
}

/**
 * @returns {string[]}
 */
function lanIPv4s() {
  /** @type {string[]} */
  const addresses = [];
  for (const adapters of Object.values(os.networkInterfaces())) {
    if (!adapters) {
      continue;
    }
    for (const adapter of adapters) {
      if (adapter.internal || adapter.family !== 'IPv4') {
        continue;
      }
      if (adapter.address) {
        addresses.push(adapter.address);
      }
    }
  }
  return [...new Set(addresses)];
}

/**
 * @param {{ port: number, path?: string }} options
 * @returns {string[]}
 */
function formatServiceUrls({ port, path = '/' }) {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('port must be a positive integer');
  }
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const urls = [`http://127.0.0.1:${port}${suffix}`];
  for (const ip of lanIPv4s()) {
    urls.push(`http://${ip}:${port}${suffix}`);
  }
  return urls;
}

/**
 * @param {string | undefined} header
 * @returns {string | null}
 */
function safeHostHeader(header) {
  if (typeof header !== 'string') {
    return null;
  }
  const host = header.trim();
  if (!HOST_HEADER_RE.test(host)) {
    return null;
  }
  return host;
}

/**
 * @param {string | undefined} header
 * @param {number} fallbackPort
 * @returns {{ hostname: string, port: number }}
 */
function requestHost(header, fallbackPort) {
  const safe = safeHostHeader(header);
  if (!safe) {
    return { hostname: '127.0.0.1', port: fallbackPort };
  }
  const [hostname, portText] = safe.split(':');
  const port = portText ? Number.parseInt(portText, 10) : fallbackPort;
  return {
    hostname: hostname || '127.0.0.1',
    port: Number.isInteger(port) && port > 0 ? port : fallbackPort,
  };
}

module.exports = {
  listenHost,
  lanIPv4s,
  formatServiceUrls,
  safeHostHeader,
  requestHost,
};
