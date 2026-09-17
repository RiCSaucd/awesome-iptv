'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { listenHost, formatServiceUrls, safeHostHeader, requestHost } = require('../scripts/lan.cjs');

test('listenHost accepts bind addresses and rejects junk', () => {
  assert.equal(listenHost('0.0.0.0'), '0.0.0.0');
  assert.equal(listenHost('127.0.0.1'), '127.0.0.1');
  assert.equal(listenHost('', '0.0.0.0'), '0.0.0.0');
  assert.equal(listenHost(undefined, '0.0.0.0'), '0.0.0.0');
  assert.throws(() => listenHost('evil.example'), /bind address/);
});

test('formatServiceUrls always includes localhost', () => {
  const urls = formatServiceUrls({ port: 4173, path: '/watch' });
  assert.ok(urls.includes('http://127.0.0.1:4173/watch'));
  assert.throws(() => formatServiceUrls({ port: 0, path: '/' }), /positive integer/);
});

test('safeHostHeader strips header injection', () => {
  assert.equal(safeHostHeader('192.168.1.20:4173'), '192.168.1.20:4173');
  assert.equal(safeHostHeader('localhost'), 'localhost');
  assert.equal(safeHostHeader('bad host'), null);
  assert.equal(safeHostHeader('x\ninjected'), null);
});

test('requestHost falls back when the header is missing', () => {
  assert.deepEqual(requestHost(undefined, 4173), { hostname: '127.0.0.1', port: 4173 });
  assert.deepEqual(requestHost('10.0.0.5:4173', 4173), { hostname: '10.0.0.5', port: 4173 });
});
