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
# On Windows (Git Bash) "pwd -W" gives a path Docker understands (C:/Users/...);
# elsewhere it fails and we fall back to plain "pwd".
ABS_DIR="$(cd "$(dirname "$FILE")" && { pwd -W 2>/dev/null || pwd; })"
ABS_FILE="$ABS_DIR/$(basename "$FILE")"

# Stop Git Bash on Windows from rewriting container paths like /input/config.xml.
export MSYS_NO_PATHCONV=1

cd "$(dirname "$0")"

# Starts Redis (waiting for its healthcheck), runs the exporter once, removes the app container.
docker compose run --rm --build --quiet-pull \
  -v "$ABS_FILE:/input/config.xml:ro" \
  app $VERBOSE /input/config.xml
