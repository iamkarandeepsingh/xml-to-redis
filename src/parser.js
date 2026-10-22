'use strict';

const { XMLParser, XMLValidator } = require('fast-xml-parser');

/**
 * Parse the config XML into a plain data structure.
 *
 * Kept free of any Redis knowledge so it can be unit-tested in isolation.
 *
 * @param {string} xml - raw XML text
 * @returns {{ subdomains: string[], cookies: { name: string, host: string, value: string }[] }}
 */
function parseConfig(xml) {
  if (typeof xml !== 'string' || xml.trim() === '') {
    throw new Error('XML input is empty');
  }

  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    const { msg, line } = validation.err;
    throw new Error(`Invalid XML (line ${line}): ${msg}`);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: '#text',
    parseTagValue: false, // keep every value as a string ("01net", "777", ...)
    parseAttributeValue: false,
    trimValues: true,
    // Always return arrays, even when the file has a single element.
    isArray: (tagName) => tagName === 'subdomain' || tagName === 'cookie',
  });

  const doc = parser.parse(xml);
  if (!doc || !Object.prototype.hasOwnProperty.call(doc, 'config')) {
    throw new Error('Missing <config> root element');
  }
  // An empty <config></config> parses to "" rather than an object.
  const config = typeof doc.config === 'object' && doc.config !== null ? doc.config : {};

  const subdomains = ((config.subdomains && config.subdomains.subdomain) || [])
    .map((s) => (typeof s === 'string' ? s : s && s['#text']))
    .filter((s) => typeof s === 'string' && s.length > 0);

  const cookies = [];
  const rawCookies = (config.cookies && config.cookies.cookie) || [];
  for (const c of rawCookies) {
    const name = c && c.name;
    const host = c && c.host;
    const value = c && c['#text'];
    if (!name || !host) {
      throw new Error(`Cookie element is missing a "name" or "host" attribute: ${JSON.stringify(c)}`);
    }
    cookies.push({ name, host, value: value == null ? '' : String(value) });
  }

  return { subdomains, cookies };
}

module.exports = { parseConfig };
