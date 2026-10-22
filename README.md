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

## Screenshots

**Export with `-v`** (run through Docker Compose on Windows):

<img width="1980" height="1229" alt="Screenshot 2026-10-22 192745" src="https://github.com/user-attachments/assets/314c56a8-126e-4584-ba78-863979fa39aa" />

<img width="1980" height="1229" alt="Screenshot 2026-10-22 192751" src="https://github.com/user-attachments/assets/0c697c3d-3863-4484-9404-9d16079d9234" />

**Unit tests**: 25 passing:

<img width="1324" height="765" alt="Screenshot 2026-10-22 193049" src="https://github.com/user-attachments/assets/69756a7d-8da2-432e-b10b-fc86cfe26fb1" />

**Data in Redis:**

<img width="1324" height="765" alt="Screenshot 2026-10-22 193152" src="https://github.com/user-attachments/assets/96b4a7bf-152e-4624-b4db-c9043db025ee" />

**Redis container running in Docker Desktop:**

<img width="3840" height="2292" alt="Screenshot 2026-10-22 193404" src="https://github.com/user-attachments/assets/bb448cdc-67c1-4960-915c-c4bbbd03f60b" />

