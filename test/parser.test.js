'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseConfig } = require('../src/parser');

const SAMPLE = `
<config>
  <subdomains>
    <subdomain>http://secureline.tools.avast.com</subdomain>
    <subdomain>http://gf.tools.avast.com</subdomain>
  </subdomains>
  <cookies>
    <!-- a comment that must be ignored -->
    <cookie name="dlp-avast" host="amazon">mmm_amz_dlp_777_ppc_m</cookie>
    <cookie name="dlp-avg" host="01net">mmm_net_dlp_779_ppc_m</cookie>
  </cookies>
</config>`;

test('parses subdomains in document order', () => {
  const { subdomains } = parseConfig(SAMPLE);
  assert.deepEqual(subdomains, ['http://secureline.tools.avast.com', 'http://gf.tools.avast.com']);
});

test('parses cookie name, host and value, ignoring comments', () => {
  const { cookies } = parseConfig(SAMPLE);
  assert.deepEqual(cookies, [
    { name: 'dlp-avast', host: 'amazon', value: 'mmm_amz_dlp_777_ppc_m' },
    { name: 'dlp-avg', host: '01net', value: 'mmm_net_dlp_779_ppc_m' },
  ]);
});

test('keeps numeric-looking values as strings', () => {
  const { cookies } = parseConfig('<config><cookies><cookie name="n" host="01">007</cookie></cookies></config>');
  assert.deepEqual(cookies, [{ name: 'n', host: '01', value: '007' }]);
});

test('a single subdomain/cookie still yields arrays', () => {
  const xml = '<config><subdomains><subdomain>http://a.com</subdomain></subdomains>'
    + '<cookies><cookie name="x" host="y">z</cookie></cookies></config>';
  const result = parseConfig(xml);
  assert.deepEqual(result.subdomains, ['http://a.com']);
  assert.equal(result.cookies.length, 1);
});

test('missing sections produce empty arrays', () => {
  assert.deepEqual(parseConfig('<config></config>'), { subdomains: [], cookies: [] });
});

test('empty cookie element yields an empty string value', () => {
  const { cookies } = parseConfig('<config><cookies><cookie name="a" host="b"></cookie></cookies></config>');
  assert.equal(cookies[0].value, '');
});

test('rejects empty input', () => {
  assert.throws(() => parseConfig('   '), /empty/);
});

test('rejects malformed XML', () => {
  assert.throws(() => parseConfig('<config><subdomains></config>'), /Invalid XML/);
});

test('rejects a document without a <config> root', () => {
  assert.throws(() => parseConfig('<other/>'), /Missing <config>/);
});

test('rejects a cookie without a host attribute', () => {
  assert.throws(
    () => parseConfig('<config><cookies><cookie name="a">v</cookie></cookies></config>'),
    /missing a "name" or "host"/,
  );
});

test('parses the real config.xml from the task', () => {
  const xml = fs.readFileSync(path.join(__dirname, '..', 'data', 'config.xml'), 'utf8');
  const { subdomains, cookies } = parseConfig(xml);
  assert.equal(subdomains.length, 38);
  assert.equal(subdomains[0], 'http://secureline.tools.avast.com');
  assert.equal(subdomains.at(-1), 'https://bits.avcdn.net');
  assert.equal(cookies.length, 46);
  // Value with a capital letter must be preserved exactly as in the file.
  const filehippo = cookies.find((c) => c.name === 'dlp-avg' && c.host === 'filehippo');
  assert.equal(filehippo.value, 'Mmm_fhp_dlp_779_ppc_m');
});
