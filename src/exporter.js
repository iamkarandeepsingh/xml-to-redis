'use strict';

const SUBDOMAINS_KEY = 'subdomains';

const cookieKey = (name, host) => `cookie:${name}:${host}`;

/**
 * Turn the parsed config into the exact key/value pairs that go to Redis.
 * Pure function: easy to test, and the single place the key format lives.
 *
 * @returns {Array<[string, string]>} ordered [key, value] pairs
 */
function buildEntries({ subdomains, cookies }) {
  const entries = [[SUBDOMAINS_KEY, JSON.stringify(subdomains)]];
  for (const { name, host, value } of cookies) {
    entries.push([cookieKey(name, host), value]);
  }
  return entries;
}

/**
 * Write all entries to Redis in a single MULTI/EXEC transaction,
 * so a run either saves everything or nothing.
 *
 * @param {{ multi: Function }} client - a connected node-redis client (or a test double)
 * @param {Array<[string, string]>} entries
 * @returns {Promise<string[]>} the keys that were saved
 */
async function saveEntries(client, entries) {
  const tx = client.multi();
  for (const [key, value] of entries) {
    tx.set(key, value);
  }
  await tx.exec();
  return entries.map(([key]) => key);
}

module.exports = { buildEntries, saveEntries, cookieKey, SUBDOMAINS_KEY };
