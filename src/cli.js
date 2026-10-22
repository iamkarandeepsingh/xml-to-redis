'use strict';

const fs = require('fs');
const { parseConfig } = require('./parser');
const { buildEntries, saveEntries } = require('./exporter');

const USAGE = 'Usage: export.sh [-v] /path/to/xml';

/**
 * Parse command-line arguments. Accepts "-v" before or after the path.
 * @param {string[]} argv - arguments without "node" and the script name
 */
function parseArgs(argv) {
  let verbose = false;
  let file = null;
  for (const arg of argv) {
    if (arg === '-v' || arg === '--verbose') {
      verbose = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}\n${USAGE}`);
    } else if (file === null) {
      file = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}\n${USAGE}`);
    }
  }
  if (!file) throw new Error(`Missing path to XML file\n${USAGE}`);
  return { verbose, file };
}

/**
 * Run the export. Dependencies are injected so the whole flow is testable
 * without a real Redis server or filesystem.
 */
async function run(argv, { createClient, readFile = fs.readFileSync, log = console.log } = {}) {
  const { verbose, file } = parseArgs(argv);

  let xml;
  try {
    xml = readFile(file, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read file "${file}": ${err.message}`);
  }

  const entries = buildEntries(parseConfig(xml));

  const client = createClient();
  await client.connect();
  try {
    const keys = await saveEntries(client, entries);
    if (verbose) {
      for (const [key, value] of entries) log(`${key} = ${value}`);
    }
    log(`Saved ${keys.length} keys to Redis.`);
    return keys;
  } finally {
    await client.quit();
  }
}

if (require.main === module) {
  const { createClient } = require('redis');
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  run(process.argv.slice(2), { createClient: () => createClient({ url }) }).catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { parseArgs, run };
