# XML → Redis exporter

A small Node.js app that reads an XML config file and exports its data to Redis:

| Redis key | Value |
|---|---|
| `subdomains` | JSON array of every `<subdomain>`, in file order |
| `cookie:%NAME%:%HOST%` | text of each `<cookie name="…" host="…">` element |

Example: `cookie:dlp-avast:amazon` → `mmm_amz_dlp_777_ppc_m`

## Run it

Requirements: Docker with Docker Compose v2.

```bash
./export.sh -v /path/to/config.xml   # export and print every saved key
./export.sh /path/to/config.xml      # export, print only a summary
```

`export.sh` builds the app image, starts Redis (waiting for its healthcheck), mounts the XML file read-only into the app container and runs the export once. Redis keeps running afterwards so you can inspect the data:

```bash
docker compose exec redis redis-cli get cookie:dlp-avast:amazon
docker compose exec redis redis-cli get subdomains
docker compose down          # stop everything (add -v to also delete the data)
```

The task's sample file is included at `data/config.xml`. It produces 47 keys: `subdomains` (38 entries) and 46 cookie keys.

## Tests

```bash
npm install
npm test
```

25 unit tests using Node's built-in test runner (no extra test framework). They don't need Redis or Docker: the Redis client and file reader are injected, so tests use small in-memory fakes.

## Project layout

```
src/parser.js      XML text → { subdomains, cookies }      (no Redis knowledge)
src/exporter.js    data → Redis key/value pairs, then save   (no XML knowledge)
src/cli.js         argument parsing, wiring, -v output
export.sh          entry point: runs everything through docker compose
docker-compose.yml app container + Redis container
test/              unit tests for each module
```

## Design decisions

- **Three small layers.** Parsing, key building and the CLI are separate so each can be tested on its own, and the key format lives in exactly one place (`exporter.js`).
- **Atomic write.** All keys are written in one `MULTI/EXEC` transaction, so a run saves everything or nothing; Redis is never left half-updated.
- **Validate before connecting.** The file is read and parsed before opening a Redis connection, so bad input fails fast with a clear message and touches nothing.
- **Values kept exactly as in the file.** Values are never type-converted (`01net` stays `01net`), and case is preserved: `cookie:dlp-avg:filehippo` is `Mmm_fhp_dlp_779_ppc_m` with a capital M in the source, which looks like a typo but isn't the exporter's call to fix. The same goes for host names such as `donwloaden`.
- **Duplicates kept.** `http://` and `https://` versions of a domain are different entries, so the subdomain list is exported as-is, in order.
- **Strict on broken cookies.** A `<cookie>` without `name` or `host` can't produce a valid key, so the run stops with an error rather than silently skipping data.
- **Re-runnable.** Running the export again overwrites the same keys, so it is safe to repeat.
- **`fast-xml-parser`** was chosen because it is dependency-free, validates the XML and handles attributes, comments and single-element lists cleanly. **`redis`** is the official Node client.
- The app container runs as the non-root `node` user, and Redis data is kept in a named volume.

## Possible next steps

- Remove cookie keys that disappeared from the XML since the last run (e.g. keep a set of exported keys and delete the difference).
- An integration test against a real Redis container in CI.
- Structured logging and a `--dry-run` flag.
