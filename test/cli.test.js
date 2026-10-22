'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, run } = require('../src/cli');

const XML = '<config><subdomains><subdomain>http://a.com</subdomain></subdomains>'
  + '<cookies><cookie name="dlp-avast" host="amazon">mmm</cookie></cookies></config>';

function fakeClient() {
  const store = new Map();
  const calls = [];
  return {
    store,
    calls,
    async connect() { calls.push('connect'); },
    async quit() { calls.push('quit'); },
    multi() {
      const q = [];
      const tx = { set(k, v) { q.push([k, v]); return tx; }, async exec() { q.forEach(([k, v]) => store.set(k, v)); } };
      return tx;
    },
  };
}

test('parseArgs: path only', () => {
  assert.deepEqual(parseArgs(['/x.xml']), { verbose: false, file: '/x.xml' });
});

test('parseArgs: -v before or after the path', () => {
  assert.deepEqual(parseArgs(['-v', '/x.xml']), { verbose: true, file: '/x.xml' });
  assert.deepEqual(parseArgs(['/x.xml', '-v']), { verbose: true, file: '/x.xml' });
});

test('parseArgs: errors on missing path, unknown flag, extra argument', () => {
  assert.throws(() => parseArgs([]), /Missing path/);
  assert.throws(() => parseArgs(['-x', 'a.xml']), /Unknown option/);
  assert.throws(() => parseArgs(['a.xml', 'b.xml']), /Unexpected argument/);
});

test('run: saves keys and prints only the summary without -v', async () => {
  const client = fakeClient();
  const out = [];
  await run(['/in.xml'], { createClient: () => client, readFile: () => XML, log: (l) => out.push(l) });

  assert.equal(client.store.get('subdomains'), '["http://a.com"]');
  assert.equal(client.store.get('cookie:dlp-avast:amazon'), 'mmm');
  assert.deepEqual(out, ['Saved 2 keys to Redis.']);
  assert.deepEqual(client.calls, ['connect', 'quit']);
});

test('run: with -v prints every saved key', async () => {
  const out = [];
  await run(['-v', '/in.xml'], { createClient: fakeClient, readFile: () => XML, log: (l) => out.push(l) });
  assert.deepEqual(out, [
    'subdomains = ["http://a.com"]',
    'cookie:dlp-avast:amazon = mmm',
    'Saved 2 keys to Redis.',
  ]);
});

test('run: unreadable file gives a clear error and never connects', async () => {
  const client = fakeClient();
  const readFile = () => { throw new Error('ENOENT'); };
  await assert.rejects(run(['/missing.xml'], { createClient: () => client, readFile }), /Cannot read file/);
  assert.deepEqual(client.calls, []);
});

test('run: invalid XML never connects to Redis', async () => {
  const client = fakeClient();
  await assert.rejects(
    run(['/bad.xml'], { createClient: () => client, readFile: () => '<config>' }),
    /Invalid XML/,
  );
  assert.deepEqual(client.calls, []);
});

test('run: closes the connection even when saving fails', async () => {
  const client = fakeClient();
  client.multi = () => ({ set() {}, exec: async () => { throw new Error('write failed'); } });
  await assert.rejects(run(['/in.xml'], { createClient: () => client, readFile: () => XML, log() {} }), /write failed/);
  assert.deepEqual(client.calls, ['connect', 'quit']);
});
