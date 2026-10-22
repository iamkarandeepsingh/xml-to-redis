'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildEntries, saveEntries, cookieKey } = require('../src/exporter');

/** Minimal in-memory stand-in for a node-redis client. */
function fakeRedis() {
  const store = new Map();
  let execCalls = 0;
  return {
    store,
    get execCalls() { return execCalls; },
    multi() {
      const queued = [];
      const tx = {
        set(k, v) { queued.push([k, v]); return tx; },
        async exec() {
          execCalls += 1;
          for (const [k, v] of queued) store.set(k, v);
          return queued.map(() => 'OK');
        },
      };
      return tx;
    },
  };
}

test('cookieKey follows the cookie:%NAME%:%HOST% format', () => {
  assert.equal(cookieKey('dlp-avast', 'amazon'), 'cookie:dlp-avast:amazon');
});

test('buildEntries puts subdomains first as a JSON array', () => {
  const entries = buildEntries({ subdomains: ['http://a.com', 'https://b.com'], cookies: [] });
  assert.deepEqual(entries, [['subdomains', '["http://a.com","https://b.com"]']]);
  assert.deepEqual(JSON.parse(entries[0][1]), ['http://a.com', 'https://b.com']);
});

test('buildEntries writes an empty JSON array when there are no subdomains', () => {
  assert.deepEqual(buildEntries({ subdomains: [], cookies: [] }), [['subdomains', '[]']]);
});

test('buildEntries creates one key per cookie', () => {
  const entries = buildEntries({
    subdomains: [],
    cookies: [
      { name: 'dlp-avast', host: 'amazon', value: 'mmm_amz_dlp_777_ppc_m' },
      { name: 'dlp-avg', host: 'amazon', value: 'mmm_amz_dlp_779_ppc_m' },
    ],
  });
  assert.deepEqual(entries.slice(1), [
    ['cookie:dlp-avast:amazon', 'mmm_amz_dlp_777_ppc_m'],
    ['cookie:dlp-avg:amazon', 'mmm_amz_dlp_779_ppc_m'],
  ]);
});

test('saveEntries writes every entry in one transaction and returns the keys', async () => {
  const redis = fakeRedis();
  const keys = await saveEntries(redis, [['subdomains', '[]'], ['cookie:a:b', 'v']]);
  assert.deepEqual(keys, ['subdomains', 'cookie:a:b']);
  assert.equal(redis.execCalls, 1);
  assert.equal(redis.store.get('cookie:a:b'), 'v');
});

test('saveEntries propagates Redis errors', async () => {
  const failing = { multi: () => ({ set() {}, exec: async () => { throw new Error('boom'); } }) };
  await assert.rejects(saveEntries(failing, [['k', 'v']]), /boom/);
});
