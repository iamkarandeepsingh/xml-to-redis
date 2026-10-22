#!/usr/bin/env bash
# Export data from an XML config file to Redis using docker compose.
#
#   ./export.sh [-v] /path/to/xml
#
# -v  print every key saved to Redis
set -euo pipefail

usage() { echo "Usage: $0 [-v] /path/to/xml" >&2; exit 1; }

VERBOSE=""
FILE=""
for arg in "$@"; do
  case "$arg" in
    -v) VERBOSE="-v" ;;
    -*) echo "Unknown option: $arg" >&2; usage ;;
    *)  [ -z "$FILE" ] || usage; FILE="$arg" ;;
  esac
done

[ -n "$FILE" ] || usage
[ -f "$FILE" ] || { echo "File not found: $FILE" >&2; exit 1; }

# The container cannot see the host filesystem, so mount the file read-only.
ABS_FILE="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"
cd "$(dirname "$0")"

# Starts Redis (waiting for its healthcheck), runs the exporter once, removes the app container.
docker compose run --rm --build --quiet-pull \
  -v "$ABS_FILE:/input/config.xml:ro" \
  app $VERBOSE /input/config.xml
